var term = require('terminal-kit').terminal
const Lorena = require('../src/main.js').default
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
  let input, list, info
  const history = []
  const autoComplete = ['ping', 'ping-remote', 'contact-list', 'exit', 'help', 'contact-add', 'contact-info']

  while (true) {
    term.magenta('lorena# ')
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
        await lorena.oneMsg('message:pong')
        term('^+pong^\n')
        break
      case 'ping-remote':
        term.gray('DID : ')
        input = await term.inputField().promise
        term.gray('\nping remote...')
        callRecipe('ping-remote', 'pong', { did: input })
        await lorena.oneMsg('message:pong')
        term('^+pong^\n')
        break
      case 'contact-list':
        term.gray('getting list...')
        callRecipe('contact-list', 'list')
        list = await lorena.oneMsg('message:list')
        term('^+done^\n')
        console.log(list)
        break
      case 'contact-info':
        term.gray('DID : ')
        input = await term.inputField().promise
        term.gray('\ngetting info...')
        callRecipe('contact-info', 'info', { did: input })
        info = await lorena.oneMsg('message:info')
        term('^+done^\n')
        console.log(info.payload)
        break
      case 'contact-add':
        term.gray('DID : ')
        input = await term.inputField().promise
        term.gray('\nContacting...')
        callRecipe('contact-add', 'add', {
          did: input,
          matrix: '@' + input + ':matrix.caelumlabs.com'
        })
        await lorena.oneMsg('message:add')
        term('^+done^\n')
        break
      case 'exit':
      case 'quit':
      case 'q':
        process.exit()
    }
  }
}
const main = async () => {
  term.gray('Conecting to idspace...')
  lorena.connect('d61e92073d2f8cbf-c384c8b8f6cc9b2e-d81519de41ebdbba')

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
