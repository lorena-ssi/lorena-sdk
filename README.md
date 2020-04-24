## Lorena SDK

Client library for interacting with Lorena identities

```
npm install @lorena-ssi/lorena-sdk
```

[![Build Status](https://travis-ci.com/lorena-ssi/lorena-sdk.svg?branch=master)](https://travis-ci.com/lorena-ssi/lorena-sdk)
[![Coverage Status](https://coveralls.io/repos/github/lorena-ssi/lorena-sdk/badge.svg?branch=master)](https://coveralls.io/github/lorena-ssi/lorena-sdk?branch=master)

## Usage

``` js
const Lorena = require('@lorena-ssi/lorena-sdk').default
// const import Lorena from '@lorena-ssi/lorena-sdk'
const main = async () => {
  const lorena = new Lorena({debug: true})
  lorena.connect('connectionIdString')

  lorena.on('error', (e) => {
    console.log(e)
  })

  lorena.on('ready', async () => {
    lorena.sendAction({
      recipe: 'ping', // Remote recipe we are calling to
      recipeId: 0, // Remote id of the recipeId we are calling to
      threadRef: 'pong', // Local name for your process
      threadId: 2, // Local id  for your process
      payload: {} // Payload to send
    })

  })

  lorena.on('message:pong', (payload) => {
    console.log('pong', payload)
  })
}

main()
```

## API

#### `new Lorena([serverPath[,options]] || [options])`

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

Connect to Lorena IDspace.
`connectionstring` is a concatenation of username-password-did

Returns true if the connection is success

Throws an error and emits `error` if fails.

#### `handshake()`

Establishes a connection with the IDspace, checking public-key signatures.

#### `callRecipe(recipe, { payloadText: 'text', payloadETC: 'ETC'})`

Calls a recipe and returns the payload. A wrapper around `sendAction`.

Throws an error and emits `error` if fails.

#### `sendAction(recipe, recipeId, threadRef, thReadId, payload, linkId)`

Sends an action to another DID.

`recipe` Remote recipe name

`recipeId` Remote recipe Id

`threadRef`Local Recipe name

`threadId` Local recipe Id

`payload` Information to send

`linkId` Connection to use

### `on(message[:threadRef, :type], [function(payload)])`

Listen to events and execute the callback function

`threadRef` is the one sended to `sendAction`

`type` TODO

`payload` is the data coming from the remote recipe


### `off(message[:threadRef, :type])`

Stops listening for events

## License

MIT
