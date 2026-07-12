// Package adm ingests Agentic Defense Matrix safety telemetry. Events arrive
// via the inbound webhook (POST /v1/adm/events) — and, once the MQTT surface
// lands, via the adm/events/# topics — and are stored and fanned out to live
// subscribers.
package adm

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
)

// SafetyEvent is one ADM telemetry record.
type SafetyEvent struct {
	ID         string          `json:"id"`
	EventType  string          `json:"eventType"`
	Severity   domain.Severity `json:"severity"`
	Detail     json.RawMessage `json:"detail"`
	SessionID  string          `json:"sessionId,omitempty"`
	ReceivedAt time.Time       `json:"receivedAt"`
}

// EventChannel is the pub/sub channel live surfaces subscribe to.
const EventChannel = "adm.safety-events"

// IngestEvent is the command recording one safety event.
type IngestEvent struct {
	EventType string
	Severity  domain.Severity
	Detail    json.RawMessage
	SessionID string
}

type Store interface {
	Append(ctx context.Context, e SafetyEvent) error
	Recent(ctx context.Context, limit int) ([]SafetyEvent, error)
}

type IngestEventHandler struct {
	Store Store
	Bus   eventbus.Bus
}

func (h IngestEventHandler) Handle(ctx context.Context, cmd IngestEvent) (SafetyEvent, error) {
	e := SafetyEvent{
		ID:         uuid.NewString(),
		EventType:  cmd.EventType,
		Severity:   cmd.Severity,
		Detail:     cmd.Detail,
		SessionID:  cmd.SessionID,
		ReceivedAt: time.Now().UTC(),
	}
	if err := h.Store.Append(ctx, e); err != nil {
		return SafetyEvent{}, err
	}
	if h.Bus != nil {
		payload, _ := json.Marshal(e)
		if err := h.Bus.Publish(ctx, eventbus.Event{Channel: EventChannel, Payload: payload}); err != nil {
			slog.Warn("safety event publish failed", "err", err)
		}
	}
	return e, nil
}

// ListEvents is the read-side query for recent safety events.
type ListEvents struct{ Limit int }

type ListEventsHandler struct{ Store Store }

func (h ListEventsHandler) Handle(ctx context.Context, q ListEvents) ([]SafetyEvent, error) {
	return h.Store.Recent(ctx, q.Limit)
}

// MemoryStore is the DB-less Store used by tests and demo mode; the
// ent/Postgres implementation lands with infra/database.
type MemoryStore struct {
	mu     sync.RWMutex
	events []SafetyEvent
}

func NewMemoryStore() *MemoryStore { return &MemoryStore{} }

func (s *MemoryStore) Append(_ context.Context, e SafetyEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = append(s.events, e)
	return nil
}

func (s *MemoryStore) Recent(_ context.Context, limit int) ([]SafetyEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := len(s.events)
	if limit > 0 && limit < n {
		n = limit
	}
	out := make([]SafetyEvent, 0, n)
	for i := len(s.events) - 1; i >= 0 && len(out) < n; i-- {
		out = append(out, s.events[i])
	}
	return out, nil
}
