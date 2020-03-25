#!/usr/bin/env node
import Wallet from './wallet'
var term = require('terminal-kit').terminal
const Lorena = require('../src/index.js').default

let threadId = 0

term.on('key', function (name, matches, data) {
  if (name === 'CTRL_C') {
    term.grabInput(false)
    setTimeout(function () { process.exit() }, 100)
  }
})

term.magenta('Lorena ^+Client^\n')

const main = async () => {
  term.gray('\nUsername :')
  const username = await term.inputField().promise
  // const username = 'alex'

  term.gray('\nPassword :')
  const password = await term.inputField().promise
  // const password = 'nikola'
  const wallet = new Wallet(username)
  const lorena = new Lorena(wallet, { debug: true })
  term.gray('\nConnecting...')
  // get basic configuration
  const conf = await lorena.unlock(password)
  if (conf === false) {
    // First Time.
    term.cyan('Creating new connection')
    term.gray('\nConnection String :')
    const connString = await term.inputField().promise
    // const connString = 'Ygg7QhoNdbPmP1UTqnl22w-#-NDM2ZjZlNmU2NTYzNzQ2OTZmNmUyMDUzNzQ3MjY5NmU2Nw-#-jWDo3rHGqwMn3jnfRbBtNLmdsaC2UMzyura2dySL4Os-#-OKESp6vasShke5HVunTL5POsfEAyK33QnCDqzDGJKXFp_INhqkBaKM8i6ftlg1deyoZq6MMIaQUIZuEsFFjMNMGpRmYgtnOIKXFsJ9GhZ5kiV775EfeeXnwoh7o'

    term.gray('\nPIN :')
    const pin = await term.inputField().promise
    // const pin = '223447'
    term.cyan('\nOpen connection')
    await lorena.newClient(connString, pin, password)

    // Connect
    await lorena.connect()

    // Do the handshake with the server
    term.cyan('\nHandshake : get DID')
    await lorena.handshake(threadId++)

    // Save config.
    term.cyan('\nSave config')
    await lorena.lock(password)
  } else {
    await lorena.connect()
  }

  lorena.on('error', (e) => {
    term('ERROR!!', e)
  })
  lorena.on('ready', async () => {
    term('^+connected^\n')
    terminal(lorena)
  })

  lorena.on('message:pong', (payload) => {
    // term( '^+received ^\n' )
  })
}

/**
 * Calls a remote recipe.
 *
 * @param {object} lorena Lorena Object
 * @param {string} recipe Recipe Ref to be called
 * @param {object} payload Payload
 */
const callRecipe = async (lorena, recipe, payload = {}) => {
  return new Promise((resolve, reject) => {
    term.gray(recipe + '...')
    lorena.sendAction(recipe, 0, recipe, threadId++, payload)
      .then(() => {
        return lorena.oneMsg('message:' + recipe)
      })
      .then((result) => {
        const total = (Array.isArray(result.payload) ? result.payload.length : 1)
        term('^+done^ - ' + total + ' results\n')
        resolve(result.payload)
      })
      .catch((error) => {
        term.gray(`^+${error.message}^\n`)
        resolve(false)
      })
  })
}

/**
 * Opens the terminal
 *
 * @param {object} lorena Lorena Obkect
 */
const terminal = async (lorena) => {
  let input, list
  const history = []
  const autoComplete = ['info', 'ping', 'ping-remote', 'contact-list', 'exit', 'help', 'contact-add', 'contact-info', 'peer-add', 'peer-list', 'contact-handshake', 'recipe-list']

  term.magenta('lorena# ')
  input = await term.inputField({ history: history, autoComplete: autoComplete, autoCompleteMenu: true }).promise
  term('\n')
  switch (input) {
    case 'help':
      term.gray('actions :\n')
      console.log(autoComplete)
      break
    case 'info':
      term.gray('info :\n')
      console.log(lorena.info)
      break
    case 'ping':
      await callRecipe(lorena, input)
      break
    case 'contact-list':
    case 'recipe-list':
      list = await callRecipe(lorena, input)
      console.log(list)
      break
    case 'ping-remote':
    case 'contact-info':
      term.gray('DID : ')
      input = await term.inputField().promise
      await callRecipe(lorena, input, { did: input })
      break
    case 'contact-handshake':
      term.gray('handshake...')
      await lorena.handshake(threadId++)
      term('^+done^\n')
      break
    case 'peer-add':
      input = {}
      term.gray('Name : ')
      input.name = await term.inputField().promise
      term.gray('\nEmail : ')
      input.email = await term.inputField().promise
      term.gray('\nRole : ')
      var items = ['Admin', 'Developer', 'Business']
      input.role = await term.singleColumnMenu(items).promise
      await callRecipe(lorena, 'peer-add', 0, 'peer-add', threadId++, input)
      break
    case 'contact-add':
      term.gray('DID : ')
      input = await term.inputField().promise
      await callRecipe(lorena, 'contact-add', 0, 'add', threadId++, {
        did: input,
        matrix: '@' + input + ':matrix.caelumlabs.com'
      })
      break
    case 'exit':
    case 'quit':
    case 'q':
      process.exit()
  }
  terminal(lorena)
}

main()
