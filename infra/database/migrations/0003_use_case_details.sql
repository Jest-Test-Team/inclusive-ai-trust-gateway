-- 0003_use_case_details: columns needed to round-trip the full use-case
-- payload through the gateway's Postgres repositories.

BEGIN;

ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS target_users text[] NOT NULL DEFAULT '{}';
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS ai_capabilities text[] NOT NULL DEFAULT '{}';
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS safeguards text[] NOT NULL DEFAULT '{}';

COMMIT;
