# ADM Stack

Combined Choreo deployment for the Agentic Defense Matrix gateway and SIEM
engine. This service vendors the minimal ADM Go source needed to build:

- `cmd/gateway`
- `cmd/siem_engine`
- `pkg/*`

Choreo settings (see `infra/choreo/README.md`):

- Component directory: `services/adm-stack`
- Build preset: Docker
- Port: `8080` (from `.choreo/component.yaml`)
- Env vars:
  - `ADM_PORT=8080`
  - `ADM_GRPC_PORT=9090`
  - `ADM_SIEM_URL=http://127.0.0.1:9091`
  - `ADM_SIEM_PORT=9091`

## Redis

The env var the code reads is **`ADM_REDIS_URL`** (a `redis://` URL, not a
host:port pair), and it is *optional* — SIEM and the battle emitter degrade
gracefully without it.

Choreo allows only three container components for this project (trust
gateway, adm-stack, erh-engine), so there is no separate Redis host. This image
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
