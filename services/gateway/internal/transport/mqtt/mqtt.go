// Package mqtt is the MQTT protocol adapter: it subscribes to ADM telemetry
// and generic IoT-style topics on the Mosquitto broker and dispatches each
// message as an IngestEvent command — the same path the REST webhook uses.
package mqtt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	paho "github.com/eclipse/paho.mqtt.golang"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
)

// Topics the gateway subscribes to.
const (
	ADMTopic       = "adm/events/#"
	TelemetryTopic = "telemetry/#"
)

// eventPayload is the wire shape published to adm/events/* topics.
type eventPayload struct {
	EventType string          `json:"eventType"`
	Severity  string          `json:"severity"`
	Detail    json.RawMessage `json:"detail"`
	SessionID string          `json:"sessionId"`
}

// HandleMessage parses one MQTT payload and dispatches the ingest command.
// Split from the paho callback so it is unit-testable without a broker.
func HandleMessage(ctx context.Context, bus *cqrs.Bus, topic string, payload []byte) error {
	var p eventPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("mqtt %s: bad payload: %w", topic, err)
	}
	if p.EventType == "" {
		p.EventType = "provenance" // telemetry/* default bucket
	}
	severity, err := domain.ParseSeverity(p.Severity)
	if err != nil {
		severity = domain.SeverityLow
	}
	_, err = cqrs.Dispatch[adm.IngestEvent, adm.SafetyEvent](ctx, bus, adm.IngestEvent{
		EventType: p.EventType,
		Severity:  severity,
		Detail:    p.Detail,
		SessionID: p.SessionID,
	})
	return err
}

// Subscriber owns the broker connection.
type Subscriber struct {
	client paho.Client
	bus    *cqrs.Bus
}

// NewSubscriber connects to brokerURL (e.g. tcp://mosquitto:1883) and
// subscribes to the ADM and telemetry topics.
func NewSubscriber(brokerURL, clientID string, bus *cqrs.Bus) (*Subscriber, error) {
	opts := paho.NewClientOptions().AddBroker(brokerURL).SetClientID(clientID).SetAutoReconnect(true)
	client := paho.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		return nil, token.Error()
	}
	s := &Subscriber{client: client, bus: bus}
	handler := func(_ paho.Client, msg paho.Message) {
		if err := HandleMessage(context.Background(), bus, msg.Topic(), msg.Payload()); err != nil {
			slog.Warn("mqtt message dropped", "topic", msg.Topic(), "err", err)
		}
	}
	for _, topic := range []string{ADMTopic, TelemetryTopic} {
		if token := client.Subscribe(topic, 1, handler); token.Wait() && token.Error() != nil {
			client.Disconnect(250)
			return nil, token.Error()
		}
	}
	return s, nil
}

func (s *Subscriber) Close() {
	s.client.Disconnect(250)
}
