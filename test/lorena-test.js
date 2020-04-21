import Lorena from '../src/index.js'
import Wallet from '@lorena-ssi/wallet-lib'
import chai, { expect } from 'chai'
import { describe, it } from 'mocha'
// Configure chai
chai.use(require('chai-as-promised'))
chai.use(require('chai-spies'))

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
  const wallet = new Wallet('test')

  it('should construct a Lorena class', async () => {
    lorena = new Lorena(wallet)
    expect(lorena).to.include.all.keys(lorenaKeys)
  })

  it('should construct a Lorena class with debug', async () => {
    lorena = new Lorena(wallet, { debug: true, silent: true })
    expect(lorena).to.include.all.keys(lorenaKeys)
  })

  it('should not init wallet for an invalid network', async () => {
    await expect(lorena.initWallet('xxx')).to.be.rejectedWith(Error)
  })

  it('should init wallet for a valid network', async () => {
    const result = await lorena.initWallet('labdev')
    expect(result.matrixServer).to.contain('labdev')
  })

  it('should unlock wallet', (done) => {
    lorena.on('unlocked', () => {
      done()
    })
    lorena.unlock('test')
  })

  it('should lock wallet', (done) => {
    lorena.on('locked', () => {
      done()
    })
    lorena.lock('test')
  })

  it('should have these private methods', () => {
    expect(typeof lorena.processQueue).to.equal('function')
    expect(typeof lorena.loop).to.equal('function')
    expect(typeof lorena.oneMsg).to.equal('function')
  })

  it('should close connections', () => {
    lorena.disconnect()
  })
})
