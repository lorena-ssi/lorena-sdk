#!/usr/bin/env node
var term = require('terminal-kit').terminal
const os = require('os')
const home = os.homedir()
const Lorena = require('../src/index.js').default
let threadId = 0

term.magenta('Lorena ^+Client^\n')

const main = async () => {
  term.gray('\nUsername :')
  const username = await term.inputField().promise
  term.gray('\nPassword :')
  const password = await term.inputField().promise

  const storageFile = home + '/.lorena/data/' + username + '.json'
  const lorena = new Lorena({ storage: 'file', file: storageFile })
  term.gray('\nConnecting...')
  // get basic configuration
  const conf = await lorena.loadConf(username, password)
  if (conf === false) {
    // First Time.
    term.gray('Creating new connection')
    term.gray('\nConnection String :')
    const connString = await term.inputField().promise
    // const connString = 'Ygg7QhoNdbPmP1UTqnl22w-#-NDM2ZjZlNmU2NTYzNzQ2OTZmNmUyMDUzNzQ3MjY5NmU2Nw-#-jWDo3rHGqwMn3jnfRbBtNLmdsaC2UMzyura2dySL4Os-#-OKESp6vasShke5HVunTL5POsfEAyK33QnCDqzDGJKXFp_INhqkBaKM8i6ftlg1deyoZq6MMIaQUIZuEsFFjMNMGpRmYgtnOIKXFsJ9GhZ5kiV775EfeeXnwoh7o'

    term.gray('\nPIN :')
    const pin = await term.inputField().promise
    // const pin = '223447'
    term.gray('\nCreate connection...')
    await lorena.newClient(connString, pin, password)
  }

  lorena.connect()
  lorena.on('error', (e) => {
    console.log('ERROR!!', e)
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
 * @param {string} recipe Recipe id to be called
 * @param {*} thread Thread id calling the recipe
 * @param {*} payload Payload
 */
const callRecipe = (lorena, recipe, thread, payload = {}) => {
  const pingAction = {
    recipe: recipe, // Local name for your process
    recipeId: 0,
    threadRef: thread, // Recipe we are calling to
    threadId: threadId, // Local id  for your process
    payload: payload
  }
  lorena.sendAction(pingAction.recipe, pingAction.recipeId, pingAction.threadRef, pingAction.threadId, pingAction.payload)
  threadId++
}

/**
 * Opens the terminal
 *
 * @param {object} lorena Lorena Obkect
 */
const terminal = async (lorena) => {
  let input
  const history = []
  const autoComplete = ['ping', 'ping-remote', 'contact-list', 'exit', 'help', 'contact-add', 'contact-info', 'peer-add', 'peer-list']

  term.magenta('lorena# ')
  term.on('key', function (name, matches, data) {
    if (name === 'CTRL_C') {
      term.grabInput(false)
      setTimeout(function () { process.exit() }, 100)
    }
  })
  input = await term.inputField({ history: history, autoComplete: autoComplete, autoCompleteMenu: true }).promise
  term.magenta('\n')
  switch (input) {
    case 'help':
      term.gray('actions :\n')
      console.log(autoComplete)
      break
    case 'ping':
      term.gray('ping...')
      callRecipe(lorena, 'ping', 'pong')
      try {
        await lorena.oneMsg('message:pong')
        term('^+pong^\n')
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'ping-remote':
      term.gray('DID : ')
      input = await term.inputField().promise
      term.gray('\nping remote...')
      callRecipe(lorena, 'ping-remote', 'pong', { did: input })
      try {
        await lorena.oneMsg('message:pong')
        term('^+pong^\n')
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'contact-list':
      term.gray('getting list...')
      callRecipe(lorena, 'contact-list', 'list')
      try {
        const list = await lorena.oneMsg('message:list')
        term('^+done^\n')
        console.log(list)
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'contact-info':
      term.gray('DID : ')
      input = await term.inputField().promise
      term.gray('\ngetting info...')
      callRecipe(lorena, 'contact-info', 'info', { did: input })
      try {
        const info = await lorena.oneMsg('message:info')
        term('^+done^\n')
        console.log(info.payload)
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'peer-list':
      term.gray('getting list...')
      callRecipe(lorena, 'peer-list', 'list')
      try {
        const list = await lorena.oneMsg('message:list')
        term('^+done^\n')
        console.log(list)
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
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
      term.gray('\nAddin peer...')
      callRecipe(lorena, 'peer-add', 'peer-add', input)
      try {
        await lorena.oneMsg('message:peer-add')
        term('^+done^\n')
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'contact-add':
      term.gray('DID : ')
      input = await term.inputField().promise
      term.gray('\nContacting...')
      callRecipe(lorena, 'contact-add', 'add', {
        did: input,
        matrix: '@' + input + ':matrix.caelumlabs.com'
      })
      try {
        await lorena.oneMsg('message:add')
        term('^+done^\n')
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'exit':
    case 'quit':
    case 'q':
      process.exit()
  }
  terminal()
}

main()
