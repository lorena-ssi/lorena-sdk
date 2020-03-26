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
    await lorena.newClient(connString, pin, username)

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
    terminal(lorena, wallet)
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
 * @param {object} wallet Local information (wallet)
 */
const terminal = async (lorena, wallet) => {
  let input, list, payload
  const history = []
  const autoComplete = ['info', 'exit', 'help', 'pubkey', 'ping', 'ping-remote', 'ping-admin', 'contact-list', 'contact-invite', 'contact-add', 'contact-info', 'peer-add', 'peer-list', 'contact-handshake', 'recipe-list']

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
      console.log(wallet.info)
      break
    case 'pubkey':
      term.gray('Public Key :\n')
      console.log(wallet.info.keyPair[wallet.info.username].keypair.public_key)
      break
    case 'contact-invite':
      payload = {}
      term.gray('First Name : ')
      payload.givenName = await term.inputField().promise
      term.gray('\nLast Name 1: ')
      payload.familyName = await term.inputField().promise
      term.gray('\nLast Name 2: ')
      payload.additionalName = await term.inputField().promise
      term.gray('\nDNI : ')
      payload.propertyID = await term.inputField().promise
      term.gray('\nTelephone : ')
      payload.telephone = await term.inputField().promise
      term.gray('\n')
      list = await callRecipe(lorena, input, payload)
      console.log(list)
      break
    case 'ping':
    case 'ping-admin':
      await callRecipe(lorena, input)
      break
    case 'contact-list':
      list = await callRecipe(lorena, input, { filter: 'all' })
      console.log(list)
      break
    case 'recipe-list':
      list = await callRecipe(lorena, input)
      console.log(list)
      break
    case 'ping-remote':
    case 'contact-info':
      term.gray('DID : ')
      payload = await term.inputField().promise
      term('\n')
      list = await callRecipe(lorena, input, { did: payload })
      console.log(list)
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
      payload = {}
      term.gray('DID : ')
      // payload.did = await term.inputField().promise
      term.gray('\nmatrix : ')
      // payload.matrix = await term.inputField().promise
      term.gray('\n')

      payload.did = 'ckc0Tzk0Ulk4enhtV0tRN3k4am1nMkRqmatrix'
      payload.matrix = '@fhfzp1-2ffrf0xe2:matrix.caelumlabs.com'

      term.gray('\n')
      await lorena.createConnection(payload.matrix, payload.did)

      break
    case 'exit':
    case 'quit':
    case 'q':
      if (lorena.wallet.info.changed === true) {
        term.gray('\nChanges to the conf file')
        term.gray('\npassword : ')
        payload = await term.inputField().promise
        lorena.lock(payload)
      }
      process.exit()
  }
  terminal(lorena, wallet)
}

main()
