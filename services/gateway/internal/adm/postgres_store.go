package adm

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
)

// PostgresStore persists ADM safety events to the safety_events table.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) Append(ctx context.Context, e SafetyEvent) error {
	detail := []byte(e.Detail)
	if len(detail) == 0 {
		detail = []byte("{}")
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO safety_events (id, event_type, severity, session_id, detail, received_at)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6)`,
		e.ID, e.EventType, string(e.Severity), e.SessionID, detail, e.ReceivedAt,
	)
	return err
}

func (s *PostgresStore) Recent(ctx context.Context, limit int) ([]SafetyEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, event_type, severity, COALESCE(session_id, ''), detail, received_at
		FROM safety_events ORDER BY received_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SafetyEvent
	for rows.Next() {
		var e SafetyEvent
		var severity string
		var detail []byte
		if err := rows.Scan(&e.ID, &e.EventType, &severity, &e.SessionID, &detail, &e.ReceivedAt); err != nil {
			return nil, err
		}
		e.Severity = domain.Severity(severity)
		e.Detail = detail
		out = append(out, e)
	}
	return out, rows.Err()
}

var _ Store = (*PostgresStore)(nil)
