import Matrix from '@lorena-ssi/matrix-lib'
import Blockchain from '@lorena-ssi/substrate-lib'

// import Credential from '@lorena-ssi/credential-lib'

import log from 'debug'
import { EventEmitter } from 'events'

const DEFAULT_SERVER = process.env.SERVER ? process.env.SERVER : 'https://matrix.caelumlabs.com'
const BLOCKCHAIN_SERVER = process.env.SERVER ? process.env.SERVER : 'ws://127.0.0.1:9944'
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
  constructor (walletHandler, opts) {
    super()
    this.opts = opts
    if (opts.debug) debug.enabled = true

    this.wallet = walletHandler
    this.matrix = new Matrix(DEFAULT_SERVER)
    this.blockchain = new Blockchain(BLOCKCHAIN_SERVER)
    this.recipeId = 0
    this.queue = []
    this.processing = false
    this.ready = false
    this.nextBatch = ''
  }

  lock (username, password) {
    return this.wallet.lock(username, password)
  }

  unlock (password) {
    return this.wallet.unlock(password)
  }

  /**
   * new Client.
   *
   * @param {string} connString Encrypted connection String
   * @param {string} pin PIN
   * @param {string} password Password to Store Configuration
   */
  async newClient (connString, pin, password) {
    return new Promise((resolve) => {
      const conn = connString.split('-!-')
      const m = { secret_message: { checksum: conn[0], header: conn[1], iv: conn[2], text: conn[3] } }
      this.zenroom.decryptSymmetric(pin, m)
        .then((clientCode) => {
          console.log(clientCode)
          const client = clientCode.message.split('-!-')
          this.wallet.info.matrixUser = client[0]
          this.wallet.info.matrixPass = client[1]
          this.wallet.info.did = client[2]
          return this.matrix.connect(this.wallet.info.matrixUser, this.wallet.info.matrixPass)
        })
        .then(() => {
          return this.matrix.joinedRooms()
        })
        .then((rooms) => {
          this.wallet.info.roomId = rooms[0]
          return this.zenroom.newKeyPair(this.wallet.info.did)
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
      await this.matrix.connect(this.wallet.info.matrixUser, this.wallet.info.matrixPass)
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
    while (true) {
      const events = await this.getMessages()
      this.processQueue()

      events.forEach(element => {
        try {
          const parsedElement = JSON.parse(element.payload.body)
          this.emit(`message:${parsedElement.recipe}`, parsedElement)
          this.emit('message', parsedElement)
        } catch (_e) {
          console.log(_e)
          this.emit('warning', 'element unknown')
        }
      })
    }
  }

  /**
   * get All maessages
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
      await this.matrix.sendMessage(this.roomId, 'm.action', sendPayload)
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
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]
    )
  }

  /**
   * Sends an action to another DID
   *
   * @param {string} recipe Remote recipe name
   * @param {number} recipeId Remote recipe Id
   * @param {string} threadRef Local Recipe name
   * @param {number} threadId Local recipr Id
   * @param {object} payload Information to send
   */
  async sendAction (recipe, recipeId, threadRef, threadId, payload) {
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
      await this.matrix.sendMessage(this.wallet.info.roomId, 'm.action', sendPayload)
    } else {
      this.queue.push(action)
    }
    return this.recipeId
  }

  /**
   * DOes the handshake
   *
   * @param {number} threadId Local Thread unique ID
   */
  async handshake (threadId) {
    const did = this.wallet.info.did
    const random = await this.zenroom.random()
    const pubKey = {}
    return new Promise((resolve, reject) => {
      this.blockchain.getActualDidKey(did)
        .then((key) => {
          pubKey[did] = { public_key: key }
          console.log(did)
          console.log(pubKey)
          return this.sendAction('contact-handshake', 0, 'handshake', threadId, { challenge: random })
        })
        .then(() => {
          return this.oneMsg('message:handshake')
        })
        .then(async (handshake) => {
          console.log('Check signature')
          console.log(pubKey)
          const check = await this.zenroom.checkSignature(did, pubKey, handshake.payload.signature, did)
          const buffer64 = Buffer.from(random).toString('base64').slice(0, -1)
          const signOk = (check.signature === 'correct') && (handshake.payload.signature[did].draft === buffer64)
          if (signOk) {
            const signature = await this.zenroom.signMessage(did, this.wallet.info.keyPair, handshake.payload.challenge)
            return this.sendAction('contact-handshake', handshake.threadId, 'handshake', threadId, { signature: signature, keyPair: this.wallet.info.keyPair, name: this.wallet.info.name })
          } else {
            return this.sendAction('contact-handshake', handshake.threadId, 'handshake', threadId, { signature: 'incorrect' })
          }
        })
        .then(() => {
          return this.oneMsg('message:handshake')
        })
        .then(async (received) => {
          console.log('new DID = ' + received.payload.did)
          this.wallet.info.did = received.payload.did

          resolve(true)
        })
        .catch((e) => {
          error(e)
          reject(new Error(e))
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
