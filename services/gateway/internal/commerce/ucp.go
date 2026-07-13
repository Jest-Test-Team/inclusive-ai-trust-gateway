// Package commerce implements the UCP (Universal Commerce Protocol) surface
// for the inclusive-commerce demo scenario: a citizen with low digital
// literacy delegates shopping to an AI agent, and every UCP call is routed
// through the trust gateway. ADM safety events can flag or contain the
// agent's session mid-transaction; offer fairness is checked before a
// checkout intent is accepted.
//
// Messages follow UCP's request/response JSON design with an open
// "extensions" object for custom attributes.
package commerce

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
)

// Verdicts recorded for each commerce event.
const (
	VerdictAllowed = "allowed"
	VerdictFlagged = "flagged"
	VerdictBlocked = "blocked"
)

// EventChannel carries commerce-trace events to live surfaces.
const EventChannel = "commerce.events"

// Product is a mock merchant catalog entry.
type Product struct {
	SKU        string            `json:"sku"`
	Name       string            `json:"name"`
	Category   string            `json:"category"`
	PriceTWD   int               `json:"priceTWD"`
	FairPrice  int               `json:"fairPriceTWD"` // open-data reference price
	Accessible bool              `json:"accessibleDescription"`
	Extensions map[string]string `json:"extensions,omitempty"`
}

// Catalog is the demo merchant inventory (care products for the scenario).
var Catalog = []Product{
	{SKU: "CARE-001", Name: "Blood pressure monitor (large display)", Category: "care", PriceTWD: 1450, FairPrice: 1400, Accessible: true},
	{SKU: "CARE-002", Name: "Pill organizer with alarms", Category: "care", PriceTWD: 520, FairPrice: 500, Accessible: true},
	{SKU: "CARE-003", Name: "Walker with seat", Category: "mobility", PriceTWD: 2890, FairPrice: 2800, Accessible: true},
	{SKU: "CARE-004", Name: "\"Premium\" hearing aid batteries", Category: "care", PriceTWD: 1980, FairPrice: 600, Accessible: false},
}

// Session is one delegated-shopping session under trust monitoring.
type Session struct {
	ID        string    `json:"id"`
	AgentID   string    `json:"agentId"`
	PersonaID string    `json:"personaId"`
	Status    string    `json:"status"` // active | contained
	StartedAt time.Time `json:"startedAt"`
}

