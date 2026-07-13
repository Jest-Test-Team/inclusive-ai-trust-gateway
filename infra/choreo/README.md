# Choreo Container Deployment

Production backend runs on [Choreo](https://console.choreo.dev) as **three
Service components** (the platform limit for this project). Each component
builds from a Dockerfile in this repository and gets a **stable public URL**
— unlike Back4App's temporary `*.b4a.run` URLs that expire after 60 minutes.

| Choreo component | Build context | Dockerfile | Port | Notes |
|---|---|---|---:|---|
| `trust-gateway` | `./` (repo root) | `Dockerfile` | `8080` | Go gateway (`services/gateway`) |
| `adm-stack` | `services/adm-stack` | `Dockerfile` | `8080` | Combined ADM gateway + SIEM; embeds Redis |
| `erh-engine` | `services/erh-engine` | `Dockerfile` | `8000` | Vendored Ethic-Latex ERH engine |

Local development still uses `infra/docker/docker-compose.yml`.

## 1. Create components in Choreo

For each row above, in [console.choreo.dev](https://console.choreo.dev):

1. Open your project → **Create** → **Service**.
2. Connect this GitHub repository and branch (`main`).
3. **Build preset:** Docker.
4. Set **Component directory** and **Dockerfile path** per the table.
5. Choreo reads `.choreo/component.yaml` from the build context for endpoint
   and deploy-form defaults.
6. **Build** → **Deploy** to Development (then promote as needed).

Dockerfiles already use non-root UID `10014`, which Choreo requires.

## 2. Gateway env (`trust-gateway`)

Set in the component's **Configs & Secrets** (or via `.choreo/component.yaml`
deploy form):

```env
GATEWAY_PORT=8080
GATEWAY_API_KEY=replace-with-long-random-api-key
WEBHOOK_SECRET=replace-with-long-random-webhook-secret
DATABASE_URL=postgresql://gateway_rw:password@ep-example-pooler.region.aws.neon.tech/iatg?sslmode=require
ERH_SERVICE_URL=https://<erh-engine-choreo-public-url>
CORS_ALLOWED_ORIGINS=https://<vercel-frontend>.vercel.app,http://localhost:3000
```

Optional (empty = graceful degradation):

```env
# In-process event bus when unset; or Upstash: rediss://default:token@host.upstash.io:6379
REDIS_URL=

# Disabled when unset; or HiveMQ Cloud: ssl://broker.example.s1.eu.hivemq.cloud:8883
MQTT_URL=
```

Copy each component's **public endpoint URL** from the Choreo component
overview after the first successful deploy.

## 3. ADM stack env (`adm-stack`)

Defaults are baked into the image; usually no changes needed:

```env
ADM_PORT=8080
ADM_EMBED_REDIS=1
ADM_REDIS_URL=redis://127.0.0.1:6379/0
```

For external Redis (e.g. Upstash), set `ADM_EMBED_REDIS=0` and point
`ADM_REDIS_URL` at the managed instance.

## 4. ERH engine env (`erh-engine`)

```env
ERH_MODE=rest
PORT=8000
```

After deploy, set `ERH_SERVICE_URL` on the gateway component to the ERH
public URL.

## 5. Frontend env (Vercel / Expo)

The web app proxies all upstreams same-origin so API keys stay server-side:

```env
GATEWAY_API_BASE_URL=https://<trust-gateway-choreo-public-url>
GATEWAY_API_KEY=<same key as gateway component>
ADM_API_BASE_URL=https://<adm-stack-choreo-public-url>
ERH_API_BASE_URL=https://<erh-engine-choreo-public-url>

# WebSocket live feed connects directly to the gateway (not through the proxy)
NEXT_PUBLIC_API_BASE_URL=https://<trust-gateway-choreo-public-url>
NEXT_PUBLIC_API_KEY=<demo key for browser WS auth>
```

Mobile and offline demo use the Vercel proxy path:

```env
EXPO_PUBLIC_API_BASE_URL=https://<vercel-app>.vercel.app/api/gateway
VITE_API_BASE_URL=https://<vercel-app>.vercel.app/api/gateway
```

## 6. What is not on Choreo

With only three container slots, **Postgres**, **MQTT**, and optional
**Redis** for the gateway use managed services:

| Concern | Production choice |
|---|---|
| Postgres | Neon primary (+ Supabase warm backup) |
| Gateway Redis | In-process bus, or Upstash |
| Gateway MQTT | HiveMQ Cloud, or disabled |
| ADM Redis | Embedded in `adm-stack` image (default) |

See `infra/database/BACKUP_RUNBOOK.md` for Postgres failover.

## 7. CI / push behaviour

Choreo rebuilds each component when its build context changes on the
connected branch. Pushing to `main` triggers builds for all three components
linked to that repo — plan env-var updates when promoting new gateway ↔ ERH
URLs.

## Deprecated: Back4App

`infra/back4app/` remains for reference only. Do not use Back4App temporary
URLs for production or demos that must stay online.
