import Matrix from '@lorena-ssi/matrix-lib'
import Zenroom from '@lorena-ssi/zenroom-lib'
import IpfsClient from 'ipfs-http-client'
import Credential from '@lorena-ssi/credential-lib'
import LorenaDidResolver from '@lorena-ssi/did-resolver'
import { Resolver } from 'did-resolver'
import { EventEmitter } from 'events'
import log from 'debug'
import uuid from 'uuid/v4'

const debug = log('did:debug:sdk')

/**
 * Lorena SDK - Class
 */
export default class Lorena extends EventEmitter {
  /**
   * @param {object} walletHandler walletHandler
   * @param {object} opts opts
   */
  constructor (walletHandler, opts = {}) {
    super()
    this.opts = opts
    if (opts.debug) debug.enabled = true
    this.zenroom = new Zenroom(opts.silent || false)
    this.wallet = walletHandler
    this.matrix = false
    this.recipeId = 0
    this.queue = []
    this.processing = false
    this.ready = false
    this.nextBatch = ''
    this.disconnecting = false
    this.threadId = 0
    this.resolver = false
  }

  /**
   * First time. Init a wallet.
   *
   * @param {string} network Network the wallet is talking to.
   * @returns {Promise} of initialized wallet
   */
  async initWallet (network) {
    return new Promise((resolve, reject) => {
      const info = LorenaDidResolver.getInfoForNetwork(network)
      if (!info) {
        reject(new Error(`Unknown network ${network}`))
        return
      }
      if (info.symbol) {
        this.wallet.info.symbol = info.symbol
      }
      this.wallet.info.type = info.type
      this.wallet.info.blockchainServer = info.blockchainEndpoint
      this.wallet.info.matrixServer = info.matrixEndpoint
      this.matrix = new Matrix(this.wallet.info.matrixServer)

      this.zenroom.random(12).then((matrixUser) => {
        this.wallet.info.matrixUser = matrixUser.toLowerCase()
        return this.zenroom.random(12)
      }).then((matrixPass) => {
        this.wallet.info.matrixPass = matrixPass
        return this.matrix.available(this.wallet.info.matrixUser)
      }).then((available) => {
        if (available) {
          return this.matrix.register(this.wallet.info.matrixUser, this.wallet.info.matrixPass)
        } else {
          reject(new Error('Could not init wallet'))
        }
      }).then(() => {
        resolve(this.wallet.info)
      }).catch(() => {
        reject(new Error('Could not init wallet'))
      })
    })
  }

  /**
   * Locks (saves and encrypts) the wallet
   *
   * @param {string} password Wallet password
   * @returns {boolean} success
   */
  async lock (password) {
    const result = await this.wallet.lock(password)
    if (result) {
      this.emit('locked', password)
    }
    return result
  }

  /**
   * UnLocks (open and decrypts) the wallet
   *
   * @param {string} password Wallet password
   * @returns {boolean} success
   */
  async unlock (password) {
    const result = await this.wallet.unlock(password)
    if (result) {
      this.emit('unlocked', password)
    }

    // Upgrade Wallet if it's necessary
    const packageJSON = require('../package.json')
    if (!this.wallet.info.sdkVersion || this.wallet.info.sdkVersion === undefined || this.wallet.info.sdkVersion === '') {
      console.log('Upgrading legacy wallet to SDK Version: ', packageJSON.version)
      this.wallet.data.links.forEach(element => {
        element.linkId = uuid()
      })
      this.wallet.info.version = packageJSON.version
      this.emit('change')
    }

    return result
  }

  /**
   * saves a Schema.org valid Person
   *
   * @param {object} person Owner of the wallet (Person).
   */
  personalData (person) {
    this.wallet.info.person = person.subject
  }

  async signCredential (subject) {
    return new Promise((resolve) => {
      // Sign the persona
      Credential.signCredential(this.zenroom, subject, this.wallet.info.keyPair, this.wallet.info.did)
        .then((signCredential) => {
          this.wallet.add('credentials', {
            type: 'Persona',
            issuer: this.wallet.info.did,
            id: this.wallet.info.did,
            credential: signCredential
          })
          this.emit('change')
          resolve(signCredential)
        })
    })
  }

