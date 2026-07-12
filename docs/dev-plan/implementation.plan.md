# Inclusive AI Trust Gateway — Implementation Plan (v2)

Target competition: **2026 Presidential Hackathon, International Track**
Theme: **Digital Inclusion in the AI Era** (數位共好：打造AI新未來)
Deadline: **July 31, 2026, 17:00 GMT+8** — preliminary judging: Feasibility 40% / Innovation 30% / Social Impact 30%.

Sources inspected: `hint.txt`, [MODA press release 20076](https://moda.gov.tw/press/press-releases/20076), [international-track rules](https://presidential-hackathon.taiwan.gov.tw/en/international-track/), [UCP protocol deep-dive](https://www.agenticcommerceguide.com/blog/the-ucp-protocol-a-comprehensive-technical-deep-dive), plus full source inspection of both engine repos (§2).

> **v2 supersedes v1.** After a gap review and a decision round with the project owner, this revision commits to: real ADM + ERH container integration, a Next.js/Expo monorepo, a Go gateway, and **all seven interface protocols live by July 31**. v1's hosting decisions (Back4App containers, Vercel FE, Neon Postgres, Cloudflare) still stand.

---

## 1. Decision Log (owner-confirmed, 2026-07-12)

| # | Decision | Choice |
|---|---|---|
| D1 | Protocols live by Jul 31 | **All seven**: REST, WebSocket, Connect-RPC, GraphQL, MQTT, MCP, UCP |
| D2 | Engine integration | **Real containers via compose** — no stubs in the demo path |
| D3 | Frontend | **Next.js web ships Jul 31**; Expo React Native scaffolded now, ships post-submission (finals adds Implementation 30% in Oct) |
| D4 | Gateway framework | **Go 1.23** (chi router + ent ORM) — owner override 2026-07-12: *backend must be Go or Rust, not NestJS*; Go chosen for alignment with the ADM codebase (same language, gRPC/buf toolchain, deploy patterns) |
| D5 | UCP theme fit | **Inclusive-commerce demo scenario** (§5.3) |
| D6 | MQTT broker + Redis in prod | **Back4App containers first**; fall back to Upstash Redis + HiveMQ Cloud if Back4App proves unworkable |
| D7 | Database | **Neon Postgres**; ORM is **ent** with Atlas-generated SQL migrations (Prisma fell with NestJS — it is TypeScript-only); **Supabase Postgres as backup** (§7.3) |
| D8 | Repo shape | **Full pnpm/Turborepo monorepo; the Vite dashboard is retired** after its logic is ported to `packages/shared` |
| D9 | tRPC requirement | **Replaced by Connect-RPC** (connectrpc.com) — tRPC cannot run in a Go backend; Connect-RPC gives the same end-to-end type-safety via schema-first codegen (native Go server, generated TypeScript client for apps/web) |

## 2. Engine Gap Review (what integration actually means)

The v1 assumption that both engines need "wrapping" was wrong — both already expose deployable service surfaces:

### Agentic Defense Matrix (`~/Documents/GitHub/Agentic Defense Matrix (ADM)`, Go)
- **API gateway** `cmd/gateway`: REST `:8080` + gRPC `:9090`; **SIEM engine** `cmd/siem_engine` `:9091`; Redis 7 for sessions/streams; red/green agents for live exercises.
- Prebuilt images on **GHCR** (`ghcr.io/jest-test-team/adm-gateway`, etc.) and a working `docker-compose.yml`.
- A live hosted deployment (`api.dennisleehappy.org`: `/api/stats`, `/api/stream` SSE, `/api/system`, `/health`) usable as a fallback data source if local containers misbehave during the demo.
- Research-grade detection: intent-drift (embedding-φ), containment primitives with measured µs-level latency.

### Ethic-Latex / ERH (`~/Documents/GitHub/Ethic-Latex`, Python)
- **`erh_engine`**: standardized evaluation service — one contract (`Sample → EvaluateRequest/EvaluateResponse`) via **REST `POST /v1/evaluate` + gRPC `ERHEngine.Evaluate`**, own Dockerfile, 7 passing parity tests.
- Extra endpoints reusable for our scenario: `POST /v1/iam/audit` (least-privilege divergence), `POST /v1/ueba/evaluate` (behavioral drift).
- Verified surfaces documented in its README (status 2026-04-12); we integrate **only** `erh_engine`, not the experimental UI surfaces.

**Integration contract (gateway side):**

| Direction | Transport | Payload |
|---|---|---|
| gateway → erh-engine | REST (gRPC later) | service-outcome `Sample[]` → fairness / error-growth (`α`) indicators |
| adm-gateway → gateway | Webhook POST `/v1/adm/events` + MQTT topic `adm/events/#` | safety events (prompt-injection, tool-policy, containment) |
| gateway → dashboard | WebSocket `/ws` | live safety feed + assessment updates |
| gateway → adm-gateway | REST | register monitored sessions for the UCP commerce scenario |

## 3. Monorepo Layout (D8)

```text
inclusive-ai-trust-gateway/
├── apps/
│   ├── web/            Next.js 15 dashboard (Vercel) — Connect-RPC + REST + WS client
│   └── mobile/         Expo React Native (scaffold now, ship post-submission)
├── services/
│   └── gateway/        Go API (Back4App container)
├── packages/
│   └── shared/         TS types, zod schemas, scoring logic ported from src/, API + WS clients
├── infra/
│   ├── docker/         Dockerfiles + docker-compose.yml (full stack incl. engines)
│   └── database/       SQL migrations (Atlas from ent), security (roles/RLS), backup runbook
├── adapters/           ERH / ADM integration notes (kept as docs)
├── docs/               plans, architecture, submission
├── tests/              Robot Framework acceptance suites
└── (src/ removed — logic lives in packages/shared, UI in apps/web)
```

Tooling: pnpm workspaces + Turborepo (`turbo run build|test|lint` across packages), shared `tsconfig.base.json`.

## 4. Gateway Architecture (D4) — pattern map

The owner's required backend patterns map to concrete Go artifacts:

| Requested pattern | Artifact in `services/gateway/` |
|---|---|
| Request DTO / Form payload | `internal/*/dto/*_request.go` structs — `go-playground/validator` tags |
| Response DTO | `internal/*/dto/*_response.go` structs — explicit mapping functions, never raw entities |
| Validation schema | validator tags (HTTP/MQTT payloads) + protobuf validation (Connect-RPC) + zod in `packages/shared` (FE side) |
| Entity (ORM) | **ent** schemas (`internal/ent/schema/`) + generated typed client |
| Value objects (VO/"vto") | `internal/domain/*.go` (e.g. `Score`, `Severity`, `TrustVerdict` with invariant constructors) |
| ViewModel / VM | `internal/*/vm/*.go` — UI-shaped projections returned by query handlers |
| CQRS command/query objects | `internal/*/commands/`, `internal/*/queries/` — command/query structs + handler interfaces wired through a small dispatch bus (`internal/platform/cqrs`) |
| Middleware | chi middleware chain: API-key auth, request validation, structured logging, recovery, CORS, rate headers |
| Redis | go-redis: ERH result cache, pub/sub event bus (WS/MQTT fan-out), rate counters |
| Webhooks | `internal/platform/webhooks` dispatcher (HMAC-signed) + `/v1/adm/events` inbound webhook |

Module layout:

```text
services/gateway/ (Go 1.23)
├── cmd/gateway/main.go
├── internal/
│   ├── assessments/   commands/ · queries/ · dto/ · vm/
│   ├── adm/           inbound webhook + MQTT subscriber · event publisher
│   ├── erh/           REST client → erh-engine · Redis-cached · circuit breaker w/ deterministic fallback
│   ├── commerce/      UCP scenario module (§5.3)
│   ├── transport/     rest/ · ws/ · graphql/ (gqlgen) · mqtt/ (paho) · mcp/ (go-sdk) · connect/ (Connect-RPC)
│   ├── domain/        value objects
│   ├── ent/           ent schemas + generated client
│   └── platform/      cqrs bus · redis · webhooks · middleware · config
├── proto/             Connect-RPC service definitions (buf)
└── go.mod
```

## 5. Protocol Plan (D1) — all seven by Jul 31

| Protocol | Surface | Consumer | Vehicle | Demo proof |
|---|---|---|---|---|
| REST | `/v1/assessments`, `/v1/adm/events`, `/v1/erh/evaluate`, `/healthz` | web/mobile, partners, Robot | chi handlers → CQRS bus | Robot `api` suite |
| WebSocket | `/ws` — safety-event + assessment stream | dashboard live feed | nhooyr/websocket over Redis pub/sub | dashboard shows ADM event within seconds |
| Connect-RPC | `/iatg.v1.TrustService/*` — typed dashboard ops | apps/web (generated TS client), grpc-compatible partners | connectrpc + buf codegen from `proto/` | e2e type-safe query in web app |
| GraphQL | `/graphql` — read model (assessments, events, personas) | partners/analysts | gqlgen (schema-first) | GraphiQL query in demo video |
| MQTT | `adm/events/#`, `telemetry/#` topics | ADM exporter, IoT-style sensors | eclipse/paho.golang subscriber + Mosquitto broker | publish → appears on dashboard via WS |
| MCP | MCP server: `get_assessment`, `evaluate_service`, `list_safety_events`, `check_agent_trust` tools | any MCP client (Claude, IDEs, agents) | official `modelcontextprotocol/go-sdk`, streamable-HTTP at `/mcp` | Claude queries the gateway live |
| UCP | inclusive-commerce endpoints (§5.3) | shopping agent in demo | `commerce/` module | scripted agent purchase, trust-gated |

### 5.1 Sequencing rule
REST is the substrate (week 1). WS + MQTT ride the same event bus (Redis pub/sub). GraphQL + Connect-RPC are read-model projections of the same CQRS queries — cheap once queries exist. MCP + UCP are thin adapters over commands/queries. **No protocol gets its own business logic**; all seven front the same CQRS core, which is what makes "all seven" feasible in 19 days.

### 5.2 MCP framing for judges
"Any AI agent can ask the gateway whether a public AI service is safe and inclusive before using it" — this is the innovation headline (30% of preliminary score).

### 5.3 UCP inclusive-commerce scenario (D5)
Demo story: **an elderly, low-digital-literacy citizen delegates shopping for care products to an AI agent.**
1. The agent transacts with a mock merchant through UCP (discovery → offer → checkout intent), JSON over HTTP/2-style request/response with UCP's extensibility fields.
2. Every UCP call is proxied through the trust gateway: **ADM** watches the agent's tool-calls/session for drift or injection; **ERH** scores the fairness of offers shown to this persona (price discrimination, dark patterns, accessibility of terms).
3. The dashboard shows the transaction trace with trust verdicts; a blocked malicious variant (agent hijacked mid-session → ADM containment) is the money shot.
This makes UCP the theme showcase — *inclusion means people who can't navigate e-commerce themselves can safely delegate to agents*.

## 6. Frontend & Mobile (D3)

- **apps/web (Next.js 15, App Router)** — ships Jul 31 on Vercel:
  - Trust dashboard (port of current UI): scores, gaps, mitigation plan.
  - Live safety feed (WS) + UCP commerce-trace view.
  - i18n scaffold (en default, zh-TW secondary) + WCAG 2.1 AA pass — judged under the theme.
  - Data via the generated Connect-RPC TypeScript client (typed) with REST fallback.
- **apps/mobile (Expo)** — scaffold only by Jul 31: navigation shell, shared API client from `packages/shared`, one read-only assessments screen. Shipped for finals (Oct).

## 7. Data Layer (D7)

### 7.1 Schema (ent schemas in `services/gateway/internal/ent/schema/`, SQL source of truth in `infra/database/`)
v1's tables carry over (`use_cases`, `personas`, `assessments`, `evidence`, `safety_events`, `open_data_sources`) plus:

```text
commerce_sessions(id, use_case_id, agent_id, persona_id, status, started_at)
commerce_events(id, session_id, ucp_action, payload jsonb, trust_verdict, created_at)
webhook_subscriptions(id, url, secret_hash, event_types text[], active)
```

### 7.2 Migrations & security (`infra/database/`)
- `migrations/` — versioned SQL generated from ent schemas via Atlas (`atlas migrate diff`), committed; applied with `atlas migrate apply` (or golang-migrate) in CI/deploy.
- `security/` — SQL for roles (`gateway_rw`, `readonly_analyst`), RLS policies on `safety_events` and `commerce_*`, plus connection-security notes (Neon requires TLS; pooled connection string for serverless).

### 7.3 Neon primary + Supabase backup
- Primary: Neon (pooled `DATABASE_URL`).
- Backup: Supabase Postgres kept schema-identical by running the same committed migrations in CI against both; nightly `pg_dump` from Neon restored to Supabase (GitHub Actions cron). Failover = swap `DATABASE_URL` env var on Back4App. Documented as `infra/database/BACKUP_RUNBOOK.md`. (True streaming replication is out of scope for the hackathon.)

## 8. Infra (`infra/docker`, D2 + D6)

```yaml
# infra/docker/docker-compose.yml (composition, abridged)
services:
  trust-gateway:   # build: infra/docker/gateway.Dockerfile  → :3001
  erh-engine:      # build: ../../../Ethic-Latex (erh_engine/Dockerfile) → :8000
  adm-gateway:     # image: ghcr.io/jest-test-team/adm-gateway:latest → :8080/:9090
  adm-siem:        # image: ghcr.io/jest-test-team/adm-siem:latest    → :9091
  mosquitto:       # eclipse-mosquitto:2 → :1883
  redis:           # redis:7-alpine → :6379 (shared by gateway + ADM)
  postgres:        # postgres:16-alpine → :5432 (dev only; Neon in prod)
```

- The ERH build context points at the sibling checkout; CI and other machines can override with `ERH_CONTEXT` env or pull a pushed image once we publish one.
- Prod (Back4App): one container app each for `trust-gateway`, `erh-engine`, `adm-gateway`, `adm-siem`, `mosquitto`, `redis` (D6: if Back4App networking/persistence blocks Mosquitto or Redis, fall back to HiveMQ Cloud / Upstash and change only env vars).
- Cloudflare fronting (unchanged from v1 §5): `app.<domain>` → Vercel, `api.<domain>` → trust-gateway, `mqtt.<domain>` → broker (or direct), WAF + rate limits on `/v1/*`, `/graphql`, `/trpc`, `/mcp`.

## 9. Testing

- **Unit/integration**: `go test` in `services/gateway` (CQRS handlers, VOs, ERH client fallback, DTO validation), Vitest in `packages/shared`.
- **Robot Framework (`tests/`)**: existing `api`/`smoke` suites now target the Go gateway; add suites: `graphql.robot`, `websocket.robot`, `mqtt.robot` (paho publish → WS assert), `commerce_ucp.robot` (scenario walk), all still driven by `BASE_URL`/`APP_URL` variables.
- **GHAS**: CodeQL matrix gains **`go`** (the gateway is first-party Go code); Dependabot gains `gomod` for `services/gateway`, `npm` for the new workspaces, and `docker` for `infra/docker`.
- **CI**: turbo-aware jobs — `gateway-test` (`go vet` + `go test`), `web-build`, `robot-smoke` (unchanged), nightly `robot-full` against the compose stack via `docker compose -f infra/docker/docker-compose.yml up`.

## 10. Work Breakdown v2 — subtasks and commit points

| # | Subtask | Key deliverable | Target |
|---|---|---|---|
| A | ✅ This plan + architecture.md rewrite | docs committed | Jul 12 |
| B | Monorepo restructure | packages/shared ported, Vite retired, turbo green | Jul 13 |
| C | Gateway core (Go) | REST + CQRS + ent + Redis + webhooks + `go test` green | Jul 16 |
| D | Event bus + WS + MQTT | ADM events → Redis → WS/MQTT, live feed demo | Jul 18 |
| E | GraphQL + Connect-RPC | read model projections, web app typed calls | Jul 19 |
| F | infra/docker + infra/database | full compose up with real engines; migrations + security SQL | Jul 20 |
| G | apps/web dashboard | ported UI + live feed on Vercel | Jul 22 |
| H | MCP server | agent queries trust tools end-to-end | Jul 23 |
| I | UCP commerce scenario | trust-gated agent purchase + containment demo | Jul 26 |
| J | apps/mobile scaffold | Expo shell + shared client | Jul 27 |
| K | Robot suites for new surfaces + CI update | all suites green locally + CI | Jul 28 |
| L | Deploy: Back4App + Vercel + Neon/Supabase + Cloudflare | live URLs | Jul 29 |
| M | Submission package + demo video | docs/hackathon-submission.md final | **Jul 30** |

Commit convention: one commit minimum per subtask, more per coherent slice.

## 11. Risks (v2)

1. **All-seven-protocols scope** — mitigated by §5.1 (thin adapters over one CQRS core); if the schedule slips ≥3 days by Jul 22, MQTT and GraphQL degrade to compose-only demos (owner accepted fallback ladder in D6-style ordering).
2. **ADM GHCR images are built for the ADM exercise loop** — may need env flags to run standalone; fallback: `docker compose` build from ADM source checkout, or the live hosted API as data source.
3. **ERH build context is a sibling checkout** — pin a commit SHA in `infra/docker/README.md`; publish our own image tag before Jul 20.
4. **Back4App private networking between 6-7 containers** is unproven — D6 fallback to managed Redis/MQTT keeps only stateless apps on Back4App.
5. **19-day runway** — apps/mobile and finals-only features are explicitly deferred; the demo video is recorded from the compose stack, deployment is the redundancy.
