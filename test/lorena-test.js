import Lorena from '../index.js'
import Wallet from '@lorena-ssi/wallet-lib'
import chai, { expect } from 'chai'
import { describe, it } from 'mocha'
// Configure chai
chai.use(require('chai-as-promised'))
chai.use(require('chai-spies'))

describe('Lorena SDK', function () {
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

  it('should verify a Credential', (done) => {
    const lorenaSessionless = new Lorena()
    const json = '{"@context":["https://www.w3.org/2018/credentials/v1"],"type":["VerifiableCredential","Achievement"],"issuer":"did:lor:labtest:ZGtaUFRIaHlOQzEzUmpoSVlrdzJZbTkz","issuanceDate":"2020-04-30T04:17:18.037Z","credentialSubject":{"@type":"Achievement","id":"did:lor:labtest:bafyreiegi4p5fg65chx67gkppk2zcded7smfe6lgestf44wcqyiuxicriu;id:22","course":{"id":"did:lor:labtest:bafyreiegi4p5fg65chx67gkppk2zcded7smfe6lgestf44wcqyiuxicriu"},"agent":{"@type":"Person","id":"","name":"Alex Puig","email":"alex@caelumlabs.com"},"expirationDate":""},"proof":{"type":"Curve448-Goldilocks","proofPurpose":"assertionMethod","verificationMethod":"","signature":{"did:lor:labtest:ZGtaUFRIaHlOQzEzUmpoSVlrdzJZbTkz":{"draft":"dW5kZWZpbmVk","signature":{"r":"K1zKNIkSx87nZ7bj_JlrN8z2qgkvPUsHe25E3yZ1UU16ufH4H31MS52_leNlBoCdLmM4vUvCAaA","s":"Pcb-VF08gc7IymfxXWCgBwwPfcyMYLL-7pLrjwKuQF4p5gpfvQSCrOKk0QjolRSY3v6Wwtqwc4E"}}}}}'
    lorenaSessionless.verifyCredential(json)
      .then((res) => {
        expect(typeof res).to.equal('object')
        expect(typeof res.verified).to.equal('object')
        expect(res.success).to.equal(true)
        expect(res.verified.network).to.equal('labtest')
        expect(typeof res.verified).to.equal('object')
        expect(typeof res.verified.certificate.credentialSubject.agent.name).to.equal('string')

        lorenaSessionless.disconnect()
        done()
      })
  })
})
