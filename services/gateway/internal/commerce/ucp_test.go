package commerce

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
)

func TestFairPurchaseIsAllowed(t *testing.T) {
	s := NewService(eventbus.NewMemory())
	sess, err := s.OpenSession(context.Background(), "agent-1", "rural-older-adult")
	if err != nil {
		t.Fatal(err)
	}
	trace, _ := s.CheckoutIntent(context.Background(), sess.ID, "CARE-002", 1)
	if trace.Verdict != VerdictAllowed {
		t.Fatalf("verdict = %s (%s), want allowed", trace.Verdict, trace.Reason)
	}
}

func TestPriceGougingIsBlocked(t *testing.T) {
	s := NewService(eventbus.NewMemory())
	sess, _ := s.OpenSession(context.Background(), "agent-1", "rural-older-adult")
	// CARE-004: 1980 TWD vs fair reference 600 TWD.
	trace, _ := s.CheckoutIntent(context.Background(), sess.ID, "CARE-004", 1)
	if trace.Verdict != VerdictBlocked {
		t.Fatalf("verdict = %s, want blocked", trace.Verdict)
	}
}

func TestContainedSessionCannotTransact(t *testing.T) {
	bus := eventbus.NewMemory()
	s := NewService(bus)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go s.WatchSafetyEvents(ctx)
	time.Sleep(50 * time.Millisecond) // let the watcher subscribe

	sess, _ := s.OpenSession(ctx, "agent-hijacked", "rural-older-adult")

	// ADM detects the agent drifting mid-session and emits containment.
	event, _ := json.Marshal(adm.SafetyEvent{
		ID: "e1", EventType: "containment", Severity: domain.SeverityCritical, SessionID: sess.ID,
	})
	if err := bus.Publish(ctx, eventbus.Event{Channel: adm.EventChannel, Payload: event}); err != nil {
		t.Fatal(err)
	}

	// Containment is async; poll briefly.
	deadline := time.Now().Add(2 * time.Second)
	for {
		trace, _ := s.CheckoutIntent(ctx, sess.ID, "CARE-002", 1)
		if trace.Verdict == VerdictBlocked {
			return // money shot: hijacked agent's purchase blocked
		}
		if time.Now().After(deadline) {
			t.Fatalf("session was never contained; last verdict %s", trace.Verdict)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func TestDiscoveryFiltersCatalog(t *testing.T) {
	s := NewService(eventbus.NewMemory())
	sess, _ := s.OpenSession(context.Background(), "agent-1", "p")
	products, trace, _ := s.Discover(context.Background(), sess.ID, "walker")
	if trace.Verdict != VerdictAllowed || len(products) != 1 || products[0].SKU != "CARE-003" {
		t.Fatalf("unexpected discovery: %+v (%s)", products, trace.Verdict)
	}
}
