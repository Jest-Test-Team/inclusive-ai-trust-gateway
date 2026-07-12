// Package ws is the WebSocket protocol adapter: it relays event-bus channels
// (ADM safety events, assessment updates) to connected dashboard clients.
// Auth uses the same agency API key, passed as ?api_key= because browser
// WebSocket clients cannot set headers.
package ws

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"time"

	"github.com/coder/websocket"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
)

// Channels relayed to every connected client.
var relayChannels = []string{adm.EventChannel, "assessments.created"}

type Handler struct {
	Bus    eventbus.Bus
	APIKey string
}

// frame is the envelope sent to clients.
type frame struct {
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data"`
	SentAt  time.Time       `json:"sentAt"`
}

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("api_key")
	if key == "" || subtle.ConstantTimeCompare([]byte(key), []byte(h.APIKey)) != 1 {
		http.Error(w, "missing or invalid API key", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{"*"}})
	if err != nil {
		return
	}
	defer conn.CloseNow()

	ctx := r.Context()
	events, err := h.Bus.Subscribe(ctx, relayChannels...)
	if err != nil {
		conn.Close(websocket.StatusInternalError, "subscribe failed")
		return
	}

	// Reader loop only to detect client close.
	go func() {
		for {
			if _, _, err := conn.Read(ctx); err != nil {
				return
			}
		}
	}()

	for e := range events {
		payload, err := json.Marshal(frame{Channel: e.Channel, Data: e.Payload, SentAt: time.Now().UTC()})
		if err != nil {
			continue
		}
		if err := conn.Write(ctx, websocket.MessageText, payload); err != nil {
			return
		}
	}
}
