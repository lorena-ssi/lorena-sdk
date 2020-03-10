const { fork } = require("child_process")
let recipeId = 1

const main = async () => {
    const lorena = fork("src/index.js")
    lorena.send({action: 'connect', connectionString : '5c7ca0ef4248e3a5-b987eb7a015b24d8-d81519de41ebdbba'})
    lorena.on("message", msg => {
        switch (msg) {
            case 'ready':
                lorena.send({action: 'm.action', recipe:'contact-list', recipeId})
            break
            default:
                if (msg.recipeId === recipeId) {
                    console.log(msg.payload)
                }
            break
        }
    })
    
    // await lorena.sendAction('contact-add', {did: '42dd5715a308829e', matrix:'@42dd5715a308829e:matrix.caelumlabs.com'})
}

main()