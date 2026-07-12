#!/usr/bin/env bash
# Apply all migrations in order against $DATABASE_URL (Neon, Supabase, or
# local). Files are idempotent, so re-running is safe.
#
#   DATABASE_URL=postgres://... infra/database/scripts/apply.sh
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to the target Postgres connection string}"

dir="$(cd "$(dirname "$0")/../migrations" && pwd)"
for f in "$dir"/*.sql; do
  echo ">> applying $(basename "$f")"
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f "$f"
done
echo "done"
