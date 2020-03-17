## Lorena Client

Client to 

```
npm install @lorena-ssi/lorena-cli
```

[![Build Status](https://travis-ci.com/lorena-ssi/lorena-cli.svg?branch=master)](https://travis-ci.com/lorena-ssi/lorena-cli)
[![Coverage Status](https://coveralls.io/repos/github/lorena-ssi/lorena-cli/badge.svg?branch=master)](https://coveralls.io/github/lorena-ssi/lorena-cli?branch=master)

## Usage

``` js
const Lorena = require('@lorena-ssi/lorena-cli').default
// const import Lorena from '@lorena-ssi/lorena-cli'
const main = async () => {
  const lorena = new Lorena()
  lorena.connect('connectionIdString')

  lorena.on('error', (e) => {
    console.log(e)
  })

  lorena.on('ready', async () => {
    const pingAction = {
      recipe: 'ping', // Local name for your process
      recipeId: 0,
      threadRef: 'pong', // Recipe we are calling to
      threadId: 2, // Local id  for your process
      payload: {}
    }
    lorena.sendAction(pingAction.recipe, pingAction.recipeId, pingAction.threadRef, pingAction.threadId, pingAction.payload)

  })

  lorena.on('message:pong', (payload) => {
    console.log('pong', payload)
  })
}

main()
```

## API

#### `new Lorena([serverPath], [options])`

`serverPath` can be a valid matrix server string, default: `https://matrix.caelumlabs.com`


`options` include:
```js
{
    debug: false // set the debug option, default false
}
```

#### `createUser(username, password)`

Create Matrix user and zenroom keypair.
Returns true or false when success or not available. 
Throws an error and emits `error` if fails.

#### `connect(connectionstring)`

Connect to Lorena IDSpace.
`connectionstring` is a concatenation of username-password-did

Returns true if the connection is success

Throws an error and emits `error` if fails.

#### `sendAction(recipe, recipeId, threadRef, thReadId, payload)`

Sends an action to another DID.

`recipe` Remote recipe name

`recipeId` Remote recipe Id

`threadRef`Local Recipe name

`threadId` Local recipr Id

`payload` Information to send

### `on(message[:threadRef, :type], [function])`

Listen to events and execute the callback function

`threadRef` is the one sended to `sendAction` 

You can listen to all messages `on('message')`

or listen to a specific threadRef `on('message:pong')`

or listen to a specific event types `on('message:contact-list')`


### `off(message[:threadRef, :type])`

Stops listening for events

## License

MIT