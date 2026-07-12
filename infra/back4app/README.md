# Back4App Container Deployment Roots

Back4App deploys one container per app and expects a `Dockerfile` in the
selected root directory. The local `infra/docker/docker-compose.yml` stack maps
to separate Back4App apps:

| Compose service | Back4App app root | Port | Notes |
|---|---:|---:|---|
| `trust-gateway` | `./` | `8080` | Root `Dockerfile` builds `services/gateway`. |
| `redis` | `infra/back4app/redis` | `6379` | Set gateway `REDIS_URL=redis://<redis-app-host>:6379/0`. |
| `mosquitto` | `infra/back4app/mosquitto` | `1883` | Set gateway `MQTT_URL=tcp://<mosquitto-app-host>:1883`. |
| `postgres` | `infra/back4app/postgres` | `5432` | Demo database only. Production should keep using Neon primary + Supabase backup. |
| `adm-gateway` | `services/adm-gateway` | `8080` | Uses `ghcr.io/jest-test-team/adm-gateway:latest`; also exposes gRPC `9090`. |
| `adm-siem` | `services/adm-siem` | `9091` | Uses `ghcr.io/jest-test-team/adm-siem:latest`. |
| `adm-stack` | `services/adm-stack` | `8080` | Optional combined ADM gateway + SIEM source-built container. |
| `erh-engine` | `services/erh-engine` | `8000` | Vendored ERH engine and `erh_core` copied into this repo. |

## Gateway env after deploying dependencies

Set these on the `trust-gateway` Back4App app:

```env
GATEWAY_PORT=8080
GATEWAY_API_KEY=replace-with-shared-demo-key
WEBHOOK_SECRET=replace-with-webhook-secret
ERH_SERVICE_URL=https://<erh-engine-app>.b4a.run
REDIS_URL=redis://<redis-app-host>:6379/0
MQTT_URL=tcp://<mosquitto-app-host>:1883
CORS_ALLOWED_ORIGINS=https://<vercel-frontend>.vercel.app,http://localhost:3000
```

For database-backed milestones, prefer:

```env
DATABASE_URL=<Neon pooled connection string>
```

Use the `infra/back4app/postgres` app only for a Back4App-only demo stack. The
current gateway still uses in-memory repositories unless the Postgres repository
milestone is enabled.

## ERH deployment

The ERH engine is vendored into this repository at `services/erh-engine` so
Back4App can deploy it from the same GitHub repository as the gateway. Create a
separate Back4App app with:

```text
Root directory: services/erh-engine
Port: 8000
Env: ERH_MODE=rest
```
