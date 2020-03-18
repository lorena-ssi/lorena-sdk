const Lorena = require('../src/main.js').default
const chai = require('chai')
const mocha = require('mocha')
const describe = mocha.describe
const it = mocha.it

// Configure chai
chai.use(require('chai-as-promised'))
chai.use(require('chai-spies'))
const expect = chai.expect
const assert = chai.assert

const lorenaKeys = [
  'matrix',
  'zenroom',
  'domain',
  'roomId',
  'nextBatch',
  'options',
  'recipeId',
  'matrixUser',
  'matrixPass',
  'did',
  '_events',
  '_eventsCount',
  '_maxListeners',
  'processing',
  'queue',
  'ready'
]

describe('Lorena API', function () {
  var lorena
  const username = 'username123456'
  const password = 'password'

  it('should contruct a Lorena class with server', async () => {
    lorena = new Lorena('server')
    console.log('DOMAIN??', lorena.domain)
    expect(lorena).to.have.keys(lorenaKeys)
    assert(!lorena.options.debug)
  })

  it('should contruct a Lorena class without params', async () => {
    lorena = new Lorena()
    expect(lorena).to.have.keys(lorenaKeys)
    assert(!lorena.options.debug)
  })

  it('should contruct a Lorena class with debug', async () => {
    lorena = new Lorena({ debug: true })
    expect(lorena).to.have.keys(lorenaKeys)
    assert(lorena.options.debug)
  })

  it('should create a new Lorena user', async () => {
    const a = await lorena.createUser(username, password)
    if (a) {
      expect(a).to.equal(true) // if it's a new `username`
      expect(lorena.matixUser).to.equal(username)
      expect(lorena.did).to.equal(username)
      expect(lorena.matrixPass).to.equal(password)
      expect(lorena.zenroom.keypair).to.have.keys(['private_key', 'public_key'])
      expect(lorena.zenroom.keypair.private_key).to.have.lengthOf(75)
      expect(lorena.zenroom.keypair.public_key).to.have.lengthOf(151)
    } else {
      expect(a).to.equal(false) // `username` already taken
    }
  })

  it('should connect', () => {
    const ready = chai.spy()
    lorena.on('ready', ready)

    return lorena.connect('efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206')
      .then((connected) => {
        assert(connected, 'Should be connected true')
        expect(ready).to.have.been.called()
      })
    // .should.eventually.equal(true).notify(done)
  })

  // it('should emit ready', () => {
  //   expect(ready).to.have.been.called()
  // })

  it('should have this private methods', () => {
    expect(typeof lorena.processQueue).to.equal('function')
    expect(typeof lorena.loop).to.equal('function')
  })

  it('should receive message:ping', (done) => {
    const pingAction = {
      recipe: 'ping', // Local name for your process
      recipeId: 0,
      threadRef: 'pong', // Recipe we are calling to
      threadId: 2, // Local id  for your process
      payload: {}
    }
    /**
     *
     */
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
