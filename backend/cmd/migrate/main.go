// Command migrate applies pending SQL migrations (forward only).
//
//	MF_DATABASE_DSN=... go run ./cmd/migrate
//
// It never drops or rewrites anything that was already applied.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/config"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/logging"
	"github.com/khoalysitinh/market-forge/backend/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	log := logging.New(cfg.LogLevel)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	db, err := database.Open(ctx, cfg.DatabaseDSN, database.Options{MultiStatements: true})
	if err != nil {
		log.Error("open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.Migrate(ctx, db, migrations.FS, log); err != nil {
		log.Error("migrate", "error", err)
		os.Exit(1)
	}
	log.Info("migrations up to date")
}
