# v3.0.0

### Breaking changes

* This project now requires Node 18 or greater.

### Added

* Added env variable `UVS_DISABLE_IP_BLACKLIST` to allow disabling the IP blacklist checks in private networks (contributed by @mm28ajos)

### Fixed

* Fallback to `users_default` if no power level is found for user in room power level check (contributed by @skolmer)

* Fix `UVS_DISABLE_IP_BLACKLIST` to cover all cases when Matrix is also on a local network (contributed by @thermaq)

### Internal changes

* Clarify `isDomainBlacklisted` by splitting it into two functions (contributed by @mm28ajos)

## v2.0.0

### Breaking changes

* Default behaviour has been changed to verify any OpenID tokens of any homeserver.
  Room membership verification is still only done against the configured homeserver 
  even if the token is for a user on another homeserver. 
  ([related issue](https://github.com/matrix-org/matrix-user-verification-service/issues/3))
  
  To disable this and allow verifying only a single configured homeserver, set
  the environment variable `UVS_OPENID_VERIFY_SERVER_NAME` to the relevant
  Matrix server name (for example `matrix.org`).
  
  If upgrading from v1.1.0, to keep the same behaviour, one should set
  `UVS_OPENID_VERIFY_SERVER_NAME` to the Matrix server name of the homeserver
  behind `UVS_HOMESERVER_URL`.
  
  Due to this addition, `matrix_server_name` is a new required field in verify endpoints.
  To not break backwards compatibility, this won't be enforced until earliest
  in the next major version.

### Added
  
* Added authentication token to protect the verification API's.

  Enable by setting `UVS_AUTH_TOKEN`.

### Changes

* Better documentation in readme.

* The `/verify/user_in_room` now also returns power levels of the room. In addition to
  the user power level in the room returned are the levels required for various actions
  in the room and default levels.

### Fixed

* Fix `requestLogger` to properly log the POST body, only redacting the token
  if it's given.

## v1.1.0

### Added

* Logging, defaults to `info` level, set different level with `UVS_LOG_LEVEL`.

## v1.0.1

No changes since v1.0.0, purely for triggering a Docker image.

## v1.0.0

Initial version.