  /*
  *  an ID (roomId or LinkId) and returns the corresponding Link ID
  */
  getLinkId (anyId) {
    const UUIDv4 = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$')
    const ROOMID = new RegExp('^![a-zA-Z]+:[a-zA-Z]+.[a-zA-Z]+.[a-zA-Z]+.[a-zA-Z]+.[a-zA-Z]+$')

    // It is a matrix room ID
    if (ROOMID.test(anyId)) {
      const link = this.wallet.get('links', { roomId: anyId })
      return link.linkId
    } else if (UUIDv4.test(anyId)) { // it is a linkID (unique number)
      return anyId
    } else {
      throw new Error('Unsupported ID to getLink')
    }
  }

  /**
   * Connect to Lorena IDspace.
   *
   * @returns {boolean} success (or errors thrown)
   */
  async connect () {
    if (this.ready === true) return true
    else if (this.wallet.info.matrixUser) {
      try {
        // Connect to Matrix.
        this.matrix = new Matrix(this.wallet.info.matrixServer)
        await this.matrix.connect(this.wallet.info.matrixUser, this.wallet.info.matrixPass)

        // Ready to use events.
        const events = await this.matrix.events('')
        this.nextBatch = events.nextBatch
        this.ready = true
        this.processQueue()
        this.emit('ready')
        this.once('receiveMessages', this.receiveMessages)
        this.emit('receiveMessages')
        return true
      } catch (error) {
        debug('%O', error)
        this.emit('error', error)
        throw error
      }
    }
  }

  /**
   * Disconnect for clean shutdown
   */
  disconnect () {
    this.emit('disconnecting')
    this.disconnecting = true
    LorenaDidResolver.disconnectAll()
  }

  /**
   * Loop through received messages.
   */
  async receiveMessages () {
    if (this.disconnecting) {
      return
    }
    this.once('receiveMessages', this.receiveMessages)
    let parsedElement
    const events = await this.getMessages()
    this.processQueue()
    for await (const element of events) {
      try {
        switch (element.type) {
          case 'contact-incoming':
            // add(collection, value)
            this.wallet.add('links', {
              linkId: element.linkId,
              roomId: element.roomId,
              alias: '',
              did: '',
              matrixUser: element.sender,
              status: 'incoming'
            })
            await this.matrix.acceptConnection(element.roomId)
            this.emit('contact-incoming', element.sender)
            this.emit('change')
            break
          case 'contact-add':
            // update(collection, where, value) value can be partial
            this.wallet.update('links', { linkId: element.linkId }, {
              status: 'connected'
            })
            // await this.matrix.acceptConnection(element.roomId)
            this.emit('link-added', element.sender)
            this.emit('change')
            break
          default:
            parsedElement = JSON.parse(element.payload.body)
            parsedElement.linkId = element.linkId
            this.emit(`message:${parsedElement.recipe}`, parsedElement)
            this.emit('message', parsedElement)
            if (parsedElement.recipe === 'member-notify') {
              this.handleMemberNotify(parsedElement)
            }
            break
        }
      } catch (error) {
        debug('%O', error)
        this.emit('warning', 'element unknown')
      }
    }
    if (!this.disconnecting) {
      this.emit('receiveMessages')
    }
  }

  /**
   * handle member-update-notify message
   *
   * @param {*} element event to process
   */
  async handleMemberNotify (element) {
    debug('handleMemberNotify: ', element)
    this.wallet.data.credentials[0] = element.payload.credential
    // TODO: Update credential based on credential ID
    // const where = { 'credentialSubject["@type"]': element.payload.credential.issuer }
    // this.wallet.update('credentials', where, element.payload.credential)
    this.emit('change')
  }

  /**
   * get All messages
   *
   * @returns {*} events
   */
  async getMessages () {
    try {
      const result = await this.matrix.events(this.nextBatch)
      this.nextBatch = result.nextBatch
      return (result.events)
    } catch (e) {
      // If there was an error, log it and return empty events for continuation
      debug(e)
      return []
    }
  }

