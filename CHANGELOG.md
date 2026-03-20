# Changelog

## [2.0.0]

### Breaking Changes

- `SwarmAPI.submit()` is now async — update call sites to `await api.submit(...)`
- `SwarmAPI.getStatus()` is now async — update call sites to `await api.getStatus(...)`
