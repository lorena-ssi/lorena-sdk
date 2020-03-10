const Matrix = require('@lorena-ssi/matrix-lib')
const Zen = require('@lorena-ssi/zenroom-lib')
const Logger = require('./logger')
const logger = new Logger()


class Lorena {
  constructor ( serverPath = 'https://matrix.caelumlabs.com') {
    this.matrixUser = ''
    this.matrixPass = ''
    this.did = ''
    this.matrix = new Matrix(serverPath)
    this.zenroom = { z: new Zen() }
    this.roomId = ''
    this.nextBatch = ''
    this.recipeId = 0
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
    } catch (e) {
      logger.log(e)
      return (new Error('Could not create user'))
    }
    return (true)
  }

  // Commect to Lorena IDSpace.
  async connect (clientCode) {
    // We need three parameters : matrixUser, matrixPass & DID
    const client = clientCode.split('-')
    if (client.length === 3) {
      this.matrixUser = client[0]
      this.matrixPass = client[1]
      this.did = client[2]
      logger.key('Login matrix user', this.matrixUser)
      try {
        await this.matrix.connect(this.matrixUser, this.matrixPass)
        // TODO: No neeed to store token in the database. Use in memory instead.
        const rooms = await this.matrix.joinedRooms()
        this.roomId = rooms[0]
        const events = await this.matrix.events('')
        this.nextBatch = events.nextBatch
        return (true)
      } catch (e) {
        console.log(e)
      }
    }
    return (new Error('Could not connect to Matrix'))
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

  async sendAction (recipe, remoteRecipe, remoteRecipeId, payload) {
    const sendPayload = JSON.stringify({
      recipe: recipe,
      recipeId: 0,
      remoteRecipe: remoteRecipe,
      remoteRecipeId: remoteRecipeId,
      payload: payload
    })
    await this.matrix.sendMessage(this.roomId, 'm.action', sendPayload)
    return this.recipeId
  }
}


let lorena = new Lorena()
process.on("message", async (msg) => {
  switch (msg.action) {
    case 'connect':
      await lorena.connect(msg.connectionString)
      process.send('ready')
      while (true) {
        let events = await lorena.getMessages()
        events.forEach(element => {
          let parsedElement = JSON.parse(element.payload.body)
          process.send(parsedElement)
        })
      }
      break
    case 'm.action':
        await lorena.sendAction (msg.recipe, msg.remoteRecipe, msg.remoteRecipeId, msg.payload) 
      break
  }
})
