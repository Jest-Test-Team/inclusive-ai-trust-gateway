// The gateway binary serves the Inclusive AI Trust Gateway API over all
// protocol surfaces: REST, WebSocket, GraphQL, MQTT, MCP, and UCP.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/app"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/config"
	connectt "github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/connectrpc"
	gqlt "github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/graphql"
	mcpt "github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/mcp"
	mqttt "github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/mqtt"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/rest"
	wst "github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/ws"
)

func main() {
	cfg := config.Load()
	a := app.New(cfg)
	srv := rest.NewServer(a.Bus, cfg.APIKey)

	srv.WS = wst.Handler{Bus: a.Events, APIKey: cfg.APIKey}

	gql, err := gqlt.NewHandler(a.Bus)
	if err != nil {
		slog.Error("graphql schema", "err", err)
		os.Exit(1)
	}
	srv.GraphQL = gql

	srv.MCP = mcpt.NewHTTPHandler(a.Bus)

	go a.Commerce.WatchSafetyEvents(context.Background())
	srv.Commerce = a.Commerce.Routes()

	srv.ConnectPath, srv.Connect = connectt.NewHandler(a.Bus)

	if url := os.Getenv("MQTT_URL"); url != "" {
		if sub, err := mqttt.NewSubscriber(url, "iatg-gateway", a.Bus); err != nil {
			slog.Warn("mqtt unavailable, continuing without broker", "err", err)
		} else {
			defer sub.Close()
			slog.Info("mqtt subscribed", "broker", url)
		}
	}

	addr := ":" + cfg.Port
	slog.Info("gateway listening", "addr", addr,
		"erh", cfg.ERHServiceURL != "", "redis", cfg.RedisURL != "",
		"surfaces", "rest,ws,graphql,mcp,ucp"+map[bool]string{true: ",mqtt", false: ""}[os.Getenv("MQTT_URL") != ""])
	if err := http.ListenAndServe(addr, srv.Router()); err != nil {
		slog.Error("server exited", "err", err)
		os.Exit(1)
	}
}
