package ws

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
)

func TestRelaysSafetyEvents(t *testing.T) {
	bus := eventbus.NewMemory()
	srv := httptest.NewServer(Handler{Bus: bus, APIKey: "k"})
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, srv.URL+"?api_key=k", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()

	// Give the server a moment to subscribe before publishing.
	time.Sleep(100 * time.Millisecond)
	if err := bus.Publish(ctx, eventbus.Event{
		Channel: adm.EventChannel,
		Payload: []byte(`{"eventType":"prompt_injection"}`),
	}); err != nil {
		t.Fatal(err)
	}

	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Channel string          `json:"channel"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(data, &f); err != nil {
		t.Fatal(err)
	}
	if f.Channel != adm.EventChannel {
		t.Fatalf("channel = %s", f.Channel)
	}
}

func TestRejectsBadKey(t *testing.T) {
	srv := httptest.NewServer(Handler{Bus: eventbus.NewMemory(), APIKey: "k"})
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, resp, err := websocket.Dial(ctx, srv.URL+"?api_key=wrong", nil)
	if err == nil {
		t.Fatal("dial succeeded with wrong key")
	}
	if resp == nil || resp.StatusCode != 401 {
		t.Fatalf("expected 401, got %v", resp)
	}
}
