const Lorena = require('../src/index')
const chai = require('chai')
const mocha = require('mocha')
const describe = mocha.describe
const it = mocha.it
chai.use(require('chai-as-promised'))
chai.use(require('chai-spies'))
// Configure chai
chai.should()
const expect = chai.expect

describe('Lorena API', function () {
  var lorena
  const username = 'username123456'
  const password = 'password'

  it('should contruct a Lorena class', async () => {
    lorena = new Lorena()
    expect(lorena).to.have.keys([

      'matrix',
      'zenroom',
      'roomId',
      'nextBatch',
      'recipeId',
      'matrixUser',
      'matrixPass',
      'did',
      // 'on',
      // 'off',
      // 'emit',
      '_events',
      '_eventsCount',
      '_maxListeners',
      'processing',
      'queue',
      'ready'
    ])
  })

  it('should create a new Lorena user', async () => {
    const a = await lorena.createUser(username, password)
    if (a) {
      expect(a).to.equal(true) // if it's a new `username`
      expect(lorena.zenroom.keypair).to.have.keys(['private_key', 'public_key'])
      expect(lorena.zenroom.keypair.private_key).to.have.lengthOf(75)
      expect(lorena.zenroom.keypair.public_key).to.have.lengthOf(151)
    } else {
      expect(a).to.equal(false) // `username` already taken
    }
  })

  let ready
  it('should connect', (done) => {
    ready = chai.spy()
    lorena.on('ready', ready)

    lorena.connect('efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206')
      .should.eventually.equal(true).notify(done)
  })

  it('should emit ready', () => {
    expect(ready).to.have.been.called()
  })

  it('should receive pong', (done) => {
    const pingAction = {
      recipe: 'ping', // Local name for your process
      recipeId: 0,
      threadRef: 'pong', // Recipe we are calling to
      threadId: 2, // Local id  for your process
      payload: {}
    }
    function pong () {
      expect(onpong).to.have.been.called()
      done()
      process.exit() // quick exit tests, move when more tests added
    }
    const onpong = chai.spy(pong)
    lorena.on('message:ping', onpong)
    lorena.sendAction(pingAction.recipe, pingAction.recipeId, pingAction.threadRef, pingAction.threadId, pingAction.payload)
  })
})
