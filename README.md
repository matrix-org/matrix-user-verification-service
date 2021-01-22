# Matrix User Verification Service

Service to verify details of a user based on an Open ID Connect token.

Main features:

* Verifies a C2S [Open ID token](https://matrix.org/docs/spec/client_server/r0.6.1#id154)
  using the S2S [UserInfo endpoint](https://matrix.org/docs/spec/server_server/r0.1.4#openid).
* Can verify user is a member in a given room (Synapse only currently, requires admin level token).
  In addition to returning membership status, returned will be user power level, the room power 
  defaults and required power for events.

## How to use

### Dependencies

```
npm install
```

### Configuration

Copy the default `.env.default` to `.env` and modify as needed.

```
# Homeserver admin token (synapse only)
# Required for the service to verify room membership
UVS_ACCESS_TOKEN=foobar
# Homeserver URL
UVS_HOMESERVER_URL=https://matrix.org
# (Optional) auth token to protect the API
# If this is set any calls to the provided API endpoints
# need have the header "Authorization: Bearer changeme".
UVS_AUTH_TOKEN=changeme
# (Optional) listen address of the bot
UVS_LISTEN_ADDRESS=127.0.0.1
# (Optional) listen port of the bot
UVS_PORT=3000
# (Optional) log level, defaults to 'info'
# See choices here: https://github.com/winstonjs/winston#logging-levels
UVS_LOG_LEVEL=info
# (Optional) multiple homeserver mode, defaults to disabled
# See below for more info.
UVS_OPENID_VERIFY_ANY_HOMESERVER=false
```

#### OpenID token verification

UVS can run in a single homeserver mode or be configured to trust any
homeserver OpenID token. Default is to only trust the configured homeserver
OpenID tokens.

To enable multiple homeserver mode:

    UVS_OPENID_VERIFY_ANY_HOMESERVER=true

Note, room membership is still limited to only the configured `UVS_HOMESERVER_URL`.

When running with the multiple homeserver mode, `matrix_server_name` becomes
a required request body item for all `/verify` verification API requests.

### API's available

### Authentication

If `UVS_AUTH_TOKEN` is set, you'll need to provide an authorization header as follows:

    Authorization: Bearer token

#### Verify OpenID token

Verifies a user OpenID token.

    POST /verify/user
    Content-Type: application/json

Request body:

```json
{
  "token": "secret token"
}
```

If `UVS_OPENID_VERIFY_ANY_HOMESERVER` is set to `true`, the API also
requires a `matrix_server_name`, becoming:

```json
{
  "matrix_server_name": "domain.tld",
  "token": "secret token"
}
```

Successful validation response:

```json
{
  "results": {
    "user": true
  },
  "user_id": "@user:domain.tld"
}
```

Failed validation:

```json
{
  "results": {
    "user": false
  },
  "user_id": null
}
```

#### Verify OpenID token and room membership

Verifies a user OpenID token and membership in a room.

    POST /verify/user_in_room
    Content-Type: application/json

Request body:

```json
{
  "room_id": "!foobar:domain.tld",
  "token": "secret token"
}
```

If `UVS_OPENID_VERIFY_ANY_HOMESERVER` is set to `true`, the API also
requires a `matrix_server_name`, becoming:

```json
{
  "matrix_server_name": "domain.tld",
  "room_id": "!foobar:domain.tld",
  "token": "secret token"
}
```

Successful validation response:

```json
{
  "results": {
    "room_membership": true,
    "user": true
  },
  "user_id": "@user:domain.tld",
  "power_levels": {
    "room": {
      "ban": 50,
      "events": {
        "m.room.avatar": 50,
        "m.room.canonical_alias": 50,
        "m.room.history_visibility": 100,
        "m.room.name": 50,
        "m.room.power_levels": 100
      },
      "events_default": 0,
      "invite": 0,
      "kick": 50,
      "redact": 50,
      "state_default": 50,
      "users_default": 0
    },
    "user": 50
  }
}
```

Failed validation, in case token is not valid:

```json
{
  "results": {
    "room_membership": false,
    "user": false
  },
  "user_id": null,
  "power_levels": null
}
```

In the token was validated but user is not in room, the failed response is:

```json
{
  "results": {
    "room_membership": false,
    "user": true
  },
  "user_id": "@user:domain.tld",
  "power_levels": null
}
```

### Running

```
npm start
```

### Development

Run in watch mode.

```
npm dev
```

## License

Apache 2.0
