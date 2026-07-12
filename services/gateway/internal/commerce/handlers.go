package commerce

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Routes mounts the UCP surface. Message bodies follow UCP's
// request/response pairing; every response carries the trust trace event
// the gateway recorded for the call.
func (s *Service) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/sessions", s.handleOpenSession)
	r.Post("/discovery", s.handleDiscovery)
	r.Post("/checkout-intents", s.handleCheckoutIntent)
	r.Get("/trace", s.handleTrace)
	return r
}

type openSessionRequest struct {
	AgentID    string            `json:"agentId"`
	PersonaID  string            `json:"personaId"`
	Extensions map[string]string `json:"extensions,omitempty"`
}

func (s *Service) handleOpenSession(w http.ResponseWriter, r *http.Request) {
	var req openSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	sess, err := s.OpenSession(r.Context(), req.AgentID, req.PersonaID)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, sess)
}

type discoveryRequest struct {
	SessionID  string            `json:"sessionId"`
	Query      string            `json:"query"`
	Extensions map[string]string `json:"extensions,omitempty"`
}

func (s *Service) handleDiscovery(w http.ResponseWriter, r *http.Request) {
	var req discoveryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	products, trace, _ := s.Discover(r.Context(), req.SessionID, req.Query)
	status := http.StatusOK
	if trace.Verdict == VerdictBlocked {
		status = http.StatusForbidden
	}
	writeJSON(w, status, map[string]any{"products": products, "trust": trace})
}

type checkoutIntentRequest struct {
	SessionID  string            `json:"sessionId"`
	SKU        string            `json:"sku"`
	Quantity   int               `json:"quantity"`
	Extensions map[string]string `json:"extensions,omitempty"`
}

func (s *Service) handleCheckoutIntent(w http.ResponseWriter, r *http.Request) {
	var req checkoutIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	trace, _ := s.CheckoutIntent(r.Context(), req.SessionID, req.SKU, req.Quantity)
	status := http.StatusCreated
	switch trace.Verdict {
	case VerdictBlocked:
		status = http.StatusForbidden
	case VerdictFlagged:
		status = http.StatusAccepted // held for human review
	}
	writeJSON(w, status, map[string]any{"trust": trace})
}

func (s *Service) handleTrace(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.Trace(100)})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
