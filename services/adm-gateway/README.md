# ADM Gateway

Back4App wrapper for the Agentic Defense Matrix gateway image used by the
local compose stack.

Back4App settings:

- Root directory: `services/adm-gateway`
- Port: `8080`
- Env vars:
  - `ADM_PORT=8080`
  - `ADM_GRPC_PORT=9090`
  - `ADM_REDIS_ADDR=<redis-host>:6379`

The implementation source is external; this repo deploys the published image:

```text
ghcr.io/jest-test-team/adm-gateway:latest
```
