# Environment & URL-Rotation Instructions

Back4App's free tier gives every container app a **temporary `*.b4a.run` URL
that rotates on redeploys** (and every push to `main` triggers a redeploy).
This file tells you exactly **which env value to change, in which service,
when a URL rotates** — and which source file reads each value.

## The dependency map

```text
Vercel (apps/web)
 ├── /api/gateway/*  ──▶  ai-trust-gateway  (Back4App, root: ./)
 │                          └── calls ──▶ erh-engine   (ERH_SERVICE_URL)
 │                          └── stores ──▶ Neon Postgres (DATABASE_URL)
 ├── /api/adm/*      ──▶  adm-stack        (Back4App, root: services/adm-stack)
 └── /api/erh/*      ──▶  erh-engine       (Back4App, root: services/erh-engine)

apps/mobile (Expo) and apps/demo (Vite) ──▶ Vercel /api/gateway (one URL,
engine proxy URLs derived automatically)
```

---

## 1. Vercel project `inclusive-ai-trust-gateway-web`

**These are the values you touch most.** Env vars here **override** the
defaults hardcoded in the repo, so if a var holds a dead URL the dashboard
breaks even when the code default is correct. After changing env values you
must **Redeploy** (env changes don't apply to existing deployments).

| Env var | Set to | Read by (source file) |
|---|---|---|
| `GATEWAY_API_BASE_URL` | current `ai-trust-gateway` URL, e.g. `https://aitrustgateway-xxxx.b4a.run` | `apps/web/pages/api/gateway/[...path].ts` |
| `GATEWAY_API_KEY` | same value as `GATEWAY_API_KEY` on the Back4App gateway app | same file (injected as `X-Api-Key`, never sent to the browser) |
| `ADM_API_BASE_URL` | current `adm-stack` URL | `apps/web/pages/api/adm/[...path].ts` |
| `ERH_API_BASE_URL` | current `erh-engine` URL | `apps/web/pages/api/erh/[...path].ts` |
| `NEXT_PUBLIC_API_BASE_URL` | current `ai-trust-gateway` URL (browser-visible; only used to build the WebSocket live-feed URL) | `apps/web/lib/api.ts` |
| `NEXT_PUBLIC_API_KEY` | gateway key (browser-visible — use a demo key, not a secret one) | `apps/web/lib/api.ts` |

All proxies share `apps/web/lib/serverProxy.ts` (env resolution, API-key
injection, redirect-safe forwarding, 503-on-unset / 502-on-unreachable).

## 2. Back4App app `ai-trust-gateway` (root directory `./`, Port **8080**)

| Env var | Set to | Read by |
|---|---|---|
| `GATEWAY_PORT` | `8080` | `services/gateway/internal/platform/config/config.go` |
| `GATEWAY_API_KEY` | your chosen agency key (must match Vercel) | same + `internal/platform/middleware/apikey.go` |
| `WEBHOOK_SECRET` | any secret (HMAC for outbound webhooks) | same + `internal/platform/webhooks/dispatcher.go` |
| `ERH_SERVICE_URL` | **current `erh-engine` URL** — update on every ERH rotation, else assessments fall back to `evaluator: deterministic-fallback` | `internal/erh/evaluator.go` (client), fallback in `internal/erh/fallback.go` |
| `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...` host, `sslmode=require`) — enables Postgres persistence + boot migrations | `internal/platform/postgres/postgres.go`, repositories in `internal/assessments/postgres_repository.go` and `internal/adm/postgres_store.go` |
| `AUTO_MIGRATE` | leave unset (defaults on); `0` to disable boot migrations | `internal/platform/config/config.go` |
| `REDIS_URL` | optional (`redis://...`) — cross-instance event fan-out; unset = in-process bus | `internal/platform/eventbus/eventbus.go` |
| `MQTT_URL` | optional (`tcp://broker:1883`) — enables the MQTT subscriber | `services/gateway/cmd/gateway/main.go`, `internal/transport/mqtt/mqtt.go` |

## 3. Back4App app `adm-stack` (root `services/adm-stack`, Port **8080**)

| Env var | Set to | Read by |
|---|---|---|
| `ADM_PORT` | `8080` | `services/adm-stack/source/cmd/gateway` |
| `ADM_GRPC_PORT` | `9090` | same |
| `ADM_SIEM_URL` | `http://127.0.0.1:9091` (SIEM runs in the same container) | same |
| `ADM_SIEM_PORT` | `9091` | `services/adm-stack/source/cmd/siem_engine` |
| `ADM_EMBED_REDIS` | leave unset (defaults on — Redis runs **inside** this container) | `services/adm-stack/entrypoint.sh` |
| `ADM_REDIS_URL` | leave unset (defaults `redis://127.0.0.1:6379/0`); only set for external Redis (`ADM_EMBED_REDIS=0` + `rediss://...`) | `services/adm-stack/source/cmd/siem_engine/redis.go`, `source/pkg/battle/emitter.go` |

Nothing here references other services, so **adm-stack never needs env
updates when URLs rotate** — others point at it, it points at nothing.

## 4. Back4App app `erh-engine` (root `services/erh-engine`, Port **8000**)

| Env var | Set to | Read by |
|---|---|---|
| `ERH_MODE` | `rest` | `services/erh-engine/erh_engine/serve.py` |

Also self-contained — no updates needed on rotation.

## 5. Mobile & offline demo (only if you use them)

| App | Env var | Set to |
|---|---|---|
| `apps/mobile` (Expo) | `EXPO_PUBLIC_API_BASE_URL` | `https://<vercel-app>.vercel.app/api/gateway` (stable — Vercel URLs don't rotate) |
| `apps/demo` (Vite) | `VITE_API_BASE_URL` | same value |

Because they point at the **Vercel** proxies (stable URL), they never need
touching when Back4App rotates. Engine URLs are derived automatically by
`packages/shared/src/engineApi.ts` (`deriveServiceEndpoints`).

---

## Rotation runbook — do this when a `b4a.run` URL changes

| Which app's URL rotated? | Update these values |
|---|---|
| **ai-trust-gateway** | Vercel: `GATEWAY_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` → redeploy Vercel |
| **erh-engine** | Vercel: `ERH_API_BASE_URL`; Back4App gateway app: `ERH_SERVICE_URL` → redeploy both |
| **adm-stack** | Vercel: `ADM_API_BASE_URL` → redeploy Vercel |

Remember: **pushing to `main` redeploys all three Back4App apps**, which can
rotate all three URLs at once — check the console after every push.

## The permanent fix: Cloudflare custom domain

Add your domain to Cloudflare and create three proxied CNAMEs:

```text
api.<your-domain>  → current ai-trust-gateway b4a.run host
adm.<your-domain>  → current adm-stack       b4a.run host
erh.<your-domain>  → current erh-engine      b4a.run host
```

Then set every env value above to the stable `https://api.<your-domain>`
form **once**. When Back4App rotates, you update **one CNAME record in
Cloudflare** and touch no env vars and no redeploys anywhere. (Back4App's
paid tier alternatively gives persistent URLs + custom domains directly.)
