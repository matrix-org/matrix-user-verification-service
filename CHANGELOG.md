# Changelog

## unreleased

### Added

* Possibility to allow verifying any Matrix homeserver OpenID token. Default is still to
  only verify tokens against the configured homeserver. Room membership verification
  is still only done against the configured homeserver even if the token is for a user
  on another homeserver. ([related issue](https://github.com/matrix-org/matrix-user-verification-service/issues/3))

## v1.1.0

### Added

* Logging, defaults to `info` level, set different level with `UVS_LOG_LEVEL`.

## v1.0.1

No changes since v1.0.0, purely for triggering a Docker image.

## v1.0.0

Initial version.
