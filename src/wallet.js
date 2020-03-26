import Zenroom from '@lorena-ssi/zenroom-lib'
import fs from 'fs'
import path from 'path'
const os = require('os')
const home = os.homedir()

export default class Wallet {
  constructor (username) {
    this.filePath = home + '/.lorena/data/' + username + '.json'
    this.zenroom = new Zenroom()
    // info
    this.info = {
      matrixUser: '',
      matrixPass: '',
      did: '',
      roomId: '',
      keyPair: {},
      credential: {},
      contacts: []
    }
  }

  /**
   *
   * @param {string} password Pass
   */
  async unlock (password) {
    return new Promise((resolve) => {
      if (fs.existsSync(this.filePath)) {
        fs.readFile(this.filePath, 'utf8', (err, data) => {
          if (err) {
            resolve(false)
          }
          const secret = JSON.parse(data)
          this.zenroom.decryptSymmetric(password, secret)
            .then((clientCode) => {
              const buff = Buffer.from(clientCode.message, 'base64')
              this.info = JSON.parse(buff.toString())
              resolve(this.info)
            })
        })
      } else {
        resolve(false)
      }
    })
  }

  /**
   * Encrypt and save configuration.
   *
   * @param {string} password Password to encrypt configuration
   */
  async lock (password) {
    return new Promise((resolve) => {
      this.info.changed = false
      const msg = JSON.stringify(this.info)
      const buff = Buffer.from(msg)
      this.zenroom.encryptSymmetric(password, buff.toString('base64'), 'local Storage')
        .then((encryptedConf) => {
          const confDir = path.dirname(this.filePath)
          fs.promises.mkdir(confDir, { recursive: true })
            .then(() => {
              fs.writeFileSync(this.filePath, JSON.stringify(encryptedConf))
              resolve(true)
            })
        })
        .catch((e) => {
          console.log(e)
        })
    })
  }

  addContact (roomId, matrixUser, status) {
    this.info.changed = true
    if (!this.info.contacts) {
      this.info.contacts = {}
    }
    this.info.contacts[roomId] = {
      alias: '',
      did: '',
      didMethod: '',
      matrixUser: matrixUser,
      status: status
    }
  }

  updateContact (roomId, key, value) {
    this.info.changed = true
    this.info.contacts[roomId][key] = value
  }
}
