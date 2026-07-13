package commerce

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore writes commerce_sessions and commerce_events for audit.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) SaveSession(ctx context.Context, sess Session) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO commerce_sessions (id, agent_id, persona_id, status, started_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO NOTHING`,
		sess.ID, sess.AgentID, sess.PersonaID, sess.Status, sess.StartedAt,
	)
	return err
}

func (s *PostgresStore) UpdateSessionStatus(ctx context.Context, id, status string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE commerce_sessions SET status = $2 WHERE id = $1`, id, status)
	return err
}

func (s *PostgresStore) AppendEvent(ctx context.Context, e TraceEvent) error {
	payload := e.Payload
	if len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO commerce_events (id, session_id, ucp_action, trust_verdict, reason, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		e.ID, e.SessionID, e.Action, e.Verdict, e.Reason, payload, e.CreatedAt,
	)
	return err
}

var _ Store = (*PostgresStore)(nil)
