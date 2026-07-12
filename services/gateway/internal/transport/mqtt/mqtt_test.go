package mqtt

import (
	"context"
	"testing"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
)

func newBus(t *testing.T) (*cqrs.Bus, *adm.MemoryStore) {
	t.Helper()
	store := adm.NewMemoryStore()
	bus := cqrs.NewBus()
	cqrs.Register[adm.IngestEvent, adm.SafetyEvent](bus, adm.IngestEventHandler{Store: store})
	cqrs.Register[adm.ListEvents, []adm.SafetyEvent](bus, adm.ListEventsHandler{Store: store})
	return bus, store
}

func TestHandleMessageIngestsEvent(t *testing.T) {
	bus, store := newBus(t)
	payload := []byte(`{"eventType":"containment","severity":"critical","detail":{"session":"s1"},"sessionId":"s1"}`)
	if err := HandleMessage(context.Background(), bus, "adm/events/containment", payload); err != nil {
		t.Fatal(err)
	}
	events, _ := store.Recent(context.Background(), 10)
	if len(events) != 1 || events[0].EventType != "containment" || string(events[0].Severity) != "critical" {
		t.Fatalf("unexpected events: %+v", events)
	}
}

func TestHandleMessageDefaultsForTelemetry(t *testing.T) {
	bus, store := newBus(t)
	if err := HandleMessage(context.Background(), bus, "telemetry/sensor1", []byte(`{"severity":"weird","detail":{}}`)); err != nil {
		t.Fatal(err)
	}
	events, _ := store.Recent(context.Background(), 10)
	if len(events) != 1 || events[0].EventType != "provenance" || string(events[0].Severity) != "low" {
		t.Fatalf("defaults not applied: %+v", events)
	}
}

func TestHandleMessageRejectsGarbage(t *testing.T) {
	bus, _ := newBus(t)
	if err := HandleMessage(context.Background(), bus, "adm/events/x", []byte("not-json")); err == nil {
		t.Fatal("expected error for malformed payload")
	}
}
