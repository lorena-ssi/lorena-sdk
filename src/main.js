const Matrix = require('@lorena-ssi/matrix-lib')
const Zenroom = require('@lorena-ssi/zenroom-lib')
const Credential = require('@lorena-ssi/credential-lib')
const Blockchain = require('@lorena-ssi/substrate-lib')

const { EventEmitter } = require('events')
const log = require('debug')
const debug = log('did:debug:cli')

const didValue = (did) => {
  const didValue = did.split(':')
  return didValue[3]
}
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
    this.blockchain = false
    this.recipeId = 0
    this.queue = []
    this.processing = false
    this.ready = false
    this.nextBatch = ''
    this.disconnecting = false
    this.threadId = 0
  }

  async addDID (username) {
    return new Promise((resolve) => {
      this.zenroom.randomDID()
        .then((did) => {
          resolve(did)
        })
    })
  }

  async initWallet (didMethod) {
    this.wallet.info.blockchainServer = 'wss://' + didMethod + '.substrate.lorena.tech'
    this.wallet.info.matrixFederation = didMethod + '.matrix.lorena.tech'
    this.wallet.info.matrixServer = 'https://' + this.wallet.info.matrixFederation
    this.matrix = new Matrix(this.wallet.info.matrixServer)

    return new Promise((resolve, reject) => {
      this.zenroom.randomDID()
        .then((did) => {
          this.wallet.info.did = 'did:lor:' + didMethod + ':' + did
          return this.zenroom.newKeyPair(this.wallet.info.did)
        })
        .then((keyPair) => {
          this.wallet.info.keyPair = keyPair
          return this.zenroom.random(12)
        })
        .then((matrixUser) => {
          this.wallet.info.matrixUser = matrixUser.toLowerCase()

          return this.zenroom.random(12)
        })
        .then((matrixPass) => {
          this.wallet.info.matrixPass = matrixPass
          return this.matrix.available(this.wallet.info.matrixUser)
        })
        .then((available) => {
          if (available) {
            return this.matrix.register(this.wallet.info.matrixUser, this.wallet.info.matrixPass)
          } else {
            reject(new Error('Could not init wallet'))
          }
        })
        .then(() => {
          resolve(this.wallet.info)
        })
        .catch(() => {
          reject(new Error('Could not init wallet'))
        })
    })
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
          resolve(signCredential)
        })
    })
  }

  lock (password) {
    this.emit('lock', password)
    return this.wallet.lock(password)
  }

  unlock (password) {
    this.emit('unlock', password)
    return this.wallet.unlock(password)
  }

  getContact (roomId) {
    return this.wallet.get('contacts', { roomId: roomId })
  }

  /**
   * memberOf
   *
   * @param {string} roomId Contact Identifier
   * @param {string} extra Extra information
   * @param {string} roleName Name fo the role we ask for
   * @returns {Promise} Result of calling recipr member-of
   */
  memberOf (roomId, extra, roleName) {
    return new Promise((resolve) => {
      let challenge = ''
      this.zenroom.random(32)
        .then((result) => {
          challenge = result
          return this.wallet.get('contacts', { roomId: roomId })
        })
        .then((room) => {
          if (!room) {
            resolve(false)
          } else {
            this.sendAction('member-of', 0, 'member-of', 1, { challenge }, roomId)
              .then(() => {
                return this.oneMsg('message:member-of')
              })
              .then(async (result) => {
                const pubKey = {}
                const key = await this.blockchain.getActualDidKey(didValue(room.did))
                pubKey[room.did] = { public_key: key }
                const check = await this.zenroom.checkSignature(room.did, pubKey, result.payload.signature, this.wallet.info.did)
                if (check.signature === 'correct') {
                  const payload = {
                    did: this.wallet.info.did,
                    extra,
                    roleName,
                    member: this.wallet.data.credentials[0].credential,
                    publicKey: this.wallet.info.keyPair[this.wallet.info.did].keypair.public_key
                  }
                  return this.sendAction('member-of', result.threadId, 'member-of', 1, payload, roomId)
                } else {
                  resolve(false)
                }
              })
              .then(async (result) => {
                return this.oneMsg('message:member-of')
              })
              .then(async (result) => {
                resolve(true)
              })
              .catch((e) => {
                console.log(e)
              })
          }
        })
    })
  }

  /**
   * memberOfConfirm.
   *
   * @param {string} roomId Contact Identifier
   * @param {string} secretCode secret Code
   */
  async memberOfConfirm (roomId, secretCode) {
    return new Promise((resolve) => {
      this.wallet.get('contacts', { roomId: roomId })
        .then((room) => {
          if (!room) resolve(false)
          else {
            this.sendAction('member-of-confirm', 0, 'member-of-confirm', 1, { secretCode }, roomId)
              .then(() => {
                return this.oneMsg('message:member-of-confirm')
              })
              .then(async (result) => {
                if (result.payload.msg === 'member verified') {
                  this.wallet.update('contacts', { roomId: roomId }, { status: 'verified' })
                  this.wallet.add('credentials', result.payload.credential)
                  resolve(result.payload.msg)
                } else {
                  resolve(result.payload.msg)
                }
              })
          }
        })
    })
  }

  /**
   * Connect to Lorena IDSpace.
   */
  async connect () {
    if (this.ready === true) return true
    else if (this.wallet.info.matrixUser) {
      try {
        this.matrix = new Matrix(this.wallet.info.matrixServer)
        await this.matrix.connect(this.wallet.info.matrixUser, this.wallet.info.matrixPass)

        this.blockchain = new Blockchain(this.wallet.info.blockchainServer)
        await this.blockchain.connect()

        const events = await this.matrix.events('')
        this.nextBatch = events.nextBatch
        this.ready = true
        this.processQueue()
        this.emit('ready')
        this.loop()
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
    if (this.blockchain) {
      this.blockchain.disconnect()
    }
  }

  /**
   * Loop through received messages.
   */
  async loop () {
    let parsedElement
    while (!this.disconnecting) {
      const events = await this.getMessages()
      this.processQueue()

      events.forEach(async (element) => {
        try {
          switch (element.type) {
            case 'contact-incoming':
              // add(collection, value)
              this.wallet.add('contacts', {
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
              this.wallet.update('contacts', { roomId: element.roomId }, {
                status: 'connected'
              })
              // await this.matrix.acceptConnection(element.roomId)
              this.emit('contact-added', element.sender)
              this.emit('change')
              break
            default:
              parsedElement = JSON.parse(element.payload.body)
              parsedElement.roomId = element.roomId
              this.emit(`message:${parsedElement.recipe}`, parsedElement)
              this.emit('message', parsedElement)
              break
          }
        } catch (_e) {
          console.log(_e)
          this.emit('warning', 'element unknown')
        }
      })
    }
  }

  /**
   * get All messages
   *
   * @returns {*} events
   */
  async getMessages () {
    let result = await this.matrix.events(this.nextBatch)
    // If empty (try again)
    if (result.events.length === 0) {
      result = await this.matrix.events(this.nextBatch)
    }
    this.nextBatch = result.nextBatch
    return (result.events)
  }

  /**
   * process Outgoing queue of messages
   */
  async processQueue () {
    if (this.queue.length > 0) {
      const sendPayload = JSON.stringify(this.queue.pop())
      await this.matrix.sendMessage(this.wallet.info.roomId, 'm.action', sendPayload)
    }
    if (this.queue.length === 0) {
      this.processing = false
    }
  }

  /**
   * Waits for something to happen only once
   *
   * @param {string} msg Message to be listened to
   * @param {number} timeout for the call
   * @returns {Promise} Promise with the result
   */
  oneMsg (msg, timeout = 5000) {
    return Promise.race(
      [
        new Promise((resolve) => {
          this.once(msg, (data) => {
            resolve(data)
          })
        }),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), timeout))
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
   * @param {string} roomId Contact to send recipe to
   */
  async sendAction (recipe, recipeId, threadRef, threadId, payload, roomId = false) {
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
      const sendTo = (roomId === false) ? this.wallet.info.roomId : roomId
      await this.matrix.sendMessage(sendTo, 'm.action', sendPayload)
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
   * @param {string} roomId room ID
   * @param {number=} threadId thread ID (if not provided use intrinsic thread ID management)
   * @returns {Promise} of message returned
   */
  async callRecipe (recipe, payload = {}, roomId, threadId = undefined) {
    // use the threadId if provided, otherwise use the common one
    if (threadId === undefined || threadId === 0) {
      threadId = this.threadId++
    }
    await this.sendAction(recipe, 0, recipe, threadId, payload, roomId)
    return this.oneMsg(`message:${recipe}`)
  }

  /**
   * Open Connection with another user.
   *
   * @param {string} matrixUser Matrix user ID
   * @param {string} did DID
   */
  async createConnection (matrixUser, did) {
    const roomName = await this.zenroom.random(12)
    return new Promise((resolve, reject) => {
      this.matrix.createConnection(roomName, matrixUser)
        .then((roomId) => {
          this.wallet.add('contacts', {
            roomId,
            alias: '',
            did: did,
            matrixUser,
            status: 'invited'
          })
          resolve(true)
        })
        .catch(() => {
          resolve(false)
        })
    })
  }

  /**
   * Ask to a contact for a credential.
   *
   * @param {string} roomId Contact identifier
   * @param {string} credentialType Credential we ask for.
   * @param {number=} threadId thread ID (if not provided use intrinsic thread ID management)
   * @returns {boolean} result
   */
  async askCredential (roomId, credentialType, threadId = undefined) {
    // use the threadId if provided, otherwise use the common one
    if (threadId === undefined) {
      threadId = this.threadId++
    }
    return new Promise((resolve) => {
      const payload = {
        credentialType: credentialType
      }
      this.sendAction('credential-get', 0, 'credential-ask', threadId, payload, roomId)
        .then(() => {
          resolve(true)
        })
    })
  }

  /**
   * Delete a contact and leave the room for that contact.
   *
   * @param {string} roomId Contact to be removed
   */
  async deleteConnection (roomId) {
    return new Promise((resolve) => {
      this.matrix.leaveRoom(roomId)
        .then((roomId) => {
          this.wallet.add('contacts', {
            roomId,
            alias: '',
            did: '',
            matrixUser: '',
            status: 'invited'
          })
          resolve()
        })
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
