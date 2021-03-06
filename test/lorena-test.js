import Lorena from '../index.js'
import Wallet from '@lorena-ssi/wallet-lib'
import chai, { expect } from 'chai'
import { describe, it } from 'mocha'
import { promises as fsPromises } from 'fs'
// Configure chai
chai.use(require('chai-as-promised'))
chai.use(require('chai-spies'))
chai.use(require('chai-uuid'))

const importWallet = async (path) => {
  try {
    const data = await fsPromises.readFile(path, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    throw new Error(error)
  }
}

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

  it('getLinkId passing a RoomID', () => {
    const roomId = '!bXwVAPtFvrDcauxIna:labtest.matrix.lorena.tech'
    const result = lorena.getLinkId(roomId)
    expect(result).to.be.undefined
    // this is success because wallet doesn't have this link and no throw
  })

  it('getLinkId passing a LinkID', () => {
    const linkId = '123e4567-e89b-12d3-a456-426614174000'
    const result = lorena.getLinkId(linkId)
    expect(result).to.equal(linkId)
  })

  it('getLinkId passing an invalid format ID', () => {
    const invalidId = '!^&***badjba'
    try {
      lorena.getLinkId(invalidId)
    } catch (error) {
      expect(error.message).to.equal('Unsupported ID to getLink')
    }
  })

  it('getLinkId passing an undefined', () => {
    const undefinedId = undefined
    try {
      lorena.getLinkId(undefinedId)
    } catch (error) {
      expect(error.message).to.equal('Unsupported ID to getLink')
    }
  })

  it('use an old legacy wallet and upgrade it', async () => {
    // Load example wallet Json
    const walletObject = await importWallet('./test/exampleWallet.json')
    const username = Object.keys(walletObject)[0]
    const zPassword = 'zeevee'
    const exampleWallet = new Wallet(username)
    await exampleWallet.write('info', walletObject[username].info)
    await exampleWallet.write('data', walletObject[username].data)

    // Create a Test Wallet
    const mockLorena = new Lorena(exampleWallet)

    // Create one link Item to add to links array
    const link = {
      roomId: 'roomId',
      alias: '',
      did: '',
      matrixUser: 'element.sender',
      status: 'incoming'
    }

    expect(mockLorena.wallet.data.links[0]).not.be.ok
    mockLorena.wallet.add('links', link)
    expect(mockLorena.wallet.data.links[0].linkId).not.be.ok

    // Unlock Wallet
    await mockLorena.unlock(zPassword)
    expect(mockLorena.wallet.data.links[0].linkId).to.be.a.guid()
    mockLorena.disconnect()
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

  it('should close connections', () => {
    lorena.disconnect()
  })

  it('should verify a Credential', (done) => {
    const lorenaSessionless = new Lorena()
    const json = '{"@context":["https://www.w3.org/2018/credentials/v1"],"type":["VerifiableCredential","Achievement"],"issuer":"did:lor:labtest:WTNaQ2QwMUljVzlmTmxVMWFGWnVZMWx2","issuanceDate":"2020-08-18T13:35:09.318Z","credentialSubject":{"@type":"Achievement","id":"did:lor:labtest:bafyreidutljjooc3fpxa3bj4eg7fb7czcbh2vrbwyt7kyqb2mtx55v43v4;id:31","issuer":"did:lor:labtest:WTNaQ2QwMUljVzlmTmxVMWFGWnVZMWx2","course":{"id":"did:lor:labtest:bafyreidutljjooc3fpxa3bj4eg7fb7czcbh2vrbwyt7kyqb2mtx55v43v4"},"description":"messi messi","expirationDate":null,"issuanceDate":null,"learningAchievement":{"title":"macu macu"},"title":"FCB Presi","url":"fcbarcelona.com","agent":{"@type":"Person","id":"","name":"Diego Torres López","email":"diego@caelumlabs.com"}},"proof":{"type":"Curve448-Goldilocks","proofPurpose":"assertionMethod","verificationMethod":"","signature":{"did:lor:labtest:WTNaQ2QwMUljVzlmTmxVMWFGWnVZMWx2":{"draft":"dW5kZWZpbmVk","signature":{"r":"G4QGZHXZ1Yc_oYX7DaScHduQmzbr70f4Ulqmscehsl2vMSu-B6AibwpN0Qfw0kL9WllnNTHlcmY","s":"LN93aeTW7fS1-lsKH8CHwSg0E9MVRYcvULbVQc8WuCqo19yE6HKGbTkAZ7nzrwy-h5cpIj-iVFw"}}}}}'
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
