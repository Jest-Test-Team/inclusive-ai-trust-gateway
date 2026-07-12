# ADM Stack

Combined Back4App deployment for the Agentic Defense Matrix gateway and SIEM
engine. This service vendors the minimal ADM Go source needed to build:

- `cmd/gateway`
- `cmd/siem_engine`
- `pkg/*`

Back4App settings:

- Root directory: `services/adm-stack`
- Port: `8080`
- Env vars:
  - `ADM_PORT=8080`
  - `ADM_GRPC_PORT=9090`
  - `ADM_SIEM_URL=http://127.0.0.1:9091`
  - `ADM_REDIS_ADDR=<redis-host>:6379`

This combined container is useful when Back4App free-plan limits make separate
ADM apps inconvenient. For production, separate `services/adm-gateway` and
`services/adm-siem` still give cleaner health checks, logs, and restarts.
