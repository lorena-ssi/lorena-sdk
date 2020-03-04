const Matrix = require('@lorena-ssi/matrix-lib')
const Logger = require('./logger')
const logger = new Logger()

module.exports = class Lorena {

    constructor(clientCode) {
        this.matrix = new Matrix('https://matrix.caelumlabs.com')
        const client = clientCode.split('-')
        this.matrixUser = client[0]
        this.matrixPass = client[1]
        this.did = client[2]
        this.roomId = ''
        this.nextBatch = ''
        this.recipeId = 0
    }

    // Commect to Lorena IDSpace.
    async connect() {
        return new Promise(async (resolve, reject) => {
            logger.key('Login matrix user', this.matrixUser)
            try {
                await this.matrix.connect(this.matrixUser, this.matrixPass)
                // TODO: No neeed to store token in the database. Use in memory instead.
                const rooms = await this.matrix.joinedRooms()
                this.roomId = rooms[0]
                let events = await this.matrix.events('')
                this.nextBatch = events.nextBatch
                resolve(true)
            } catch (e) {
                console.log(e)
                reject(new Error('Could not connect to Matrix'))
            }
        })
    }

    async getMessages() {
        return new Promise(async (resolve, reject) => {
            let result = await this.matrix.events(this.nextBatch)
            // If empty (try again)
            if (result.events.length === 0 ){
                result = await this.matrix.events(this.nextBatch)
            }
            this.nextBatch = result.nextBatch
            resolve( result.events)
        })
    }

    async sendText(payload) {
        await this.matrix.sendMessage(this.roomId, 'm.text', payload)
    }

    async sendAction(recipe, payload) {
        this.recipeId++
        const sendPayload = JSON.stringify({
            recipe: recipe,
            recipeId: 0,
            remoteRecipe:'ping',
            remoteRecipeId: this.recipeId,
            payload: payload
          })
        await this.matrix.sendMessage(this.roomId, 'm.action', sendPayload)
    }

    async getMessage() {
        // await this.matrix.sendMessage(this.roomId, 'm.text', payload)
    }

    async sendMessage(recipe, payload) {
        const body = JSON.stringify({
            recipe: recipe,
            recipeId: 0,
            remoteRecipe: recipe,
            remoteRecipeId: store.state.txnId,
            payload: payload
        })
        await this.matrix.sendMessage(this.roomId, 'm.action', body)
    }

    waitAnswer(recipeId) {
        EventSource
    }
}