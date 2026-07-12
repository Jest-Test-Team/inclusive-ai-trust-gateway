# Gateway Service

This folder reserves the future API boundary for the production gateway.

## Planned Endpoints

- `POST /v1/assessments`
- `GET /v1/assessments/:id`
- `POST /v1/erh/evaluate`
- `POST /v1/adm/events`
- `GET /v1/open-data/readiness`

## Contract Goals

- Keep public-service assessment data separate from raw sensitive records.
- Store only minimised, auditable evidence.
- Preserve traceability from mitigation recommendation back to source signals.

