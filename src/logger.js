'use strict'
const chalk = require('chalk')
const log = console.log

const titleColor = '#FBEEC1'
const logColor = '#CCCCCC'
const keyColor = '#007711'
const errorColor = '#990000'

/**
 * Javascript Class to interact with the Console.
 */
module.exports = class Logger {
  title (title, text) {
    log('\n' + chalk.hex(titleColor).underline.bold(title) + '\n' + chalk.hex(titleColor)(text))
  }

  log (text) {
    log(chalk.hex(logColor)(text))
  }

  key (title, key, value) {
    log(chalk.hex(logColor)(title) + ' ' + chalk.hex(keyColor)(key))// + '\n' + chalk.hex(keyColor).bold(value))
  }

  error (text) {
    log(chalk.hex(errorColor)(text))
  }

  debug (text) {
    log(text)
  }
}
