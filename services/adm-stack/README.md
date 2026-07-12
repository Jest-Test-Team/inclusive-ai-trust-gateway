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
  - `ADM_SIEM_PORT=9091`

## Redis

The env var the code reads is **`ADM_REDIS_URL`** (a `redis://` URL, not a
host:port pair), and it is *optional* — SIEM and the battle emitter degrade
gracefully without it.

Because the Back4App free tier allows only three container apps (trust
gateway, adm-stack, erh-engine), there is no separate Redis host. This image
therefore **embeds redis-server** and defaults to
`ADM_REDIS_URL=redis://127.0.0.1:6379/0` — no configuration needed.

To use a managed Redis (e.g. Upstash) instead, set:

```env
ADM_EMBED_REDIS=0
ADM_REDIS_URL=rediss://default:<password>@<upstash-host>:6379
```

This combined container is the canonical ADM deployment for this repo. It
replaces the old separate `services/adm-gateway` and `services/adm-siem`
wrappers.
