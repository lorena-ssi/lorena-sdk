var mitt = require('mitt')

class Mitt {
  constructor (e) {
    Object.assign(this, mitt(e))
  }
}

module.exports = Mitt
