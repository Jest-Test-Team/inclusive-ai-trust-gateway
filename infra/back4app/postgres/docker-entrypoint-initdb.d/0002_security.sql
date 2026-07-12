-- Demo container role setup. Keep this copy aligned with
-- infra/database/migrations/0002_security.sql where practical.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gateway_rw') THEN
        CREATE ROLE gateway_rw NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readonly_analyst') THEN
        CREATE ROLE readonly_analyst NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO gateway_rw, readonly_analyst;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO gateway_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_analyst;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO gateway_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_analyst;