// TraceEvent is one entry in the transaction's trust trace.
type TraceEvent struct {
	ID        string          `json:"id"`
	SessionID string          `json:"sessionId"`
	Action    string          `json:"ucpAction"` // session.open | discovery | checkout.intent
	Verdict   string          `json:"trustVerdict"`
	Reason    string          `json:"reason,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
}

// Service owns sessions, the catalog, and the trust gating rules.
type Service struct {
	bus   eventbus.Bus
	store Store

	mu       sync.RWMutex
	sessions map[string]*Session
	trace    []TraceEvent
}

func NewService(bus eventbus.Bus) *Service {
	return NewServiceWithStore(bus, NopStore{})
}

func NewServiceWithStore(bus eventbus.Bus, store Store) *Service {
	if store == nil {
		store = NopStore{}
	}
	return &Service{bus: bus, store: store, sessions: map[string]*Session{}}
}

// WatchSafetyEvents contains sessions named in ADM containment events. Run
// as a goroutine; returns when ctx is cancelled.
func (s *Service) WatchSafetyEvents(ctx context.Context) {
	events, err := s.bus.Subscribe(ctx, adm.EventChannel)
	if err != nil {
		slog.Warn("commerce: cannot watch safety events", "err", err)
		return
	}
	for e := range events {
		var ev adm.SafetyEvent
		if json.Unmarshal(e.Payload, &ev) != nil || ev.SessionID == "" {
			continue
		}
		if ev.EventType == "containment" || ev.Severity == "critical" {
			s.ContainSession(ctx, ev.SessionID, "ADM "+ev.EventType+" event")
		}
	}
}

func (s *Service) ContainSession(ctx context.Context, id, reason string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sess, ok := s.sessions[id]; ok && sess.Status == "active" {
		sess.Status = "contained"
		if err := s.store.UpdateSessionStatus(ctx, id, "contained"); err != nil {
			slog.Warn("commerce: persist session status", "err", err, "session", id)
		}
		s.appendTraceLocked(ctx, TraceEvent{
			SessionID: id, Action: "session.containment",
			Verdict: VerdictBlocked, Reason: reason,
		})
	}
}

// OpenSession starts a monitored delegated-shopping session.
func (s *Service) OpenSession(ctx context.Context, agentID, personaID string) (Session, error) {
	if agentID == "" {
		return Session{}, fmt.Errorf("agentId required")
	}
	sess := Session{
		ID: uuid.NewString(), AgentID: agentID, PersonaID: personaID,
		Status: "active", StartedAt: time.Now().UTC(),
	}
	if err := s.store.SaveSession(ctx, sess); err != nil {
		return Session{}, fmt.Errorf("persist session: %w", err)
	}
	s.mu.Lock()
	s.sessions[sess.ID] = &sess
	s.appendTraceLocked(ctx, TraceEvent{SessionID: sess.ID, Action: "session.open", Verdict: VerdictAllowed})
	s.mu.Unlock()
	return sess, nil
}

// Discover returns catalog matches for the agent's query.
func (s *Service) Discover(ctx context.Context, sessionID, query string) ([]Product, TraceEvent, error) {
	if _, err := s.activeSession(sessionID); err != nil {
		return nil, s.recordVerdict(ctx, sessionID, "discovery", VerdictBlocked, err.Error(), nil), nil
	}
	q := strings.ToLower(query)
	var hits []Product
	for _, p := range Catalog {
		if q == "" || strings.Contains(strings.ToLower(p.Name), q) || strings.Contains(p.Category, q) {
			hits = append(hits, p)
		}
	}
	return hits, s.recordVerdict(ctx, sessionID, "discovery", VerdictAllowed, "", nil), nil
}

// CheckoutIntent applies the trust gate before accepting a purchase intent:
//   - the session must be active (not contained by ADM)
//   - the offer must pass the fairness check (price gouging against the
//     open-data reference price, inaccessible product descriptions for
//     personas that need them)
func (s *Service) CheckoutIntent(ctx context.Context, sessionID, sku string, qty int) (TraceEvent, error) {
	if qty <= 0 {
		qty = 1
	}
	if _, err := s.activeSession(sessionID); err != nil {
		return s.recordVerdict(ctx, sessionID, "checkout.intent", VerdictBlocked, err.Error(), nil), nil
	}
	var product *Product
	for i := range Catalog {
		if Catalog[i].SKU == sku {
			product = &Catalog[i]
			break
		}
	}
	if product == nil {
		return s.recordVerdict(ctx, sessionID, "checkout.intent", VerdictBlocked, "unknown SKU "+sku, nil), nil
	}

	payload, _ := json.Marshal(map[string]any{"sku": sku, "qty": qty, "priceTWD": product.PriceTWD})

	// Fairness gate: ERH-style structural check against the reference price.
	if product.FairPrice > 0 && product.PriceTWD > product.FairPrice*3/2 {
		reason := fmt.Sprintf("price %d TWD exceeds fair reference %d TWD by >50%%", product.PriceTWD, product.FairPrice)
		return s.recordVerdict(ctx, sessionID, "checkout.intent", VerdictBlocked, reason, payload), nil
	}
	if !product.Accessible {
		return s.recordVerdict(ctx, sessionID, "checkout.intent", VerdictFlagged,
			"product description not accessibility-verified for this persona", payload), nil
	}
	return s.recordVerdict(ctx, sessionID, "checkout.intent", VerdictAllowed, "", payload), nil
}

// Trace returns the newest trace events (the dashboard's commerce view).
func (s *Service) Trace(limit int) []TraceEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := len(s.trace)
	if limit > 0 && limit < n {
		n = limit
	}
	out := make([]TraceEvent, 0, n)
	for i := len(s.trace) - 1; i >= 0 && len(out) < n; i-- {
		out = append(out, s.trace[i])
	}
	return out
}

func (s *Service) activeSession(id string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[id]
	if !ok {
		return nil, fmt.Errorf("unknown session %s", id)
	}
	if sess.Status != "active" {
		return nil, fmt.Errorf("session %s is %s", id, sess.Status)
	}
	return sess, nil
}

func (s *Service) recordVerdict(ctx context.Context, sessionID, action, verdict, reason string, payload json.RawMessage) TraceEvent {
	s.mu.Lock()
	e := s.appendTraceLocked(ctx, TraceEvent{
		SessionID: sessionID, Action: action, Verdict: verdict, Reason: reason, Payload: payload,
	})
	s.mu.Unlock()
	return e
}

// appendTraceLocked assigns identity, stores, and publishes; callers hold mu.
func (s *Service) appendTraceLocked(ctx context.Context, e TraceEvent) TraceEvent {
	e.ID = uuid.NewString()
	e.CreatedAt = time.Now().UTC()
	s.trace = append(s.trace, e)
	if err := s.store.AppendEvent(ctx, e); err != nil {
		slog.Warn("commerce: persist event", "err", err, "action", e.Action, "session", e.SessionID)
	}
	if s.bus != nil {
		payload, _ := json.Marshal(e)
		_ = s.bus.Publish(context.Background(), eventbus.Event{Channel: EventChannel, Payload: payload})
	}
	return e
}
