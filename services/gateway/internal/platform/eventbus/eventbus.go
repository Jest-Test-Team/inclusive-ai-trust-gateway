// Package eventbus abstracts the pub/sub fabric that fans safety events and
// assessment updates out to the WebSocket and MQTT surfaces. Production uses
// Redis; tests and REDIS_URL-less dev use the in-process implementation.
package eventbus

import (
	"context"
	"sync"

	"github.com/redis/go-redis/v9"
)

// Event is a serialized message on a named channel.
type Event struct {
	Channel string
	Payload []byte
}

type Bus interface {
	Publish(ctx context.Context, e Event) error
	// Subscribe returns a receive channel for the named channels. The channel
	// closes when ctx is cancelled.
	Subscribe(ctx context.Context, channels ...string) (<-chan Event, error)
}

// --- in-process implementation ---

type memoryBus struct {
	mu   sync.RWMutex
	subs map[string][]chan Event
}

func NewMemory() Bus {
	return &memoryBus{subs: map[string][]chan Event{}}
}

func (b *memoryBus) Publish(_ context.Context, e Event) error {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subs[e.Channel] {
		select {
		case ch <- e:
		default: // slow consumer: drop rather than block the publisher
		}
	}
	return nil
}

func (b *memoryBus) Subscribe(ctx context.Context, channels ...string) (<-chan Event, error) {
	out := make(chan Event, 64)
	b.mu.Lock()
	for _, c := range channels {
		b.subs[c] = append(b.subs[c], out)
	}
	b.mu.Unlock()

	go func() {
		<-ctx.Done()
		b.mu.Lock()
		for _, c := range channels {
			list := b.subs[c][:0]
			for _, ch := range b.subs[c] {
				if ch != out {
					list = append(list, ch)
				}
			}
			b.subs[c] = list
		}
		b.mu.Unlock()
		close(out)
	}()
	return out, nil
}

// --- Redis implementation ---

type redisBus struct{ client *redis.Client }

func NewRedis(url string) (Bus, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	return &redisBus{client: redis.NewClient(opts)}, nil
}

func (b *redisBus) Publish(ctx context.Context, e Event) error {
	return b.client.Publish(ctx, e.Channel, e.Payload).Err()
}

func (b *redisBus) Subscribe(ctx context.Context, channels ...string) (<-chan Event, error) {
	sub := b.client.Subscribe(ctx, channels...)
	if _, err := sub.Receive(ctx); err != nil {
		return nil, err
	}
	out := make(chan Event, 64)
	go func() {
		defer close(out)
		defer sub.Close()
		for {
			select {
			case <-ctx.Done():
				return
			case m, ok := <-sub.Channel():
				if !ok {
					return
				}
				out <- Event{Channel: m.Channel, Payload: []byte(m.Payload)}
			}
		}
	}()
	return out, nil
}
