# Backup & Failover Runbook — Neon primary, Supabase warm backup

Decision D7 (implementation plan §7.3): Neon Postgres is the primary;
a Supabase Postgres project is kept schema-identical as a warm backup.

## Keeping the backup schema-identical

Both databases are only ever changed by the committed migrations:

```bash
DATABASE_URL=$NEON_URL     infra/database/scripts/apply.sh
DATABASE_URL=$SUPABASE_URL infra/database/scripts/apply.sh
```

CI applies migrations to both targets on merge to main (secrets
`NEON_DATABASE_URL`, `SUPABASE_DATABASE_URL`).

## Nightly data sync

GitHub Actions cron (03:30 Asia/Taipei):

```bash
pg_dump "$NEON_URL" --format=custom --no-owner --no-privileges -f nightly.dump
pg_restore --clean --if-exists --no-owner -d "$SUPABASE_URL" nightly.dump
```

Retention: the dump artifact is kept 7 days in Actions storage. This is a
warm backup (RPO ≤ 24 h), not replication — acceptable for the hackathon
demo; true logical replication is a post-finals item.

## Failover

1. Confirm Neon outage (status.neon.tech, `pg_isready`).
2. In Back4App, change the `trust-gateway` app's `DATABASE_URL` env var to
   the Supabase pooled connection string; redeploy (env-only, no build).
3. Verify `GET /healthz` and one `POST /v1/assessments` round-trip.
4. After Neon recovers: dump Supabase → restore to Neon (reverse of the
   nightly job), swap `DATABASE_URL` back.

## Connection requirements

- Neon: use the **pooled** connection string (`-pooler` host) with
  `sslmode=require`; the direct host is reserved for migrations.
- Supabase: use the transaction-mode pooler (port 6543) for the gateway and
  the session-mode port 5432 for migrations.
- Passwords for `gateway_rw`/`readonly_analyst` are set in the provider
  dashboards, never committed (see `migrations/0002_security.sql`).
