# Back4App Container Deployment Roots (deprecated)

> **Do not use for production.** Back4App free-tier container URLs are
> temporary (`*.b4a.run`, ~60 minutes). Deploy on
> **[Choreo](../choreo/README.md)** instead (`console.choreo.dev`, three
> stable Service components).

This directory is kept only for historical reference and local experiments.

## Former mapping

| Compose service | Back4App app root | Port |
|---|---:|---:|
| `trust-gateway` | `./` | `8080` |
| `redis` | `infra/back4app/redis` | `6379` |
| `mosquitto` | `infra/back4app/mosquitto` | `1883` |
| `postgres` | `infra/back4app/postgres` | `5432` |
| `adm-stack` | `services/adm-stack` | `8080` |
| `erh-engine` | `services/erh-engine` | `8000` |

See `infra/choreo/README.md` for the current three-component layout and env
var checklist.
