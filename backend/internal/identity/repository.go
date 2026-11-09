package identity

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// errNoRows is returned by repository lookups when nothing matches.
var errNoRows = errors.New("identity: not found")

func insertUser(ctx context.Context, q database.Querier, in RegisterInput, hash string, now time.Time) (int64, error) {
	res, err := q.ExecContext(ctx,
		"INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)",
		in.Username, in.DisplayName, hash, now)
	if err != nil {
		return 0, err // caller checks database.IsDuplicateKey
	}
	return res.LastInsertId()
}

func getUserByID(ctx context.Context, q database.Querier, id int64) (User, error) {
	var u User
	err := q.QueryRowContext(ctx,
		"SELECT id, username, display_name, created_at FROM users WHERE id = ?", id).
		Scan(&u.ID, &u.Username, &u.DisplayName, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, errNoRows
	}
	if err != nil {
		return User{}, fmt.Errorf("get user: %w", err)
	}
	return u, nil
}

// getCredentials returns the user and password hash for a username.
func getCredentials(ctx context.Context, q database.Querier, username string) (User, string, error) {
	var u User
	var hash string
	err := q.QueryRowContext(ctx,
		"SELECT id, username, display_name, created_at, password_hash FROM users WHERE username = ?", username).
		Scan(&u.ID, &u.Username, &u.DisplayName, &u.CreatedAt, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, "", errNoRows
	}
	if err != nil {
		return User{}, "", fmt.Errorf("get credentials: %w", err)
	}
	return u, hash, nil
}

func insertSession(ctx context.Context, q database.Querier, tokenHash string, s Session, now time.Time) error {
	_, err := q.ExecContext(ctx, `INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?)`, tokenHash, s.UserID, s.CSRFToken, now, s.ExpiresAt)
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

// getActiveSession returns a session that is neither expired nor revoked.
func getActiveSession(ctx context.Context, q database.Querier, tokenHash string, now time.Time) (Session, error) {
	var s Session
	err := q.QueryRowContext(ctx, `SELECT user_id, csrf_token, expires_at FROM sessions
		WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`, tokenHash, now).
		Scan(&s.UserID, &s.CSRFToken, &s.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, errNoRows
	}
	if err != nil {
		return Session{}, fmt.Errorf("get session: %w", err)
	}
	return s, nil
}

func revokeSession(ctx context.Context, q database.Querier, tokenHash string, now time.Time) error {
	_, err := q.ExecContext(ctx,
		"UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", now, tokenHash)
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}
