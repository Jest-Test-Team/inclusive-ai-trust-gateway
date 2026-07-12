package cqrs

import (
	"context"
	"testing"
)

type echoCmd struct{ Text string }

type echoHandler struct{}

func (echoHandler) Handle(_ context.Context, c echoCmd) (string, error) {
	return c.Text + "!", nil
}

func TestDispatchRoutesToHandler(t *testing.T) {
	bus := NewBus()
	Register[echoCmd, string](bus, echoHandler{})

	got, err := Dispatch[echoCmd, string](context.Background(), bus, echoCmd{Text: "hi"})
	if err != nil || got != "hi!" {
		t.Fatalf("Dispatch = %q, %v", got, err)
	}
}

func TestDispatchUnknownMessage(t *testing.T) {
	bus := NewBus()
	if _, err := Dispatch[echoCmd, string](context.Background(), bus, echoCmd{}); err == nil {
		t.Fatal("expected error for unregistered message type")
	}
}

func TestDuplicateRegistrationPanics(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic on duplicate registration")
		}
	}()
	bus := NewBus()
	Register[echoCmd, string](bus, echoHandler{})
	Register[echoCmd, string](bus, echoHandler{})
}
