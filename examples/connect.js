let Lorena = require('../src/index')
const lorena = new Lorena( '5c7ca0ef4248e3a5-b987eb7a015b24d8-42dd5715a308829e' )

const main = async () => {
    await lorena.connect()
    
    
    //TODO: getMessages - just messages - not mine? - List messages just for the other side

    // test ping
    /*
    await lorena.sendText('ping')
    let msgs = await lorena.getMessages()
    console.log('TEXT Ping....'+msgs[0].payload.body)
    */

    // test hello
    /*
    await lorena.sendAction('ping', {})
    msgs = await lorena.getMessages()
    console.log(msgs[0])
    */

    // let ret = JSON.parse(msgs[0].payload.body)
    
    // console.log('ACTION Ping....'+ret.payload)

    await lorena.sendAction('contact-add', {did: '42dd5715a308829e', matrix:'@42dd5715a308829e:matrix.caelumlabs.com'})
}

main()