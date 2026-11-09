// Package identity handles users, passwords and server-side sessions.
package identity

import (
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
)

// User is the public view of an account. It never contains the password hash.
type User struct {
	ID          int64     `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

// Session is a logged-in browser session.
type Session struct {
	UserID    int64
	CSRFToken string
	ExpiresAt time.Time
}

// Validation limits. bcrypt only uses the first 72 bytes of a password, so
// we reject longer passwords instead of silently truncating them.
const (
	minPasswordLen    = 10
	maxPasswordBytes  = 72
	maxDisplayNameLen = 64
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,32}$`)

var (
	ErrInvalidUsername = apperr.New(apperr.KindInvalid, "INVALID_USERNAME",
		"Username must be 3-32 characters: lowercase letters, digits or underscore")
	ErrInvalidPassword = apperr.New(apperr.KindInvalid, "INVALID_PASSWORD",
		"Password must be at least 10 characters and at most 72 bytes")
	ErrInvalidDisplayName = apperr.New(apperr.KindInvalid, "INVALID_DISPLAY_NAME",
		"Display name must be 1-64 characters")
	ErrUsernameTaken = apperr.New(apperr.KindConflict, "USERNAME_TAKEN",
		"This username is already registered")
	// Same message for "no such user" and "wrong password": do not reveal
	// which usernames exist.
	ErrInvalidCredentials = apperr.New(apperr.KindUnauthorized, "INVALID_CREDENTIALS",
		"Invalid username or password")
)

// RegisterInput is the body of POST /auth/register.
type RegisterInput struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// Normalize trims and lowercases fields; Validate checks them.
func (in *RegisterInput) Normalize() {
	in.Username = strings.ToLower(strings.TrimSpace(in.Username))
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	if in.DisplayName == "" {
		in.DisplayName = in.Username
	}
}

func (in RegisterInput) Validate() error {
	if !usernamePattern.MatchString(in.Username) {
		return ErrInvalidUsername
	}
	if utf8.RuneCountInString(in.Password) < minPasswordLen || len(in.Password) > maxPasswordBytes {
		return ErrInvalidPassword
	}
	if n := utf8.RuneCountInString(in.DisplayName); n < 1 || n > maxDisplayNameLen {
		return ErrInvalidDisplayName
	}
	return nil
}

// LoginInput is the body of POST /auth/login.
type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
