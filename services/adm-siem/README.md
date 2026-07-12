# ADM SIEM

Back4App wrapper for the Agentic Defense Matrix SIEM image used by the local
compose stack.

Back4App settings:

- Root directory: `services/adm-siem`
- Port: `9091`
- Env vars:
  - `ADM_REDIS_ADDR=<redis-host>:6379`

The implementation source is external; this repo deploys the published image:

```text
ghcr.io/jest-test-team/adm-siem:latest
```
