// Package idempotency makes "create" operations safe to retry.
//
// A client sends an Idempotency-Key header. For the same (user, operation,
// key):
//   - same request body  -> the original result is returned, nothing new is created
//   - different body     -> IDEMPOTENCY_KEY_REUSED (409)
//   - two concurrent requests -> the second waits for the first, then gets
//     the first one's result
//
// How it works: Claim INSERTs the key at the very start of the business
// transaction. If another transaction already inserted the same key and has
// not committed yet, MariaDB makes our INSERT wait on that row lock. When the
// other transaction commits we get a duplicate-key error and read its result;
// if it rolled back, our INSERT succeeds and we do the work ourselves.
// Nothing is kept in Go memory, so this works across processes.
//
// Only successful results are stored. A request that fails with a business
// error rolls back its claim, and a retry will run the operation again.
package idempotency

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// HeaderName is the HTTP header clients use.
const HeaderName = "Idempotency-Key"

const maxKeyLength = 128

var errInvalidKey = apperr.New(apperr.KindInvalid, "IDEMPOTENCY_KEY_INVALID",
	"Idempotency-Key must be 1-128 visible ASCII characters")

// ValidateKey checks the header value. An empty key means "not idempotent"
// and is allowed; callers should skip Claim in that case.
func ValidateKey(key string) error {
	if len(key) > maxKeyLength {
		return errInvalidKey
	}
	for i := 0; i < len(key); i++ {
		if key[i] < 0x21 || key[i] > 0x7e {
			return errInvalidKey
		}
	}
	return nil
}

// HashRequest returns a stable fingerprint of the logical request. Pass a
// struct containing every input that influences the result (path IDs + body).
func HashRequest(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("hash idempotent request: %w", err)
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}

// Claim registers the key inside tx. If the key was already completed by an
// earlier request with the same hash, it returns (resultID, true, nil) and the
// caller must return that existing result without doing any work.
func Claim(ctx context.Context, tx *sql.Tx, now time.Time, userID int64, operation, key, requestHash string) (int64, bool, error) {
	_, err := tx.ExecContext(ctx, `INSERT INTO idempotency_keys
		(user_id, operation, idem_key, request_hash, result_id, created_at)
		VALUES (?, ?, ?, ?, NULL, ?)`, userID, operation, key, requestHash, now)
	if err == nil {
		return 0, false, nil // we own the key; do the work
	}
	if !database.IsDuplicateKey(err) {
		return 0, false, fmt.Errorf("claim idempotency key: %w", err)
	}

	// A locking read always sees the latest committed row, regardless of the
	// transaction's snapshot.
	var storedHash string
	var resultID sql.NullInt64
	err = tx.QueryRowContext(ctx, `SELECT request_hash, result_id FROM idempotency_keys
		WHERE user_id = ? AND operation = ? AND idem_key = ? LOCK IN SHARE MODE`,
		userID, operation, key).Scan(&storedHash, &resultID)
	if err != nil {
		return 0, false, fmt.Errorf("read idempotency key: %w", err)
	}
	if storedHash != requestHash {
		return 0, false, apperr.ErrIdempotencyReuse
	}
	if !resultID.Valid {
		// Cannot happen for committed rows: result_id is set before COMMIT.
		return 0, false, fmt.Errorf("idempotency key %q has no result", key)
	}
	return resultID.Int64, true, nil
}

// Run is the helper services normally use. Inside tx it:
//  1. runs create directly when key is empty (no idempotency requested);
//  2. otherwise claims the key, returns the stored result if the key was
//     already completed, or runs create and stores its result.
//
// request must contain every input that affects the result.
func Run(ctx context.Context, tx *sql.Tx, now time.Time, userID int64, operation, key string,
	request any, create func() (int64, error)) (resultID int64, replayed bool, err error) {
	if key == "" {
		id, err := create()
		return id, false, err
	}
	hash, err := HashRequest(request)
	if err != nil {
		return 0, false, err
	}
	existing, found, err := Claim(ctx, tx, now, userID, operation, key, hash)
	if err != nil {
		return 0, false, err
	}
	if found {
		return existing, true, nil
	}
	id, err := create()
	if err != nil {
		return 0, false, err
	}
	if err := Complete(ctx, tx, userID, operation, key, id); err != nil {
		return 0, false, err
	}
	return id, false, nil
}

// Complete stores the result of the operation. Call it in the same tx,
// right before returning nil from the transaction function.
func Complete(ctx context.Context, tx *sql.Tx, userID int64, operation, key string, resultID int64) error {
	_, err := tx.ExecContext(ctx, `UPDATE idempotency_keys SET result_id = ?
		WHERE user_id = ? AND operation = ? AND idem_key = ?`, resultID, userID, operation, key)
	if err != nil {
		return fmt.Errorf("complete idempotency key: %w", err)
	}
	return nil
}
