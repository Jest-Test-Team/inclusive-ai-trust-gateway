// Package cqrs provides the minimal command/query dispatch bus that every
// protocol adapter (REST, WS, GraphQL, Connect-RPC, MQTT, MCP, UCP) fronts.
// Handlers own the business logic; adapters only translate transport payloads
// into command/query objects.
package cqrs

import (
	"context"
	"fmt"
	"reflect"
	"sync"
)

// Handler processes one command or query type.
type Handler[M any, R any] interface {
	Handle(ctx context.Context, msg M) (R, error)
}

// Bus routes command/query objects to their registered handler.
type Bus struct {
	mu       sync.RWMutex
	handlers map[reflect.Type]func(ctx context.Context, msg any) (any, error)
}

func NewBus() *Bus {
	return &Bus{handlers: map[reflect.Type]func(ctx context.Context, msg any) (any, error){}}
}

// Register binds a handler to message type M. Panics on duplicate
// registration — that is always a wiring bug, caught at startup.
func Register[M any, R any](b *Bus, h Handler[M, R]) {
	t := reflect.TypeOf((*M)(nil)).Elem()
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, dup := b.handlers[t]; dup {
		panic(fmt.Sprintf("cqrs: duplicate handler for %s", t))
	}
	b.handlers[t] = func(ctx context.Context, msg any) (any, error) {
		return h.Handle(ctx, msg.(M))
	}
}

// Dispatch routes msg to its handler and returns the typed result.
func Dispatch[M any, R any](ctx context.Context, b *Bus, msg M) (R, error) {
	var zero R
	t := reflect.TypeOf((*M)(nil)).Elem()
	b.mu.RLock()
	h, ok := b.handlers[t]
	b.mu.RUnlock()
	if !ok {
		return zero, fmt.Errorf("cqrs: no handler for %s", t)
	}
	res, err := h(ctx, msg)
	if err != nil {
		return zero, err
	}
	return res.(R), nil
}
