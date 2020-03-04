'use strict'
const axios = require('axios')

// Logger
const Logger = require('./logger')
const logger = new Logger()

/**
 * Javascript Class to interact with Zenroom.
 */
module.exports = class Matrix {
    constructor (homeserver = process.env.SERVER_MATRIX) {
      this.api = homeserver + '/_matrix/client/r0/'
      this.connection = {}
      this.txnId = 1
    }

    /**
    * Connects to a matrix server.
    *
    * @param {string} username Matrix username
    * @param {string} password Matrix password
    * @returns {Promise} Return a promise with the connection when it's done.
    */
    async connect (username, password) {
        return new Promise((resolve, reject) => {
            axios.get(this.api + 'login')
            .then(async () => {
                const result = await axios.post(this.api + 'login', {
                    type: 'm.login.password',
                    user: username,
                    password: password
                })
                this.connection = result.data
                resolve(result.data.access_token)
            })
            .catch((_error) => {
                /* istanbul ignore next */
                reject('Could not connect to Matrix' + _error)
            })
        })
    }

    /**
    * Register user
    *
    * @param {string} username Matrix username
    * @param {string} password Matrix password
    * @returns {Promise} result
    */
    async register (username, password) {
        return new Promise((resolve, reject) => {
            axios.post(this.api + 'register', {
                auth: { type: 'm.login.dummy' },
                username: username,
                password: password
            })
            .then(async (res) => {
            resolve(username)
            })
            .catch((error) => {
            /* istanbul ignore next */
            reject(error)
            })
        })
    }

    /**
    * Checks if the username is available
    *
    * @param {string} username to check
    * @returns {Promise} of true if username is available
    */
    async available (username) {
        return new Promise((resolve, reject) => {
        axios.get(this.api + 'register/available?username=' + username)
            .then(async (res) => {
            resolve(true)
            })
            .catch((_error) => {
            /* istanbul ignore next */
            resolve(false)
            })
        })
    }
}  