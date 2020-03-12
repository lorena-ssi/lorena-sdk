const Matrix = require('@lorena-ssi/matrix-lib')
const Zen = require('@lorena-ssi/zenroom-lib')
const Logger = require('./logger')
const logger = new Logger()
const { EventEmitter } = require('events')

class Lorena extends EventEmitter {
  constructor (serverPath = 'https://matrix.caelumlabs.com') {
    super()
    this.matrixUser = ''
    this.matrixPass = ''
    this.did = ''
    this.matrix = new Matrix(serverPath)
    this.zenroom = { z: new Zen() }
    this.roomId = ''
    this.nextBatch = ''
    this.recipeId = 0
    this.queue = []
    this.processing = false
    this.ready = false
  }

  // Create Matrix user and zenroom keypair
  async createUser (username, password) {
    try {
      const available = await this.matrix.available(username)
      if (available) {
        this.matrixUser = username
        this.did = username
        this.matrixPass = password
        await this.matrix.register(username, password)
        // Update variables `matrixUser`, `matrixPass`, and `did`
        this.matrixUser = username
        this.matrixPass = password
        this.did = username
      } else {
        return (false)
      }
      const keyPair = await this.zenroom.z.newKeyPair(username)
      this.zenroom.keypair = keyPair[username].keypair
    } catch (error) {
      logger.log(error)
      this.emit('error', error)
      throw new Error('Could not create user')
    }
    return true
  }

  // Connect to Lorena IDSpace.
  async connect (clientCode) {
    if (this.ready === true) return true
    // We need three parameters : matrixUser, matrixPass & DID
    const client = clientCode.split('-')
    if (client.length === 3) {
      this.matrixUser = client[0]
      this.matrixPass = client[1]
      this.did = client[2]
      logger.key('Login matrix user', this.matrixUser)
      try {
        await this.matrix.connect(this.matrixUser, this.matrixPass)

        // TODO: No need to store token in the database. Use in memory instead.
        const rooms = await this.matrix.joinedRooms()
        this.roomId = rooms[0]
        const events = await this.matrix.events('')
        this.nextBatch = events.nextBatch
        this.ready = true
        this.processQueue()
        this.emit('ready')
        this.loop()
        return true
      } catch (error) {
        logger.log(error)
        this.emit('error', error)
        throw error
      }
    }
  }

  async loop () {
    while (true) {
      const events = await this.getMessages()
      this.processQueue()

      events.forEach(element => {
        const parsedElement = JSON.parse(element.payload.body)
        this.emit(`message:${parsedElement.remoteRecipe}`, parsedElement)
        this.emit('message', parsedElement)
      })
    }
  }

  async getMessages () {
    let result = await this.matrix.events(this.nextBatch)
    // If empty (try again)
    if (result.events.length === 0) {
      result = await this.matrix.events(this.nextBatch)
    }
    this.nextBatch = result.nextBatch
    return (result.events)
  }

  async processQueue () {
    if (this.queue.length > 0) {
      const sendPayload = JSON.stringify(this.queue.pop())
      await this.matrix.sendMessage(this.roomId, 'm.action', sendPayload)
    }
    if (this.queue.length === 0) {
      this.processing = false
    }
  }

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
      await this.matrix.sendMessage(this.roomId, 'm.action', sendPayload)
    } else {
      this.queue.push(action)
    }
    return this.recipeId
  }
}

module.exports = Lorena
