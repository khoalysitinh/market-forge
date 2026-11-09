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
