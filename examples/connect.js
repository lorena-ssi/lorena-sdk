const { fork } = require("child_process")

const main = async () => {
    const lorena = fork("src/index.js")

    lorena.send({action: 'connect', connectionString : '5c7ca0ef4248e3a5-b987eb7a015b24d8-d81519de41ebdbba'})
    lorena.on("message", msg => {
        switch (msg) {
            case 'ready':
                lorena.send({
                    action: 'm.action',
                    recipe: 'ping',             // Local name for your process
                    recipeId: 0,
                    threadRef:'ping',    // Recipe we are calling to
                    threadId: 2,                  // Local id  for your process
                    payload: {}
                })
            break
            case 'error':
                // TODO: Send errors.
                process.exit()
                break
            default:
                console.log("\n+++++++++++++++++++++ RECV")
                console.log(msg)
                switch( msg.recipe ) {
                    case 'ping':
                        lorena.send({
                            action: 'm.action',
                            recipe: 'contact-list',             // Local name for your process
                            recipeId: 0,
                            threadRef:'get-contact-list',    // Recipe we are calling to
                            threadId: 1,                  // Local id  for your process
                            payload: {}
                            })
                    break
                }
            break
        }
    })
    
    // await lorena.sendAction('contact-add', {did: '42dd5715a308829e', matrix:'@42dd5715a308829e:matrix.caelumlabs.com'})
}

main()