const Wallet = require('../src/wallet').default
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
  'blockchain',
  'opts',
  '_events',
  '_eventsCount',
  '_maxListeners',
  'wallet'
]

describe('Lorena API', function () {
  let lorena
  const username = 'username123456'
  const password = 'password'
  const ready = chai.spy()
  const wallet = new Wallet('test')

  it('should construct a Lorena class', async () => {
    lorena = new Lorena(wallet)
    expect(lorena).to.include.all.keys(lorenaKeys)
  })

  // disabled: walletHandler is a required parameter for the constructor.
  xit('should construct a Lorena class without params', async () => {
    lorena = new Lorena()
    expect(lorena).to.include.all.keys(lorenaKeys)
  })

  it('should construct a Lorena class with debug', async () => {
    lorena = new Lorena(wallet, { debug: true })
    expect(lorena).to.include.all.keys(lorenaKeys)
  })

  // createUser is not yet implemented
  xit('should create a new Lorena user', async () => {
    const a = await lorena.createUser(username, password)
    if (a) {
      expect(a).to.equal(true) // if it's a new `username`
      expect(lorena.matrixUser).to.equal(username)
      expect(lorena.did).to.equal(username)
      expect(lorena.matrixPass).to.equal(password)
      expect(lorena.zenroom.keypair).to.have.keys(['private_key', 'public_key'])
      expect(lorena.zenroom.keypair.private_key).to.have.lengthOf(75)
      expect(lorena.zenroom.keypair.public_key).to.have.lengthOf(151)
    } else {
      expect(a).to.equal(false) // `username` already taken
    }
  })

  // depends on createUser
  xit('should connect', () => {
    lorena.on('ready', ready)

    lorena.connect('efd708e2b5dc1648-77326e5151d48bd7-138df632fd0de206')
      .then((connected) => {
        assert(connected, 'Should be connected true')
        expect(ready).to.have.been.called()
      })
    // .should.eventually.equal(true).notify(done)
  })

  // depends on previous test
  xit('should emit ready', () => {
    expect(ready).to.have.been.called()
  })

  it('should have these private methods', () => {
    expect(typeof lorena.processQueue).to.equal('function')
    expect(typeof lorena.loop).to.equal('function')
    expect(typeof lorena.oneMsg).to.equal('function')
  })

  // requires connection
  xit('should receive message:ping', (done) => {
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
    lorena.on('message:pong', onpong)
    lorena.sendAction(pingAction.recipe, pingAction.recipeId, pingAction.threadRef, pingAction.threadId, pingAction.payload)
  })
})

describe('Wallet API', function () {
  const w = new Wallet('wallet')
  it('should create Wallet class', () => {
    expect(w.info.matrixUser).to.equal('')
  })

  it('should add to credentials collection', () => {
    w.add('credentials', { name: 'admintest', role: 'admin' })
    w.add('credentials', { name: 'test1', role: 'user' })
    w.add('credentials', { name: 'test2', role: 'user' })
    w.add('credentials', { name: 'test3', role: 'user' })
    w.add('credentials', { name: 'test4', role: 'user' })
    w.add('credentials', { name: 'test5', role: 'user' })
    expect(w.data.credentials[0]).to.eql({ name: 'admintest', role: 'admin' })
    expect(w.data.credentials[1]).to.eql({ name: 'test1', role: 'user' })
  })

  it('should update the credential', () => {
    w.update('credentials', { name: 'admintest' }, { name: 'admintest', role: 'superadmin' })
    expect(w.data.credentials[0]).to.eql({ name: 'admintest', role: 'superadmin' })
  })

  it('should remove the credential', () => {
    const name = 'test3'
    w.remove('credentials', { name })
    expect(w.data.credentials[3]).to.eql({ name: 'test4', role: 'user' })
  })

  // At the moment only can search with 1 prop
  xit('should remove only 1', () => {
    const name = 'test4'
    const role = 'user'
    w.remove('credentials', { name, role })
    expect(w.data.credentials[3]).to.eql({ name: 'test5', role: 'user' })
  })

  it('should remove all coincidences', () => {
    const role = 'user'
    w.remove('credentials', { role })
    expect(w.data.credentials.length).to.equal(1)
  })

  xit('should unlock wallet', () => {
    // ...
  })

  xit('should lock wallet', () => {
    // ...
  })

  xit('should write to wallet', () => {
    // ...
  })

  xit('should read from wallet', () => {
    // ...
  })
})
