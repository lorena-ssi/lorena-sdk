import Matrix from '@lorena-ssi/matrix-lib'
import Zenroom from '@lorena-ssi/zenroom-lib'
import Blockchain from '@lorena-ssi/substrate-lib'

// import Credential from '@lorena-ssi/credential-lib'

import log from 'debug'
import { EventEmitter } from 'events'

const debug = log('did:debug:cli')
const error = log('did:error:cli')

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
  }

  lock (password) {
    this.emit('lock', password)
    return this.wallet.lock(password)
  }

  unlock (password) {
    this.emit('unlock', password)
    return this.wallet.unlock(password)
  }

  /**
   * new Client.
   *
   * @param {string} connString Encrypted connection String
   * @param {string} pin PIN
   * @param {string} username Username
   */
  async newClient (connString, pin, username) {
    return new Promise((resolve) => {
      const conn = connString.split('-!-')
      const m = { secret_message: { checksum: conn[0], header: conn[1], iv: conn[2], text: conn[3] } }
      this.zenroom.decryptSymmetric(pin, m)
        .then((clientCode) => {
          const client = clientCode.message.split('-!-')
          this.wallet.info.username = username
          const matrix = client[0].split(':')
          this.wallet.info.matrixUser = matrix[0].substr(1)
          this.wallet.info.matrixServer = 'https://' + matrix[1]
          this.wallet.info.matrixFederation = ':' + matrix[1]
          this.wallet.info.matrixPass = client[1]
          this.wallet.info.did = client[2]
          this.wallet.info.blockchainServer = client[3]
          this.matrix = new Matrix(this.wallet.info.matrixServer)
          return this.matrix.connect(this.wallet.info.matrixUser, this.wallet.info.matrixPass)
        })
        .then(() => {
          return this.matrix.events('')
        })
        .then((result) => {
          this.wallet.info.roomId = result.events[0].roomId
          return this.matrix.acceptConnection(result.events[0].roomId)
        })
        .then(() => {
          return this.zenroom.newKeyPair(username)
        })
        .then((keyPair) => {
          this.wallet.info.keyPair = keyPair
          resolve(true)
        })
        .catch((e) => {
          console.log(e)
          resolve(false)
        })
    })
  }

  /**
   * Connect to Lorena IDSpace.
   */
  async connect () {
    if (this.ready === true) return true
    try {
      this.matrix = new Matrix(this.wallet.info.matrixServer)
      await this.matrix.connect(this.wallet.info.matrixUser, this.wallet.info.matrixPass)
      this.blockchain = new Blockchain(this.wallet.info.blockchainServer)
      await this.blockchain.connect()

      // TODO: No need to store token in the database. Use in memory instead.
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

  /**
   * Loop through received messages.
   */
  async loop () {
    let parsedElement
    while (true) {
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
                didMethod: '',
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
              console.log('EMIT contact-added')
              this.emit('contact-added', element.sender)
              console.log('EMIT change')
              this.emit('change')
              break
            default:
              parsedElement = JSON.parse(element.payload.body)
              parsedElement.roomId = element.roomId
              console.log('RECIPE : ' + parsedElement.recipe)
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
   * @returns {Promise} Promise with the result
   */
  oneMsg (msg) {
    return Promise.race(
      [
        new Promise((resolve) => {
          this.once(msg, (data) => {
            resolve(data)
          })
        }),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
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
   * Does the handshake
   *
   * @param {number} threadId Local Thread unique ID
   * @returns {boolean} result
   */
  async handshake (threadId) {
    const did = this.wallet.info.did
    const username = this.wallet.info.username
    const random = await this.zenroom.random()
    const pubKey = {}
    return new Promise((resolve, reject) => {
      this.blockchain.getActualDidKey(did)
        .then((key) => {
          pubKey[did] = { public_key: key }
          return this.sendAction('contact-handshake', 0, 'handshake', threadId, { challenge: random })
        })
        .then(() => {
          return this.oneMsg('message:handshake')
        })
        .then(async (handshake) => {
          const check = await this.zenroom.checkSignature(did, pubKey, handshake.payload.signature, did)
          const buffer64 = Buffer.from(random).toString('base64').slice(0, -1)
          const signOk = (check.signature === 'correct') && (handshake.payload.signature[did].draft === buffer64)
          if (signOk) {
            const signature = await this.zenroom.signMessage(username, this.wallet.info.keyPair, handshake.payload.challenge)
            return this.sendAction('contact-handshake', handshake.threadId, 'handshake', threadId, { signature: signature, keyPair: this.wallet.info.keyPair, username: username })
          } else {
            return this.sendAction('contact-handshake', handshake.threadId, 'handshake', threadId, { signature: 'incorrect' })
          }
        })
        .then(() => {
          return this.oneMsg('message:handshake')
        })
        .then(async (received) => {
          this.wallet.info.did = received.payload.did
          this.wallet.info.didMethod = received.payload.didMethod
          this.wallet.info.didBase = received.payload.didBase
          this.wallet.add('credentials', received.payload.credential)
          resolve(true)
        })
        .catch((e) => {
          error(e)
          reject(new Error(e))
        })
    })
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
            didMethod: '',
            matrixUser,
            status: 'invited'
          })
          resolve()
        })
    })
  }

  /**
   * Ask to a contact for a credential.
   *
   * @param {string} roomId Contact identifier
   * @param {string} credentialType Credential we ask for.
   * @param {number} threadId Local Thread.
   * @returns {boolean} result
   */
  async askCredential (roomId, credentialType, threadId) {
    return new Promise((resolve) => {
      const payload = {
        credentialType: credentialType
      }
      this.sendAction('credential-get', 0, 'credential-ask', threadId, payload, roomId)
        .then(() => {
          console.log('ASKED')
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
            didMethod: '',
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
