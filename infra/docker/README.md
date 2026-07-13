# Docker Infrastructure

Compose stack and Dockerfiles for the full demo environment described in
`docs/architecture.md`.

## Services

| Service | Source | Port(s) | Notes |
|---|---|---|---|
| trust-gateway | `gateway.Dockerfile` (this repo, Go) | 8080 | all seven protocol surfaces |
| erh-engine | sibling `Ethic-Latex` checkout, `erh_engine/Dockerfile` | 8000 | REST `POST /v1/evaluate` |
| adm-gateway | `ghcr.io/jest-test-team/adm-gateway` | 8081, 9090 | profile `adm` |
| adm-siem | `ghcr.io/jest-test-team/adm-siem` | 9091 | profile `adm` |
| mosquitto | `eclipse-mosquitto:2` | 1883 | demo config, no auth |
| redis | `redis:7-alpine` | 6379 | cache + pub/sub bus |
| postgres | `postgres:16-alpine` | 5432 | dev only; prod = Neon |

## Usage

```bash
# Core stack (gateway + ERH + broker + redis + postgres)
docker compose -f infra/docker/docker-compose.yml up --build

# Include the ADM engine containers
docker compose -f infra/docker/docker-compose.yml --profile adm up

# ERH checkout in a non-default location
ERH_CONTEXT=/path/to/Ethic-Latex docker compose -f infra/docker/docker-compose.yml up
```

Smoke-check the running stack with the Robot suites:

```bash
robot --include api --variable BASE_URL:http://127.0.0.1:8080 tests/robot/api
```

## Production mapping (Choreo)

Three Service components on [console.choreo.dev](https://console.choreo.dev):
`trust-gateway` (repo root), `adm-stack`, and `erh-engine`. Postgres uses Neon;
gateway Redis/MQTT use in-process degradation, Upstash, or HiveMQ Cloud when
not running the full compose stack. See `infra/choreo/README.md` for env vars.

## Security notes

- The demo Mosquitto allows anonymous connections; production must enable
  auth + TLS (HiveMQ Cloud enforces both).
- `trust-gateway` runs distroless as non-root.
- Secrets (`GATEWAY_API_KEY`, `WEBHOOK_SECRET`) come from the environment —
  never bake them into images. GHAS push protection guards the repo side.
