package adm

import (
	"context"
	"testing"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
)

func TestMemoryStoreCountByType(t *testing.T) {
	ctx := context.Background()
	store := NewMemoryStore()
	handler := IngestEventHandler{Store: store}

	for _, et := range []string{"prompt_injection", "prompt_injection", "tool_policy"} {
		if _, err := handler.Handle(ctx, IngestEvent{EventType: et, Severity: domain.Severity("high")}); err != nil {
			t.Fatalf("ingest %s: %v", et, err)
		}
	}

	counts, err := CountEventsByTypeHandler{Store: store}.Handle(ctx, CountEventsByType{})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if counts["prompt_injection"] != 2 {
		t.Errorf("prompt_injection = %d, want 2", counts["prompt_injection"])
	}
	if counts["tool_policy"] != 1 {
		t.Errorf("tool_policy = %d, want 1", counts["tool_policy"])
	}
	if len(counts) != 2 {
		t.Errorf("distinct types = %d, want 2", len(counts))
	}
}
