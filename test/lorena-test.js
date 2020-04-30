import Lorena from '../src/index.js'
import Wallet from '@lorena-ssi/wallet-lib'
import chai, { expect } from 'chai'
import { describe, it } from 'mocha'
// Configure chai
chai.use(require('chai-as-promised'))
chai.use(require('chai-spies'))

describe('Lorena API', function () {
  let lorena, wallet
  const password = 'test'

  it('should prepare the wallet', async () => {
    wallet = new Wallet('lorena-sdk-test')
    await wallet.delete()
    const result = await wallet.unlock(password)
    expect(result).to.be.false
    await wallet.lock(password)
  })

  it('should construct a Lorena class', async () => {
    lorena = new Lorena(wallet)
  })

  it('should construct a Lorena class with debug', async () => {
    lorena = new Lorena(wallet, { debug: true, silent: true })
  })

  it('should not init wallet for an invalid network', async () => {
    await expect(lorena.initWallet('xxx')).to.be.rejectedWith(Error)
  })

  it('should init wallet for a valid network', async () => {
    const result = await lorena.initWallet('labdev')
    expect(result.matrixServer).to.contain('labdev')
  })

  it('should connect', async () => {
    const result = await lorena.connect()
    expect(result).to.be.true
  })

  it('should unlock wallet', (done) => {
    lorena.on('unlocked', () => {
      done()
    })
    lorena.unlock(password)
  })

  it('should lock wallet', (done) => {
    lorena.on('locked', () => {
      done()
    })
    lorena.lock(password)
  })

  it('should have these private methods', () => {
    expect(typeof lorena.processQueue).to.equal('function')
    expect(typeof lorena.loop).to.equal('function')
    expect(typeof lorena.oneMsg).to.equal('function')
  })

  it('should close connections', () => {
    lorena.disconnect()
  })

  it('should validate a Credential', (done) => {
    const lorenaDisconnected = new Lorena()
    const json = '{"@context":["https://www.w3.org/2018/credentials/v1"],"type":["VerifiableCredential","Achievement"],"issuer":"did:lor:labtest:ZGtaUFRIaHlOQzEzUmpoSVlrdzJZbTkz","issuanceDate":"2020-04-29T17:13:41.702Z","credentialSubject":{"@type":"Achievement","id":"did:lor:labtest:bafyreicnvfhomydwysklfrajh227ewzkqvltzfhmk62dxtwp422lbrz2ye;id:21","course":{"id":"did:lor:labtest:bafyreicnvfhomydwysklfrajh227ewzkqvltzfhmk62dxtwp422lbrz2ye"},"agent":{"@type":"Person","id":"","name":"Alex Puig","email":"alex@caelumlabs.com"},"expirationDate":""},"proof":{"type":"Curve448-Goldilocks","proofPurpose":"assertionMethod","verificationMethod":"","signature":{"did:lor:labtest:ZGtaUFRIaHlOQzEzUmpoSVlrdzJZbTkz":{"draft":"dW5kZWZpbmVk","signature":{"r":"NJWPQtNuEvtI7GpE-k5kdBu1nNMELncfYMIjPuRgioVHlF5ugZKNuIypAYza-monnMAgOVtWyMM","s":"LpviDh2knWE26v9GIrETrYXzxiQma3LWke4jJq5S7rxWxgi_wbKVIxNzEl3XSrF-TpoHcUnr3eU"}}}}}'
    lorenaDisconnected.validateCertificate(json)
      .then((res) => {
        expect(typeof res).to.equal('boolean')
        done()
      })
  })
})
