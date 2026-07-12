-- 0001_init: core schema for the Inclusive AI Trust Gateway.
-- Applied in order by filename: dev postgres runs these via
-- docker-entrypoint-initdb.d; Neon/Supabase via scripts/apply.sh.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS use_cases (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    domain      text NOT NULL,
    description text NOT NULL DEFAULT '',
    sdg_tags    text[] NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personas (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case_id uuid NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE,
    label       text NOT NULL,
    age_group   text NOT NULL DEFAULT '',
    region      text NOT NULL DEFAULT '',
    needs       text[] NOT NULL DEFAULT '{}',
    barriers    text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS assessments (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case_id            uuid NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE,
    inclusion_score        int  NOT NULL CHECK (inclusion_score BETWEEN 0 AND 100),
    fairness_risk          int  NOT NULL CHECK (fairness_risk BETWEEN 0 AND 100),
    fairness_risk_label    text NOT NULL CHECK (fairness_risk_label IN ('Low', 'Medium', 'High')),
    open_data_readiness    int  NOT NULL CHECK (open_data_readiness BETWEEN 0 AND 100),
    agent_safety_readiness int  NOT NULL CHECK (agent_safety_readiness BETWEEN 0 AND 100),
    evaluator              text NOT NULL DEFAULT 'deterministic-fallback',
    summary                text NOT NULL DEFAULT '',
    created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_created_at_idx ON assessments (created_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    source        text NOT NULL CHECK (source IN ('erh', 'adm', 'open-data', 'manual')),
    kind          text NOT NULL,
    payload       jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case_id uuid REFERENCES use_cases(id) ON DELETE SET NULL,
    event_type  text NOT NULL CHECK (event_type IN ('prompt_injection', 'tool_policy', 'containment', 'provenance')),
    severity    text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    session_id  text,
    detail      jsonb NOT NULL DEFAULT '{}',
    received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_events_received_at_idx ON safety_events (received_at DESC);
CREATE INDEX IF NOT EXISTS safety_events_session_idx ON safety_events (session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS open_data_sources (
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case_id                uuid NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE,
    name                       text NOT NULL,
    url                        text NOT NULL DEFAULT '',
    freshness_days             int,
    has_accessibility_metadata boolean NOT NULL DEFAULT false,
    has_multilingual_labels    boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS commerce_sessions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case_id uuid REFERENCES use_cases(id) ON DELETE SET NULL,
    agent_id    text NOT NULL,
    persona_id  text NOT NULL DEFAULT '',
    status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'contained', 'closed')),
    started_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL REFERENCES commerce_sessions(id) ON DELETE CASCADE,
    ucp_action    text NOT NULL,
    trust_verdict text NOT NULL CHECK (trust_verdict IN ('allowed', 'flagged', 'blocked')),
    reason        text NOT NULL DEFAULT '',
    payload       jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_events_session_idx ON commerce_events (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url         text NOT NULL,
    secret_hash text NOT NULL,
    event_types text[] NOT NULL DEFAULT '{}',
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMIT;
