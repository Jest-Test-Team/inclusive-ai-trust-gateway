# Environment & Deployment Instructions

Backend containers deploy on **[Choreo](https://console.choreo.dev)** (three
Service components, stable public URLs). This file lists **which env value to
set in which service** and which source file reads each value.

See also `infra/choreo/README.md` for console setup steps.

## The dependency map

```text
Vercel (apps/web)
 ├── /api/gateway/*  ──▶  trust-gateway  (Choreo, build context: ./)
 │                          └── calls ──▶ erh-engine   (ERH_SERVICE_URL)
 │                          └── stores ──▶ Neon Postgres (DATABASE_URL)
 ├── /api/adm/*      ──▶  adm-stack      (Choreo, build context: services/adm-stack)
 └── /api/erh/*      ──▶  erh-engine     (Choreo, build context: services/erh-engine)

apps/mobile (Expo) and apps/demo (Vite) ──▶ Vercel /api/gateway (one URL,
engine proxy URLs derived automatically)
```

---

## 1. Vercel project `inclusive-ai-trust-gateway-web`

**These are the values you touch most.** Env vars here **override** repo
defaults. If a var holds a dead URL the dashboard breaks. After changing env
values you must **Redeploy** (env changes don't apply to existing deployments).

| Env var | Set to | Read by (source file) |
|---|---|---|
| `GATEWAY_API_BASE_URL` | Choreo `trust-gateway` public URL | `apps/web/pages/api/gateway/[...path].ts` |
| `GATEWAY_API_KEY` | same value as `GATEWAY_API_KEY` on the Choreo gateway component | same file (injected as `X-Api-Key`, never sent to the browser) |
| `ADM_API_BASE_URL` | Choreo `adm-stack` public URL | `apps/web/pages/api/adm/[...path].ts` |
| `ERH_API_BASE_URL` | Choreo `erh-engine` public URL | `apps/web/pages/api/erh/[...path].ts` |
| `NEXT_PUBLIC_API_BASE_URL` | Choreo `trust-gateway` public URL (browser-visible; WebSocket live feed) | `apps/web/lib/api.ts` |
| `NEXT_PUBLIC_API_KEY` | gateway key (browser-visible — use a demo key, not a secret one) | `apps/web/lib/api.ts` |

All proxies share `apps/web/lib/serverProxy.ts` (env resolution, API-key
injection, redirect-safe forwarding, 503-on-unset / 502-on-unreachable).

## 2. Choreo component `trust-gateway` (build context `./`, Port **8080**)

| Env var | Set to | Read by |
|---|---|---|
| `GATEWAY_PORT` | `8080` | `services/gateway/internal/platform/config/config.go` |
| `GATEWAY_API_KEY` | your chosen agency key (must match Vercel) | same + `internal/platform/middleware/apikey.go` |
| `WEBHOOK_SECRET` | any secret (HMAC for outbound webhooks) | same + `internal/platform/webhooks/dispatcher.go` |
| `ERH_SERVICE_URL` | Choreo `erh-engine` public URL — if unset, assessments fall back to `evaluator: deterministic-fallback` | `internal/erh/evaluator.go` (client), fallback in `internal/erh/fallback.go` |
| `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...` host, `sslmode=require`) | `internal/platform/postgres/postgres.go`, repositories |
| `AUTO_MIGRATE` | leave unset (defaults on); `0` to disable boot migrations | `internal/platform/config/config.go` |
| `REDIS_URL` | optional — unset = in-process bus; or Upstash `rediss://...` | `internal/platform/eventbus/eventbus.go` |
| `MQTT_URL` | optional — unset = disabled; or HiveMQ Cloud `ssl://...` | `services/gateway/cmd/gateway/main.go`, `internal/transport/mqtt/mqtt.go` |
| `CORS_ALLOWED_ORIGINS` | Vercel frontend origin(s) | `internal/platform/config/config.go` |

## 3. Choreo component `adm-stack` (build context `services/adm-stack`, Port **8080**)

| Env var | Set to | Read by |
|---|---|---|
| `ADM_PORT` | `8080` | `services/adm-stack/source/cmd/gateway` |
| `ADM_GRPC_PORT` | `9090` | same |
| `ADM_SIEM_URL` | `http://127.0.0.1:9091` (SIEM runs in the same container) | same |
| `ADM_SIEM_PORT` | `9091` | `services/adm-stack/source/cmd/siem_engine` |
| `ADM_EMBED_REDIS` | leave unset (defaults on — Redis runs **inside** this container) | `services/adm-stack/entrypoint.sh` |
| `ADM_REDIS_URL` | leave unset (defaults `redis://127.0.0.1:6379/0`) | `services/adm-stack/source/cmd/siem_engine/redis.go` |

## 4. Choreo component `erh-engine` (build context `services/erh-engine`, Port **8000**)

| Env var | Set to | Read by |
|---|---|---|
| `ERH_MODE` | `rest` | `services/erh-engine/erh_engine/serve.py` |
| `PORT` | `8000` (Choreo may inject this automatically) | same |

## 5. Mobile & offline demo (only if you use them)

| App | Env var | Set to |
|---|---|---|
| `apps/mobile` (Expo) | `EXPO_PUBLIC_API_BASE_URL` | `https://<vercel-app>.vercel.app/api/gateway` |
| `apps/demo` (Vite) | `VITE_API_BASE_URL` | same value |

Engine URLs are derived automatically by `packages/shared/src/engineApi.ts`
when the base URL ends with `/api/gateway`.

---

## URL change runbook

Choreo public URLs are **stable per component** (unlike Back4App temporary
`*.b4a.run` hosts). Update env vars only when you recreate a component or
change environments (Development → Production).

| Which component URL changed? | Update these values |
|---|---|
| **trust-gateway** | Vercel: `GATEWAY_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` → redeploy Vercel |
| **erh-engine** | Vercel: `ERH_API_BASE_URL`; Choreo gateway: `ERH_SERVICE_URL` → redeploy both |
| **adm-stack** | Vercel: `ADM_API_BASE_URL` → redeploy Vercel |

## Optional: Cloudflare custom domain

Point stable hostnames at the Choreo public endpoints once, then set Vercel
and gateway env vars to those hostnames. Example:

```text
api.<your-domain>  → trust-gateway Choreo public URL
adm.<your-domain>  → adm-stack       Choreo public URL
erh.<your-domain>  → erh-engine      Choreo public URL
```
