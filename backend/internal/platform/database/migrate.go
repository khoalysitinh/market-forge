package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"
)

// Migrate applies every *.sql file in migrations that has not been applied
// yet, in lexical order (0001_..., 0002_...).
//
// Rules:
//   - Applied migrations are never edited. The runner stores a SHA-256 of each
//     file and refuses to continue if an applied file changed.
//   - MariaDB commits DDL implicitly, so a migration is NOT atomic. Keep each
//     file small and forward-only. Fix mistakes with a new migration.
//   - A named lock (GET_LOCK) stops two processes migrating at the same time.
//
// db must have been opened with Options{MultiStatements: true}.
func Migrate(ctx context.Context, db *sql.DB, migrations fs.FS, log *slog.Logger) error {
	// GET_LOCK belongs to one connection, so pin a single connection.
	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Close()

	var got sql.NullInt64
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK('marketforge_migrate', 30)").Scan(&got); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	if !got.Valid || got.Int64 != 1 {
		return fmt.Errorf("could not acquire migration lock within 30s")
	}
	defer func() {
		_, _ = conn.ExecContext(context.WithoutCancel(ctx), "SELECT RELEASE_LOCK('marketforge_migrate')")
	}()

	if _, err := conn.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    VARCHAR(128) NOT NULL PRIMARY KEY,
		checksum   CHAR(64)     NOT NULL,
		applied_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	applied, err := appliedMigrations(ctx, conn)
	if err != nil {
		return err
	}

	files, err := fs.Glob(migrations, "*.sql")
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}
	sort.Strings(files)

	for _, name := range files {
		body, err := fs.ReadFile(migrations, name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		sum := sha256.Sum256(body)
		checksum := hex.EncodeToString(sum[:])
		version := strings.TrimSuffix(name, ".sql")

		if prev, ok := applied[version]; ok {
			if prev != checksum {
				return fmt.Errorf("migration %s was modified after being applied (checksum mismatch); add a new migration instead", name)
			}
			continue
		}

		log.Info("applying migration", "version", version)
		if _, err := conn.ExecContext(ctx, string(body)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := conn.ExecContext(ctx,
			"INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", version, checksum); err != nil {
			return fmt.Errorf("record %s: %w", name, err)
		}
	}
	return nil
}

func appliedMigrations(ctx context.Context, conn *sql.Conn) (map[string]string, error) {
	rows, err := conn.QueryContext(ctx, "SELECT version, checksum FROM schema_migrations")
	if err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var v, c string
		if err := rows.Scan(&v, &c); err != nil {
			return nil, err
		}
		out[v] = c
	}
	return out, rows.Err()
}
