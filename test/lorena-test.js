const Lorena = require('../src/index')
const chai = require('chai')

// Configure chai
chai.should()
const expect = chai.expect

describe('Lorena API', function () {
    var lorena
    const username = 'username123456'
    const password = 'password'
  
    it('should contruct a Lorena class', async () => {
        const clientCode = username + '-' + password + '-' + username
        lorena = new Lorena(clientCode)
        expect(lorena).to.have.keys([
            'matrix',
            'zenroom',
            'roomId',
            'nextBatch',
            'recipeId',
            'matrixUser',
            'matrixPass',
            'did'
        ])
    })

    it('should create a new Lorena user', async () => {
        const a = await lorena.createUser(username, password)
        if (a) {
            expect(a).to.equal(true) // if it's a new `username`
            expect(lorena.zenroom.keypair).to.have.keys(['private_key', 'public_key'])
            expect(orena.zenroom.keypair['private_key']).to.have.lengthOf(75)
            expect(orena.zenroom.keypair['public_key']).to.have.lengthOf(151)
        } else {
            expect(a).to.equal(false) // `username` already taken
        }
    })

    it('should connect to username', async () => {
        const a = await lorena.connect(username, password)
        expect(a).to.equal(true)
    })
  })