# Tests

Robot Framework acceptance suites for the Inclusive AI Trust Gateway. The same
suites run against local dev servers, Back4App staging, and the
Cloudflare-fronted production URLs by overriding two variables.

## Layout

```text
tests/
+-- requirements.txt               # pinned Python deps
+-- robot/
    +-- resources/common.resource  # BASE_URL / APP_URL / API_KEY + shared keywords
    +-- api/
    |   +-- health.robot           # gateway liveness            [smoke, api]
    |   +-- assessments.robot      # /v1 contract tests          [api]
    |   +-- graphql.robot          # /graphql read model         [api, graphql]
    |   +-- ucp_commerce.robot     # UCP trust-gating scenario   [api, ucp]
    +-- web/
        +-- dashboard_smoke.robot  # FE shell + rendered UI      [smoke, ui]
```

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r tests/requirements.txt
```

## Running

Smoke only (what CI runs on every push — no browser required except the
HTTP shell check):

```bash
robot --include smoke --variable APP_URL:http://127.0.0.1:4173 \
      --outputdir tests/results tests/robot/web
```

Full API suite against a deployed gateway:

```bash
GATEWAY_API_KEY=... robot --include api \
      --variable BASE_URL:https://api.<domain> \
      --outputdir tests/results tests/robot/api
```

UI suite (needs Chrome/Chromium):

```bash
robot --include ui --variable APP_URL:https://app.<domain> \
      --outputdir tests/results tests/robot/web
```

## Tags

| Tag | Meaning |
|---|---|
| `smoke` | Fast, dependency-light; gates every push in CI |
| `api` | Gateway contract tests; require a running gateway (subtask 4+) |
| `ui` | Selenium browser tests; require headless Chrome |
| `security` | Auth/abuse-focused cases; also part of `api` runs |

The `api`-tagged suites run against the Go gateway (`services/gateway`) —
locally via `go run ./cmd/gateway`, in CI via the `gateway` job, and against
Back4App/Cloudflare deployments via `BASE_URL`. Results land in
`tests/results/` (gitignored).
