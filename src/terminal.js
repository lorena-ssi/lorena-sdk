#!/usr/bin/env node
const term = require('terminal-kit').terminal
const Lorena = require('../src/index').default
const Wallet = require('@lorena-ssi/wallet-lib').default

let connected = false
let username = ''
let password = ''

term.on('key', function (name, matches, data) {
  if (name === 'CTRL_C') {
    term.grabInput(false)
    setTimeout(function () { process.exit() }, 100)
  }
})

term.magenta('Lorena ^+Client^\n')

// Main.
const main = async () => {
  // Username & password.
  term.gray('\nUsername :')
  username = await term.inputField().promise
  term.gray('\nPassword :')
  password = await term.inputField().promise

  // Open Wallet and connect to Lorena
  const wallet = new Wallet(username)
  const lorena = new Lorena(wallet, { debug: true, silent: true })
  if (await lorena.unlock(password)) {
    term.gray('\nWallet open\n')
    lorena.connect()
    terminal(lorena, wallet)
  } else {
    // No wallet.
    term.gray('\nA Wallet for ' + username + ' Does not exist')
    term('\nCreate One (Y/N)\n')
    if (await term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }).promise) {
      // Save config.

      await lorena.addKeyPair()
      term.cyan('\nKey Pair Added')
      term.cyan('\nSave Storage\n\n')
      await lorena.lock(password)
      terminal(lorena, wallet)
    } else {
      process.exit()
    }
  }

  // Listen to Lorena messages.
  lorena.on('error', (e) => {
    term('ERROR!!', e)
  })
  lorena.on('ready', async () => {
    term('^+connected^\n')
    connected = true
  })

  // Someone's asking for a credential we have.
  lorena.on('message:credential-get', async (payload) => {
    term('\n^Is asking for a credential ^')
    term('\n^Share Credential (Y/N) ^\n')
    const shareCredential = await term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }).promise
    if (shareCredential) {
      const cred = lorena.wallet.data.credentials[0]
      console.log(payload)
      lorena.sendAction(payload.threadRef, payload.threadId, 'credential-get', 0, cred, payload.roomId)
      term('\n^Credential Sent^\n')
    }
  })

  // Someone sent a credential to us.
  lorena.on('message:credential-ask', async (payload) => {
    term('\n^Received credential ^')
    console.log(payload)
  })

  // We received a new Action.
  lorena.on('message:action-post', async (payload) => {
    term('\n^Received action ^')
    console.log(payload)
  })

  // Someone¡'s contacting with us.
  lorena.on('contact-incoming', (payload) => {
    term('\n^+Contact invitation Incoming from ^' + payload + ' \n')
  })

  // A new contact has been added (accepted).
  lorena.on('contact-added', (payload) => {
    term('\n^+Contact invitation Accepted from ^' + payload + ' \n')
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
    lorena.callRecipe(recipe, payload)
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
 * @param {object} lorena Lorena Object
 * @param {object} wallet Local information (wallet)
 */
const terminal = async (lorena, wallet) => {
  let list, payload
  const history = []
  const autoComplete = ['help', 'info', 'new-did', 'credential', 'credential-member', 'contacts', 'pubkey', 'ping', 'ping-remote', 'contact-invite', 'contact-list', 'contact-add', 'contact-info', 'action-issue', 'exit']

  term.cyan('lorena# ')
  const input = await term.inputField({ history: history, autoComplete: autoComplete, autoCompleteMenu: true }).promise
  term('\n')

  if (connected === false & ['did', 'ping', 'ping-remote', 'contact-invite', 'contact-list', 'contact-add', 'contact-info', 'action-issue'].includes(input)) {
    term('You are not connected\n')
  } else {
    switch (input) {
      case 'help':
        term.gray('actions :\n')
        console.log(autoComplete)
        break
      case 'info':
        term.gray('info :\n')
        console.log(wallet.info)
        break
      case 'did':
        term.gray('DID :\n')
        console.log(wallet.info.didBase + wallet.info.didMethod + ':' + wallet.info.did)
        break
      case 'new-did':
        payload = {}
        term.cyan('Create a new Identity')
        term.gray('\nConnection String :')
        payload.connString = await term.inputField().promise
        term.gray('\nSecurity Code :')
        payload.securityCode = await term.inputField().promise

        term.cyan('\nOpen connection')
        await lorena.newClient(payload.connString, payload.securityCode, username)
        // Connect
        term.cyan('\nConnecting to Matrix')
        await lorena.connect()

        // Do the handshake with the server
        term.cyan('\nHandshake : add contact')
        term.cyan('\n')
        // await lorena.handshake()
        term.cyan('\nUpdating Storage...\n')
        await lorena.lock(password)
        break
      case 'credential':
        term.gray('Credentials :\n')
        console.log(wallet.data.credentials['0'] ? wallet.data.credentials['0'] : 'empty')
        break
      case 'credential-member':
        term.gray('Credentials :\n')
        console.log(wallet.data.credentials['0'] ? wallet.data.credentials['0'].credentialSubject.member : 'empty')
        break
      case 'contacts':
        term.gray('Contacts :\n')
        console.log(wallet.data.contacts)
        break
      case 'pubkey':
        term.gray('Public Key :\n')
        console.log(wallet.info.keyPair[wallet.info.username].keypair.public_key)
        break
      case 'ping':
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
        term.gray('\n')
        list = await callRecipe(lorena, input, payload)
        console.log(list)
        break
      case 'contact-list':
        list = await callRecipe(lorena, input, { filter: 'all' })
        console.log(list)
        break
      case 'contact-handshake':
        term.gray('handshake...')
        await lorena.handshake()
        term('^+done^\n')
        break
      case 'contact-add':
        payload = {}
        term.gray('DID : ')
        payload.did = await term.inputField().promise
        term.gray('\nmatrix : ')
        payload.matrix = await term.inputField().promise
        term.gray('\n')
        await lorena.createConnection(payload.matrix, payload.did)
        break
      case 'credential-get':
        payload = {}
        term.gray('RoomId : ')
        payload.roomId = await term.inputField().promise
        // term.gray('\nCredential (memberOf) : ')
        // payload.credential = await term.inputField().promise
        term.gray('\n')
        await lorena.askCredential(payload.roomId, 'memberOf')
        break
      case 'contact-del':
        payload = {}
        term.gray('RoomId : ')
        payload = await term.inputField().promise
        await lorena.deleteConnection(payload)
        break
      case 'action-issue':
        payload = {}
        term.gray('ContactID : ')
        payload.contactId = await term.inputField().promise
        payload.subject = { name: 'Compra', description: 'Comprar en el Vendrell', location: 'Vendrell' }
        term('\n')
        list = await callRecipe(lorena, 'action-issue', { contactId: payload.contactId, subject: payload.subject })
        console.log(list)
        break
      case 'action-list':
        list = await callRecipe(lorena, input, { filter: 'all' })
        console.log(list)
        break
      case 'exit':
      case 'quit':
      case 'q':
        if (lorena.wallet.changed === true) {
          term.gray('\nChanges to the conf file')
          term.gray('\npassword : ')
          payload = await term.inputField().promise
          await lorena.lock(payload)
        }
        process.exit()
      default:
        term.gray('Command "' + input + '" does not exist. For help type "help"\n')
    }
  }
  terminal(lorena, wallet)
}

main()
