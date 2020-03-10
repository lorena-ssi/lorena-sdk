const { fork } = require("child_process")

const main = async () => {
    const lorena = fork("src/index.js")
    lorena.send({action: 'connect', connectionString : '5c7ca0ef4248e3a5-b987eb7a015b24d8-d81519de41ebdbba'})
    lorena.on("message", msg => {
        switch (msg) {
            case 'ready':
                lorena.send({
                    action: 'm.action',
                    recipe: 'contact-list',             // Local name for your process
                    remoteRecipeId: 1,                  // Local id  for your process
                    remoteRecipe:'get-contact-list',    // Recipe we are calling to
                    payload: {}
                    })
            break
            case 'error':
                // TODO: Send errors.
                process.exit()
            default:
                switch( msg.recipe ) {
                    case 'get-contact-list':
                        if (msg.recipeId === 1) {
                            console.log(msg.payload)
                        }
                    break
                }
                
            break
        }
    })
    
    // await lorena.sendAction('contact-add', {did: '42dd5715a308829e', matrix:'@42dd5715a308829e:matrix.caelumlabs.com'})
}

main()