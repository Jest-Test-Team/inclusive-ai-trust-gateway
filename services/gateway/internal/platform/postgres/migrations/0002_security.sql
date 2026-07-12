-- 0002_security: least-privilege roles and row-level security.
-- Role creation is idempotent and password-less: set passwords out of band
-- (Neon/Supabase dashboards or ALTER ROLE), never in committed SQL.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gateway_rw') THEN
        CREATE ROLE gateway_rw NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly_analyst') THEN
        CREATE ROLE readonly_analyst NOLOGIN;
    END IF;
END
$$;

-- gateway_rw: the service account role for trust-gateway.
GRANT USAGE ON SCHEMA public TO gateway_rw;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO gateway_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO gateway_rw;
-- No DELETE: assessments and telemetry are append-only audit evidence.

-- readonly_analyst: dashboards, partner reviews, incident analysis.
GRANT USAGE ON SCHEMA public TO readonly_analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_analyst;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO readonly_analyst;

-- Row-level security on telemetry-bearing tables. The service role sees
-- everything; analysts see rows only after a privacy hold-back window,
-- giving agencies time to redact sensitive incident payloads.
ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY safety_events_rw ON safety_events
    FOR ALL TO gateway_rw USING (true) WITH CHECK (true);
CREATE POLICY commerce_events_rw ON commerce_events
    FOR ALL TO gateway_rw USING (true) WITH CHECK (true);
CREATE POLICY commerce_sessions_rw ON commerce_sessions
    FOR ALL TO gateway_rw USING (true) WITH CHECK (true);

CREATE POLICY safety_events_analyst ON safety_events
    FOR SELECT TO readonly_analyst
    USING (received_at < now() - interval '15 minutes');
CREATE POLICY commerce_events_analyst ON commerce_events
    FOR SELECT TO readonly_analyst
    USING (created_at < now() - interval '15 minutes');
CREATE POLICY commerce_sessions_analyst ON commerce_sessions
    FOR SELECT TO readonly_analyst
    USING (started_at < now() - interval '15 minutes');

COMMIT;
