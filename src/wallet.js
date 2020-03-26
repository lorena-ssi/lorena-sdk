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
      name: '',
      matrixUser: '',
      matrixPass: '',
      did: '',
      roomId: '',
      keyPair: {},
      credential: {}
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
              this.info = JSON.parse(clientCode.message)
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
   * @param {object} info info to lock
   */
  async lock (password) {
    return new Promise((resolve) => {
      const msg = JSON.stringify(this.info)
      this.zenroom.encryptSymmetric(password, msg, 'local Storage')
        .then((encryptedConf) => {
          const confDir = path.dirname(this.filePath)
          fs.promises.mkdir(confDir, { recursive: true })
            .then(() => {
              fs.writeFileSync(this.filePath, JSON.stringify(encryptedConf))
              resolve(true)
            })
        })
    })
  }
}
