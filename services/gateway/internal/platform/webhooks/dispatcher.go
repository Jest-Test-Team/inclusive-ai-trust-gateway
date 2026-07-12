// Package webhooks delivers HMAC-signed event notifications to subscribed
// partner endpoints (agencies, SIEMs). Inbound webhooks (ADM events) are
// plain REST handlers in the adm module; this package is the outbound side.
package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Subscription is a partner endpoint interested in a set of event types.
type Subscription struct {
	URL        string
	EventTypes []string
}

type Dispatcher struct {
	secret []byte
	client *http.Client

	mu   sync.RWMutex
	subs []Subscription
}

func NewDispatcher(secret string) *Dispatcher {
	return &Dispatcher{
		secret: []byte(secret),
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (d *Dispatcher) Subscribe(s Subscription) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.subs = append(d.subs, s)
}

// Sign returns the hex HMAC-SHA256 signature receivers use to verify payloads.
func (d *Dispatcher) Sign(payload []byte) string {
	mac := hmac.New(sha256.New, d.secret)
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// Notify posts payload to every subscription matching eventType. Failures are
// returned joined but do not stop other deliveries.
func (d *Dispatcher) Notify(ctx context.Context, eventType string, payload []byte) error {
	d.mu.RLock()
	targets := make([]Subscription, 0, len(d.subs))
	for _, s := range d.subs {
		for _, t := range s.EventTypes {
			if t == eventType || t == "*" {
				targets = append(targets, s)
				break
			}
		}
	}
	d.mu.RUnlock()

	var errs []error
	for _, s := range targets {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.URL, bytes.NewReader(payload))
		if err != nil {
			errs = append(errs, err)
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-IATG-Event", eventType)
		req.Header.Set("X-IATG-Signature", d.Sign(payload))
		resp, err := d.client.Do(req)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode >= 300 {
			errs = append(errs, fmt.Errorf("webhook %s: status %d", s.URL, resp.StatusCode))
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("webhook delivery: %v", errs)
	}
	return nil
}
