// Package config loads runtime configuration from environment variables.
//
// Every setting has a safe default for local development except secrets:
// the database DSN must always be provided explicitly.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	// HTTPAddr is the listen address, e.g. ":8080".
	HTTPAddr string
	// DatabaseDSN is a go-sql-driver/mysql DSN WITHOUT parameters we control
	// ourselves (parseTime, loc, time_zone are appended by the database package).
	DatabaseDSN string
	// SessionTTL is how long a login session stays valid.
	SessionTTL time.Duration
	// CookieSecure must be true when served over HTTPS (any real deployment).
	CookieSecure bool
	// BcryptCost controls password hashing work. Lower only in tests.
	BcryptCost int
	// LogLevel: debug, info, warn, error.
	LogLevel string
}

// Load reads configuration from the environment.
func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:     getenv("MF_HTTP_ADDR", ":8080"),
		DatabaseDSN:  os.Getenv("MF_DATABASE_DSN"),
		CookieSecure: getenv("MF_COOKIE_SECURE", "false") == "true",
		LogLevel:     getenv("MF_LOG_LEVEL", "info"),
	}
	if cfg.DatabaseDSN == "" {
		return Config{}, errors.New("MF_DATABASE_DSN is required (see .env.example)")
	}

	ttl, err := time.ParseDuration(getenv("MF_SESSION_TTL", "168h"))
	if err != nil || ttl <= 0 {
		return Config{}, fmt.Errorf("MF_SESSION_TTL must be a positive duration like 168h: %v", err)
	}
	cfg.SessionTTL = ttl

	cost, err := strconv.Atoi(getenv("MF_BCRYPT_COST", "12"))
	if err != nil || cost < 4 || cost > 31 {
		return Config{}, fmt.Errorf("MF_BCRYPT_COST must be an integer in [4,31]")
	}
	cfg.BcryptCost = cost
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
