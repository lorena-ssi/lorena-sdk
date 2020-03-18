#!/usr/bin/env node

var term = require('terminal-kit').terminal
const Lorena = require('../src/index.js').default
const lorena = new Lorena()
let threadId = 0

const callRecipe = (recipe, thread, payload = {}) => {
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

term.magenta('Lorena ^+Client^\n')
const terminal = async () => {
  let input
  const history = []
  const autoComplete = ['ping', 'ping-remote', 'contact-list', 'exit', 'help', 'contact-add', 'contact-info']

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
      callRecipe('ping', 'pong')
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
      callRecipe('ping-remote', 'pong', { did: input })
      try {
        await lorena.oneMsg('message:pong')
        term('^+pong^\n')
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'contact-list':
      term.gray('getting list...')
      callRecipe('contact-list', 'list')
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
      callRecipe('contact-info', 'info', { did: input })
      try {
        const info = await lorena.oneMsg('message:info')
        term('^+done^\n')
        console.log(info.payload)
      } catch (error) {
        term.gray(`^+${error.message}^\n`)
      }
      break
    case 'contact-add':
      term.gray('DID : ')
      input = await term.inputField().promise
      term.gray('\nContacting...')
      callRecipe('contact-add', 'add', {
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
const main = async () => {
  term.gray('Conecting to idspace...')
  // lorena.connect('5c7ca0ef4248e3a5-b987eb7a015b24d8-d81519de41ebdbba')
  lorena.connect('efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206')

  lorena.on('error', (e) => {
    console.log('ERROR!!', e)
  })
  lorena.on('ready', async () => {
    term('^+connected^\n')
    terminal()
  })

  lorena.on('message:pong', (payload) => {
    // term( '^+received ^\n' )
  })
}

main()
