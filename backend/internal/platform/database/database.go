// Package database owns the MariaDB connection pool, transactions and
// migrations. Business modules never open connections themselves.
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

// Querier is the subset of *sql.DB and *sql.Tx that repositories need.
// Accepting a Querier lets the same repository function run either inside
// a transaction (pass the *sql.Tx) or outside one (pass the *sql.DB).
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Options tweak how a DSN is opened.
type Options struct {
	// MultiStatements allows several SQL statements per Exec. Only the
	// migration runner needs this; the application pool keeps it off because
	// it widens the impact of any SQL injection bug.
	MultiStatements bool
}

// NormalizeDSN forces the connection settings MARKET FORGE relies on:
// all DATETIME values are UTC and are scanned into time.Time.
func NormalizeDSN(dsn string, opts Options) (string, error) {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return "", fmt.Errorf("parse database DSN: %w", err)
	}
	cfg.ParseTime = true
	cfg.Loc = time.UTC
	cfg.MultiStatements = opts.MultiStatements
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	cfg.Params["time_zone"] = "'+00:00'"
	return cfg.FormatDSN(), nil
}

// Open creates a connection pool and verifies connectivity.
func Open(ctx context.Context, dsn string, opts Options) (*sql.DB, error) {
	normalized, err := NormalizeDSN(dsn, opts)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("mysql", normalized)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	// Small pool: v0.1 targets a handful of users. Tune with measurements.
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return db, nil
}

// maxTxAttempts bounds how often WithTx retries after a deadlock.
const maxTxAttempts = 3

// WithTx runs fn inside a transaction. It commits when fn returns nil and
// rolls back otherwise. If MariaDB aborts the transaction because of a
// deadlock (error 1213), the whole fn is retried: fn must therefore only
// touch the database through tx and must not perform external I/O.
func WithTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) error {
	var err error
	for attempt := 1; attempt <= maxTxAttempts; attempt++ {
		err = runTx(ctx, db, fn)
		if err == nil || !isDeadlock(err) {
			return err
		}
	}
	return fmt.Errorf("transaction failed after %d deadlock retries: %w", maxTxAttempts, err)
}

func runTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) (err error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	if err = fn(tx); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

// MariaDB error numbers we react to.
const (
	errDuplicateEntry = 1062
	errDeadlock       = 1213
)

// IsDuplicateKey reports whether err is a UNIQUE/PRIMARY KEY violation.
func IsDuplicateKey(err error) bool { return mysqlErrNumber(err) == errDuplicateEntry }

func isDeadlock(err error) bool { return mysqlErrNumber(err) == errDeadlock }

func mysqlErrNumber(err error) uint16 {
	var me *mysql.MySQLError
	if errors.As(err, &me) {
		return me.Number
	}
	return 0
}