  /**
   * process Outgoing queue of messages
   */
  async processQueue () {
    try {
      if (this.queue.length > 0) {
        const sendPayload = JSON.stringify(this.queue.pop())
        await this.matrix.sendMessage(this.wallet.info.roomId, 'm.action', sendPayload)
      }
      if (this.queue.length === 0) {
        this.processing = false
      }
    } catch (e) {
      debug(e)
    }
  }

  /**
   * Waits for something to happen only once
   *
   * @param {string} msg Message to be listened to
   * @param {number} timeout for the call
   * @returns {Promise} Promise with the result
   */
  oneMsg (msg, timeout = 10000) {
    return Promise.race(
      [
        new Promise((resolve) => {
          this.once(msg, (data) => {
            resolve(data)
          })
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), timeout))
      ]
    )
  }

  /**
   * Sends an action to another DID
   *
   * @param {string} recipe Remote recipe name
   * @param {number} recipeId Remote recipe Id
   * @param {string} threadRef Local Recipe name
   * @param {number} threadId Local recipe Id
   * @param {object} payload Information to send
   * @param {string} linkId Connection through which to send recipe
   * @returns {number} recipeId
   */
  async sendAction (recipe, recipeId, threadRef, threadId, payload, linkId) {
    const action = {
      recipe,
      recipeId,
      threadRef,
      threadId,
      payload
    }
    if (!this.processing && this.ready) { // execute just in time
      this.processing = true
      const sendPayload = JSON.stringify(action)
      const link = this.wallet.get('links', { linkId })
      await this.matrix.sendMessage(link.roomId, 'm.action', sendPayload)
    } else {
      this.queue.push(action)
    }
    return this.recipeId
  }

  /**
   * Call a recipe, using the intrinsic threadId adn get back the single message
   *
   * @param {string} recipe name
   * @param {*} payload to send with recipe
   * @param {string} AnyId RoomId/LinkId Connection to use
   * @param {number=} threadId thread ID (if not provided use intrinsic thread ID management)
   * @returns {Promise} of message returned
   */
  async callRecipe (recipe, payload = {}, AnyId, threadId = undefined) {
    // use the threadId if provided, otherwise use the common one
    if (threadId === undefined || threadId === 0) {
      threadId = this.threadId++
    }

    const linkId = this.getLinkId(AnyId)
    await this.sendAction(recipe, 0, recipe, threadId, payload, linkId)
    return this.oneMsg(`message:${recipe}`)
  }

  /**
   * Get the DID resolver for the lor namespace, caching as necessary
   *
   * @returns {object} resolver
   */
  getLorResolver () {
    if (!this.lorResolver) {
      this.lorResolver = LorenaDidResolver.getResolver()
    }
    return this.lorResolver
  }

  /**
   * Get the general DID resolver for all namespaces, caching as necessary
   *
   * @returns {object} resolver
   */
  getResolver () {
    if (!this.resolver) {
      this.resolver = new Resolver(this.getLorResolver(), true)
    }
    return this.resolver
  }

  /**
   * Get the specified DID document using the DID resolver
   *
   * @param {string} did to fetch
   * @returns {object} diddoc
   */
  async getDiddoc (did) {
    const diddoc = await this.getResolver().resolve(did)
    return diddoc
  }

  /**
   * Get the matrix User ID for the specified DID
   *
   * @param {string} did to fetch
   * @returns {string} matrixUserID
   */
  async getMatrixUserIDForDID (did) {
    const diddoc = await this.getDiddoc(did)
    const matrixUserID = diddoc.service[0].serviceEndpoint
    return matrixUserID
  }

  /**
   * Get the public key for the specified DID
   *
   * @param {string} did to fetch
   * @returns {string} public key
   */
  async getPublicKeyForDID (did) {
    const diddoc = await this.getDiddoc(did)
    const publicKey = diddoc.authentication[0].publicKey
    return publicKey
  }

  /**
   * Open Connection with another user.
   *
   * @param {string} did DID
   * @param {string} matrixUserID Matrix user ID in format @username:home.server.xxx
   * @param {object} options Object with other options like `alias`
   * @returns {Promise} linkId created, or false
   */
  async createConnection (did, matrixUserID, options = {}) {
    if (matrixUserID === undefined) {
      matrixUserID = await this.getMatrixUserIDForDID(did)
    }

    const link = {
      linkId: uuid(),
      did: false,
      linkDid: did,
      roomId: '',
      roomName: await this.zenroom.random(12),
      keyPair: false,
      matrixUser: matrixUserID,
      status: 'invited',
      alias: '',
      ...options
    }
    return new Promise((resolve, reject) => {
      this.matrix.createConnection(link.roomName, matrixUserID)
        .then((roomId) => {
          link.roomId = roomId
          this.wallet.add('links', link)
          this.emit('change')
          resolve(link.linkId)
        })
        .catch((e) => {
          debug(`createConnection ${e}`)
          resolve(false)
        })
    })
  }

  /**
   * memberOf
   *
   * @param {string} linkId Connection to use
   * @param {string} extra Extra information
   * @param {string} roleName Name fo the role we ask for
   * @returns {Promise} Result of calling recipe member-of
   */
  async memberOf (linkId, extra, roleName) {
    return new Promise((resolve, reject) => {
      let challenge = ''
      let link = {}
      this.zenroom.random(32)
        .then((result) => {
          challenge = result
          return this.wallet.get('links', { linkId })
        })
        .then((result) => {
          if (!result) {
            debug(`did:debug:sdk:memberOf: ${linkId} not found`)
            throw new Error(`memberOf: ${linkId} not found`)
          } else {
            link = result
            this.sendAction('member-of', 0, 'member-of', 1, { challenge }, linkId)
              .then(() => {
                return this.oneMsg('message:member-of')
              })
              .then(async (result) => {
                if (result === false) throw (new Error('Timeout'))
                const key = await this.getPublicKeyForDID(link.linkDid)
                if (key === '') {
                  debug(`memberOf: Public key not found for ${link.did}`)
                  throw new Error(`Public key not found for ${link.did}`)
                }
                const pubKey = {}
                pubKey[link.linkDid] = { public_key: key }
                link.did = result.payload.did
                link.keyPair = await this.zenroom.newKeyPair(link.did)
                const check = await this.zenroom.checkSignature(link.linkDid, pubKey, result.payload.signature, link.did)
                if (check.signature === 'correct') {
                  const person = new Credential.Person(this.wallet.info.person)
                  person.subject.did = link.did
                  const signedCredential = await Credential.signCredential(this.zenroom, person, link.keyPair, link.did)
                  const payload = {
                    did: link.did,
                    extra,
                    roleName,
                    member: signedCredential,
                    publicKey: link.keyPair[link.did].keypair.public_key
                  }
                  return this.sendAction('member-of', result.threadId, 'member-of', 1, payload, linkId)
                } else {
                  debug(`memberOf: checkSignature result ${check}`)
                  throw new Error(`Signature did not match public key ${key}`)
                }
              })
              .then(async (result) => {
                return this.oneMsg('message:member-of')
              })
              .then(async (result) => {
                this.wallet.update('links', { linkId }, {
                  status: 'requested',
                  did: link.did,
                  keyPair: link.keyPair
                })
                this.emit('change')
                resolve(result.payload.msg)
              })
              .catch((e) => {
                reject(e)
              })
          }
        }).catch((e) => {
          reject(e)
        })
    })
  }

  /**
   * memberOfConfirm.
   *
   * @param {string} linkId Connection Identifier
   * @param {string} secretCode secret Code
   * @returns {Promise} of success / error message
   */
  async memberOfConfirm (linkId, secretCode) {
    return new Promise((resolve, reject) => {
      const link = this.wallet.get('links', { linkId })
      if (!link) {
        debug(`memberOfConfirm: ${linkId} is not in links`)
        resolve(false)
      } else {
        this.sendAction('member-of-confirm', 0, 'member-of-confirm', 1, { secretCode }, linkId)
          .then(() => {
            return this.oneMsg('message:member-of-confirm')
          })
          .then(async (result) => {
            if (result === false) throw (new Error('Timeout'))
            if (result.payload.msg === 'member verified') {
              this.wallet.update('links', { linkId }, { status: 'verified' })
              this.wallet.add('credentials', result.payload.credential)
              this.emit('change')
              resolve(result.payload.msg)
            } else {
              resolve(result.payload.msg)
            }
          })
          .catch((e) => {
            reject(e)
          })
      }
    })
  }

  /**
   * Ask to a link for a credential.
   *
   * @param {string} linkId Connection identifier
   * @param {string} credentialType Credential we ask for.
   * @param {number=} threadId thread ID (if not provided use intrinsic thread ID management)
   * @returns {boolean} result
   */
  async askCredential (linkId, credentialType, threadId = undefined) {
    // use the threadId if provided, otherwise use the common one
    if (threadId === undefined) {
      threadId = this.threadId++
    }
    return new Promise((resolve) => {
      const payload = {
        credentialType: credentialType
      }
      this.sendAction('credential-get', 0, 'credential-ask', threadId, payload, linkId)
        .then(() => {
          resolve(true)
        })
    })
  }

  /**
   * Delete a link and leave the room for that link.
   *
   * @param {string} linkId Connection to be removed
   * @returns {Promise} of removing the link and leaving the room
   */
  async deleteLink (linkId) {
    return new Promise((resolve) => {
      const link = this.wallet.get('links', { linkId })
      this.matrix.leaveRoom(link.roomId)
        .then(() => {
          this.wallet.remove('links', { linkId })
          this.emit('change')
          resolve(true)
        }).catch((_e) => {
          resolve(false)
        })
    })
  }

  /**
   * Verify a credential (deprecated: use `verifyCredential()`)
   *
   * @param {*} json of credential to verify
   * @returns {Promise} of success (JSON) or failure (false)
   */
  /* istanbul ignore next */
  async validateCertificate (json) {
    debug('validateCertificate() deprecated: use verifyCredential()')
    return this.verifyCredential(json)
  }

  /**
   * Verify a credential
   *
   * @param {*} json of credential to verify
   * @returns {Promise} of success (JSON) or failure (false)
   */
  async verifyCredential (json) {
    return new Promise((resolve) => {
      try {
        const credential = JSON.parse(json)
        const verified = {
          certificate: credential,
          issuer: credential.issuer
        }

        // get Public Key -> Resolve from Blockchain & Check credential signature
        this.getResolver().resolve(verified.issuer)
          .then((diddoc) => {
            if (!diddoc) {
              throw new Error(`No DID Document for ${verified.issuer}`)
            }
            verified.network = verified.issuer.split(':')[2]
            verified.pubKey = diddoc.authentication[0].publicKey
            verified.checkIssuer = (verified.issuer === diddoc.id)
            return Credential.verifyCredential(this.zenroom, credential, verified.pubKey, verified.issuer)
          })
          .then((result) => {
            verified.checkCertificateSignature = result
            // IPFS DAG : Load Credential from IPFS
            const ipfs = new IpfsClient(LorenaDidResolver.getInfoForNetwork(verified.network).ipfsEndpoint)
            const did = credential.credentialSubject.course.id
            const cid = did.split(':')[3]
            return ipfs.dag.get(cid)
          })
          .then((result) => {
            verified.credential = result.value
            // Verify Credential -> The credential is signed by the Issuer
            return Credential.verifyCredential(this.zenroom, verified.credential, verified.pubKey, verified.issuer)
          })
          .then((result) => {
            verified.checkCredentialSignature = result
            const valid = verified.checkIssuer && verified.checkCertificateSignature && verified.checkCredentialSignature
            resolve({ success: valid, verified })
          })
          .catch((e) => {
            debug(e)
            resolve(false)
          })
      } catch (e) {
        debug(e)
        resolve(false)
      }
    })
  }

  /**
   * Overrides `on` from EventEmitter to dispatch ready if this.ready.
   *
   * @param {string} event Event name
   * @param {Function} cb Callback function
   * @returns {void}
   */
  on (event, cb) {
    if (event === 'ready' && this.ready) return cb()
    return super.on(event, cb)
  }
}
