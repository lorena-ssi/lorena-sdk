
const Lorena = require('../src/index')

const main = async () => {
  const lorena = new Lorena()

  // lorena.send({ action: 'connect', connectionString: 'efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206' })
  lorena.connect('efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206')

  lorena.on('error', (e) => {
    console.log('ERROR!!', e)
  })

  lorena.on('ready', async () => {
    const pingAction = {
      recipe: 'ping', // Local name for your process
      recipeId: 0,
      threadRef: 'pong', // Recipe we are calling to
      threadId: 2, // Local id  for your process
      payload: {}
    }
    lorena.sendAction(pingAction.recipe, pingAction.recipeId, pingAction.threadRef, pingAction.threadId, pingAction.payload)
    const contactListAction = {
      recipe: 'contact-list', // Local name for your process
      recipeId: 0,
      threadRef: 'get-contact-list', // Recipe we are calling to
      threadId: 1, // Local id  for your process
      payload: {}
    }
    lorena.sendAction(contactListAction.recipe, contactListAction.recipeId, contactListAction.threadRef, contactListAction.threadId, contactListAction.payload)
  })

  lorena.on('message:ping', (payload) => {
    console.log('pong', payload)
  })

  lorena.on('message', (payload) => {
    console.log('message', payload)
  })
}

// await lorena.sendAction('contact-add', {did: '42dd5715a308829e', matrix:'@42dd5715a308829e:matrix.caelumlabs.com'})

main()
