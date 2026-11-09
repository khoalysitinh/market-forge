package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/clock"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/database"
)

// Service implements the identity use cases.
type Service struct {
	db         *sql.DB
	now        clock.Func
	bcryptCost int
	sessionTTL time.Duration
	// dummyHash is compared against when a username does not exist, so a
	// failed login takes about the same time whether or not the user exists.
	dummyHash []byte
}

// NewService builds the identity service. bcryptCost must be >= bcrypt.MinCost.
func NewService(db *sql.DB, now clock.Func, bcryptCost int, sessionTTL time.Duration) (*Service, error) {
	dummy, err := bcrypt.GenerateFromPassword([]byte("market-forge-timing-equaliser"), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("init dummy hash: %w", err)
	}
	return &Service{db: db, now: now, bcryptCost: bcryptCost, sessionTTL: sessionTTL, dummyHash: dummy}, nil
}

// Register creates a new account.
func (s *Service) Register(ctx context.Context, in RegisterInput) (User, error) {
	in.Normalize()
	if err := in.Validate(); err != nil {
		return User{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), s.bcryptCost)
	if err != nil {
		return User{}, fmt.Errorf("hash password: %w", err)
	}
	id, err := insertUser(ctx, s.db, in, string(hash), s.now())
	if database.IsDuplicateKey(err) {
		return User{}, ErrUsernameTaken
	}
	if err != nil {
		return User{}, fmt.Errorf("insert user: %w", err)
	}
	return getUserByID(ctx, s.db, id)
}

// LoginResult is returned after a successful login. Token goes into the
// HttpOnly cookie and must never be logged or put in a JSON body.
type LoginResult struct {
	User      User
	Token     string
	CSRFToken string
	ExpiresAt time.Time
}

// Login verifies credentials and creates a new server-side session.
func (s *Service) Login(ctx context.Context, in LoginInput) (LoginResult, error) {
	user, hash, err := getCredentials(ctx, s.db, normalizeUsername(in.Username))
	if errors.Is(err, errNoRows) {
		_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte(in.Password))
		return LoginResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResult{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		return LoginResult{}, ErrInvalidCredentials
	}

	token, err := randomToken(32)
	if err != nil {
		return LoginResult{}, err
	}
	csrfBytes := make([]byte, 32)
	if _, err := rand.Read(csrfBytes); err != nil {
		return LoginResult{}, fmt.Errorf("generate csrf token: %w", err)
	}
	now := s.now()
	sess := Session{UserID: user.ID, CSRFToken: hex.EncodeToString(csrfBytes), ExpiresAt: now.Add(s.sessionTTL)}
	if err := insertSession(ctx, s.db, hashToken(token), sess, now); err != nil {
		return LoginResult{}, err
	}
	return LoginResult{User: user, Token: token, CSRFToken: sess.CSRFToken, ExpiresAt: sess.ExpiresAt}, nil
}

// Authenticate resolves a session cookie value to its user and session.
func (s *Service) Authenticate(ctx context.Context, token string) (User, Session, error) {
	if token == "" {
		return User{}, Session{}, apperr.ErrUnauthenticated
	}
	sess, err := getActiveSession(ctx, s.db, hashToken(token), s.now())
	if errors.Is(err, errNoRows) {
		return User{}, Session{}, apperr.ErrUnauthenticated
	}
	if err != nil {
		return User{}, Session{}, err
	}
	user, err := getUserByID(ctx, s.db, sess.UserID)
	if err != nil {
		return User{}, Session{}, err
	}
	return user, sess, nil
}

// Logout revokes the session. Revoking an already revoked session is a no-op.
func (s *Service) Logout(ctx context.Context, token string) error {
	return revokeSession(ctx, s.db, hashToken(token), s.now())
}

func normalizeUsername(u string) string {
	in := RegisterInput{Username: u}
	in.Normalize()
	return in.Username
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
