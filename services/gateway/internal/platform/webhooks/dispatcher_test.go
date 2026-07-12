package webhooks

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNotifySignsAndFilters(t *testing.T) {
	var gotSig, gotEvent string
	var gotBody []byte
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		gotSig = r.Header.Get("X-IATG-Signature")
		gotEvent = r.Header.Get("X-IATG-Event")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	d := NewDispatcher("s3cret")
	d.Subscribe(Subscription{URL: srv.URL, EventTypes: []string{"assessment.created"}})

	payload := []byte(`{"id":"a1"}`)
	if err := d.Notify(context.Background(), "assessment.created", payload); err != nil {
		t.Fatalf("Notify: %v", err)
	}
	if err := d.Notify(context.Background(), "unrelated.event", payload); err != nil {
		t.Fatalf("Notify unrelated: %v", err)
	}

	if hits != 1 {
		t.Fatalf("expected exactly 1 delivery, got %d", hits)
	}
	if gotEvent != "assessment.created" || string(gotBody) != `{"id":"a1"}` {
		t.Fatalf("unexpected delivery: event=%q body=%s", gotEvent, gotBody)
	}
	mac := hmac.New(sha256.New, []byte("s3cret"))
	mac.Write(payload)
	if gotSig != hex.EncodeToString(mac.Sum(nil)) {
		t.Fatal("signature mismatch")
	}
}
