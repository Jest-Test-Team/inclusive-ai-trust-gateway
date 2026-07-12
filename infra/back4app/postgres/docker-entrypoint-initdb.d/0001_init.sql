-- Core schema for the Inclusive AI Trust Gateway demo database.
-- Keep this copy aligned with infra/database/migrations/0001_init.sql.

CREATE TABLE IF NOT EXISTS public_service_use_cases (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    sdgs JSONB NOT NULL DEFAULT '[]'::jsonb,
    open_data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    ai_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    safeguards JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY,
    use_case_id UUID NOT NULL REFERENCES public_service_use_cases(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    age_group TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    needs JSONB NOT NULL DEFAULT '[]'::jsonb,
    barriers JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY,
    use_case_id UUID NOT NULL REFERENCES public_service_use_cases(id) ON DELETE CASCADE,
    inclusion_score INTEGER NOT NULL CHECK (inclusion_score BETWEEN 0 AND 100),
    fairness_risk_score INTEGER NOT NULL CHECK (fairness_risk_score BETWEEN 0 AND 100),
    fairness_risk_label TEXT NOT NULL,
    open_data_readiness INTEGER NOT NULL CHECK (open_data_readiness BETWEEN 0 AND 100),
    agent_safety_readiness INTEGER NOT NULL CHECK (agent_safety_readiness BETWEEN 0 AND 100),
    evaluator TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_events (
    id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    session_id TEXT NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_sessions (
    id UUID PRIMARY KEY,
    agent_id TEXT NOT NULL,
    persona_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_trace_events (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES commerce_sessions(id) ON DELETE SET NULL,
    ucp_action TEXT NOT NULL,
    trust_verdict TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_received_at ON safety_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_trace_created_at ON commerce_trace_events(created_at DESC);
