package rest

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/app"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/config"
)

// newTestServer builds the full wired app (memory repos, fallback evaluator)
// exactly as main.go does, so this suite covers the same contract the Robot
// api tests assert against a deployed gateway.
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	cfg := config.Config{Port: "0", APIKey: "test-key", WebhookSecret: "s"}
	a := app.New(cfg)
	srv := httptest.NewServer(NewServer(a.Bus, cfg.APIKey).Router())
	t.Cleanup(srv.Close)
	return srv
}

func doJSON(t *testing.T, method, url, apiKey string, body any) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, url, &buf)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("X-Api-Key", apiKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func decode(t *testing.T, resp *http.Response) map[string]any {
	t.Helper()
	defer resp.Body.Close()
	var m map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		t.Fatal(err)
	}
	return m
}

var sampleUseCase = map[string]any{
	"useCase": map[string]any{
		"name":            "Care navigation assistant",
		"domain":          "care-services",
		"description":     "AI assistant helping residents find eligible care services",
		"openDataSources": []string{"care directories"},
		"safeguards":      []string{"human review"},
		"personas": []map[string]any{
			{"label": "Rural older adult", "barriers": []string{"low digital literacy"}},
		},
	},
}

func TestHealthz(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if m := decode(t, resp); m["status"] != "ok" {
		t.Fatalf("body = %v", m)
	}
}

func TestUnknownRouteIs404(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/definitely-not-a-route")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestOpenAPIDocs(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/openapi.json")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("content-type = %q", ct)
	}
	var spec map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&spec); err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if spec["openapi"] != "3.0.3" {
		t.Fatalf("openapi = %v", spec["openapi"])
	}

	docs, err := http.Get(srv.URL + "/docs")
	if err != nil {
		t.Fatal(err)
	}
	defer docs.Body.Close()
	body, _ := io.ReadAll(docs.Body)
	if docs.StatusCode != http.StatusOK || !strings.Contains(string(body), "SwaggerUIBundle") {
		t.Fatalf("docs status = %d, body = %s", docs.StatusCode, string(body))
	}
}

func TestCORSPreflight(t *testing.T) {
	srv := newTestServer(t)
	req, err := http.NewRequest(http.MethodOptions, srv.URL+"/v1/assessments", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "https://example.vercel.app")
	req.Header.Set("Access-Control-Request-Headers", "X-Api-Key, Content-Type")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "https://example.vercel.app" {
		t.Fatalf("allow-origin = %q", got)
	}
	if got := resp.Header.Get("Access-Control-Allow-Headers"); !strings.Contains(got, "X-Api-Key") {
		t.Fatalf("allow-headers = %q", got)
	}
}

func TestCreateAssessmentContract(t *testing.T) {
	srv := newTestServer(t)
	resp := doJSON(t, http.MethodPost, srv.URL+"/v1/assessments", "test-key", sampleUseCase)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	body := decode(t, resp)
	if body["id"] == "" || body["id"] == nil {
		t.Fatal("missing id")
	}
	for _, field := range []string{"inclusionScore", "fairnessRisk", "openDataReadiness", "agentSafetyReadiness"} {
		v, ok := body[field].(float64)
		if !ok {
			t.Fatalf("%s missing or not numeric: %v", field, body[field])
		}
		if v < 0 || v > 100 {
			t.Fatalf("%s = %v outside [0,100]", field, v)
		}
	}
}

func TestGetAssessmentRoundTrip(t *testing.T) {
	srv := newTestServer(t)
	created := decode(t, doJSON(t, http.MethodPost, srv.URL+"/v1/assessments", "test-key", sampleUseCase))
	id := created["id"].(string)

	resp := doJSON(t, http.MethodGet, srv.URL+"/v1/assessments/"+id, "test-key", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if got := decode(t, resp); got["id"] != id {
		t.Fatalf("id = %v, want %s", got["id"], id)
	}
}

func TestCreateAssessmentRequiresAPIKey(t *testing.T) {
	srv := newTestServer(t)
	resp := doJSON(t, http.MethodPost, srv.URL+"/v1/assessments", "", sampleUseCase)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestCreateAssessmentValidation(t *testing.T) {
	srv := newTestServer(t)
	resp := doJSON(t, http.MethodPost, srv.URL+"/v1/assessments", "test-key",
		map[string]any{"useCase": map[string]any{"domain": "x"}}) // name missing
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.StatusCode)
	}
}

func TestIngestADMEvent(t *testing.T) {
	srv := newTestServer(t)
	event := map[string]any{
		"eventType": "prompt_injection",
		"severity":  "high",
		"detail":    "Blocked instruction override attempt in citizen chat session",
	}
	resp := doJSON(t, http.MethodPost, srv.URL+"/v1/adm/events", "test-key", event)
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", resp.StatusCode)
	}
	if body := decode(t, resp); body["id"] == "" || body["id"] == nil {
		t.Fatal("missing id")
	}

	list := decode(t, doJSON(t, http.MethodGet, srv.URL+"/v1/adm/events", "test-key", nil))
	items := list["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected 1 event, got %d", len(items))
	}
}

func TestDashboardVM(t *testing.T) {
	srv := newTestServer(t)
	doJSON(t, http.MethodPost, srv.URL+"/v1/assessments", "test-key", sampleUseCase).Body.Close()
	resp := doJSON(t, http.MethodGet, srv.URL+"/v1/dashboard", "test-key", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	body := decode(t, resp)
	if body["totalAssessments"].(float64) != 1 {
		t.Fatalf("totalAssessments = %v", body["totalAssessments"])
	}
	if _, ok := body["recent"].([]any); !ok {
		t.Fatal("recent missing")
	}
}
