// The gateway binary serves the Inclusive AI Trust Gateway API.
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/app"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/config"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/rest"
)

func main() {
	cfg := config.Load()
	a := app.New(cfg)
	srv := rest.NewServer(a.Bus, cfg.APIKey)

	addr := ":" + cfg.Port
	slog.Info("gateway listening", "addr", addr, "erh", cfg.ERHServiceURL != "", "redis", cfg.RedisURL != "")
	if err := http.ListenAndServe(addr, srv.Router()); err != nil {
		slog.Error("server exited", "err", err)
		os.Exit(1)
	}
}
