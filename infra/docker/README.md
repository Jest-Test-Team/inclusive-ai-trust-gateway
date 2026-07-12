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

## Production mapping (Back4App)

Each service above deploys as one Back4App container app; only env vars
change (`DATABASE_URL` → Neon pooled URL, `MQTT_URL`/`REDIS_URL` → internal
hostnames). Per plan D6, if Back4App networking blocks Mosquitto or Redis,
switch to HiveMQ Cloud / Upstash by changing those two env vars — no code
changes. The ADM images are pinned to `latest` during the hackathon; pin a
digest before the finals deployment.

## Security notes

- The demo Mosquitto allows anonymous connections; production must enable
  auth + TLS (HiveMQ Cloud enforces both).
- `trust-gateway` runs distroless as non-root.
- Secrets (`GATEWAY_API_KEY`, `WEBHOOK_SECRET`) come from the environment —
  never bake them into images. GHAS push protection guards the repo side.
