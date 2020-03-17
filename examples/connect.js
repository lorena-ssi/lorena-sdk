
const Lorena = require('../src/main.js').default

const main = async () => {
  const lorena = new Lorena()

  // lorena.send({ action: 'connect', connectionString: 'efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206' })
  //  Root (remote)
  // lorena.connect('efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206')

  // Local
  lorena.connect('5c7ca0ef4248e3a5-b987eb7a015b24d8-d81519de41ebdbba')

  lorena.on('error', (e) => {
    console.log('ERROR!!', e)
  })

  lorena.on('ready', async () => {

    /*
    const contactAction = {
      recipe: 'contact-add', // Local name for your process
      recipeId: 0,
      threadRef: 'contact-add', // Recipe we are calling to
      threadId: 3, // Local id  for your process
      payload: {
        did: '42dd5715a308829e',
        matrix: '@42dd5715a308829e:matrix.caelumlabs.com'
      }
    }
    lorena.sendAction(contactAction.recipe, contactAction.recipeId, contactAction.threadRef, contactAction.threadId, contactAction.payload)
    */

    const pingAction = {
      recipe: 'ping', // Local name for your process
      recipeId: 0,
      threadRef: 'pong', // Recipe we are calling to
      threadId: 2, // Local id  for your process
      payload: {}
    }
    lorena.sendAction(pingAction.recipe, pingAction.recipeId, pingAction.threadRef, pingAction.threadId, pingAction.payload)

    /*
    const contactListAction = {
      recipe: 'contact-list', // Local name for your process
      recipeId: 0,
      threadRef: 'get-contact-list', // Recipe we are calling to
      threadId: 1, // Local id  for your process
      payload: {}
    }
    lorena.sendAction(contactListAction.recipe, contactListAction.recipeId, contactListAction.threadRef, contactListAction.threadId, contactListAction.payload)
    */
  })

  lorena.on('message:pong', (payload) => {
    console.log('pong', payload)
  })

  lorena.on('message:contact-list', (payload) => {
    console.log('list', payload)
  })

  lorena.on('message:contact-add', (payload) => {
    console.log('contact', payload)
  })
}

main()
