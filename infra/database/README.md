# Database

Schema, migrations, and security for the gateway's relational store.
Primary: **Neon Postgres**. Warm backup: **Supabase Postgres** (see
`BACKUP_RUNBOOK.md`). Local dev: the `postgres` service in
`infra/docker/docker-compose.yml`, which auto-applies `migrations/` on
first boot.

## Layout

```text
infra/database/
├── migrations/           versioned, idempotent SQL — the source of truth
│   ├── 0001_init.sql       core schema (plan §7.1)
│   └── 0002_security.sql   roles + row-level security
├── scripts/apply.sh      apply migrations to $DATABASE_URL
├── BACKUP_RUNBOOK.md     Neon↔Supabase sync + failover procedure
└── README.md
```

## Conventions

- New change = new `NNNN_description.sql` file; never edit an applied one.
- Every file must be idempotent (`IF NOT EXISTS` guards) so dev resets and
  the dual-target (Neon + Supabase) apply stay safe.
- Roles are `NOLOGIN` group roles; the actual login users granted into them
  are provider-managed and password-set out of band.
- The gateway persists to this schema when `DATABASE_URL` is set (pgx
  repositories in `services/gateway/internal/assessments/postgres_repository.go`
  and `internal/adm/postgres_store.go`); without it, in-memory repositories
  keep the demo alive. On boot the gateway applies an **embedded copy** of
  these migrations (`services/gateway/internal/platform/postgres/migrations/`,
  disable with `AUTO_MIGRATE=0`) — when adding a migration here, copy it
  there too; this directory stays canonical.

## Security model

- `gateway_rw`: service role — read/insert/update, **no delete** (audit
  evidence is append-only).
- `readonly_analyst`: dashboards and partner review — select only, and RLS
  hides telemetry rows younger than 15 minutes (redaction window).
- TLS is mandatory on both providers; local dev uses `sslmode=disable`
  only inside the compose network.
