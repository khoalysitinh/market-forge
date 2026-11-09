// Command api runs the MARKET FORGE HTTP API.
//
// Start here when reading the code: main loads config, opens the database,
// builds the handler (internal/app) and serves until Ctrl+C / SIGTERM.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/app"
	"github.com/khoalysitinh/market-forge/backend/internal/dojo/trials"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/clock"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/config"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/logging"
)

func main() {
	// `api healthcheck` is used by Docker: the runtime image has no curl.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	if err := run(); err != nil {
		slog.Error("api stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logging.New(cfg.LogLevel)

	// ctx is cancelled on Ctrl+C or SIGTERM (docker stop).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DatabaseDSN, database.Options{})
	if err != nil {
		return err
	}
	defer db.Close()

	handler, err := app.NewHandler(app.Deps{
		DB: db, Log: log, Now: clock.System, Seed: trials.CryptoSeed,
		BcryptCost: cfg.BcryptCost, SessionTTL: cfg.SessionTTL, CookieSecure: cfg.CookieSecure,
	})
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("api listening", "addr", cfg.HTTPAddr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutting down")
	}

	// Let in-flight requests finish (their transactions commit or roll back).
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

// healthcheck calls /api/v1/ready on the local server; exit 0 when ready.
func healthcheck() int {
	port := os.Getenv("MF_HEALTHCHECK_PORT")
	if port == "" {
		port = "8080"
	}
	client := &http.Client{Timeout: 3 * time.Second}
	res, err := client.Get("http://127.0.0.1:" + port + "/api/v1/ready")
	if err != nil {
		return 1
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
