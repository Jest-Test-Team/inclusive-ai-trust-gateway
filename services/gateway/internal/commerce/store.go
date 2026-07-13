package commerce

import "context"

// Store persists UCP sessions and trust-trace events. The in-process Service
// remains the hot path for active session checks; Store is the durable audit
// trail (Neon/Postgres when DATABASE_URL is set).
type Store interface {
	SaveSession(ctx context.Context, s Session) error
	UpdateSessionStatus(ctx context.Context, id, status string) error
	AppendEvent(ctx context.Context, e TraceEvent) error
}

// NopStore discards writes (DB-less demo / unit tests without Postgres).
type NopStore struct{}

func (NopStore) SaveSession(context.Context, Session) error                { return nil }
func (NopStore) UpdateSessionStatus(context.Context, string, string) error { return nil }
func (NopStore) AppendEvent(context.Context, TraceEvent) error             { return nil }
