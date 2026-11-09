// Package app wires every module together and defines the HTTP routes.
// It is the only place that knows about all modules; modules never import app.
package app

import (
	"context"
	"database/sql"
	"io/fs"
	"log/slog"
	"net/http"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/dojo/rooms"
	"github.com/khoalysitinh/market-forge/backend/internal/dojo/trials"
	"github.com/khoalysitinh/market-forge/backend/internal/identity"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/clock"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/httpserver"
	"github.com/khoalysitinh/market-forge/backend/migrations"
)

// Deps are the inputs needed to build the HTTP handler. Tests pass their
// own clock, seed source and a low bcrypt cost.
type Deps struct {
	DB           *sql.DB
	Log          *slog.Logger
	Now          clock.Func
	Seed         trials.SeedFunc
	BcryptCost   int
	SessionTTL   time.Duration
	CookieSecure bool
}

// NewHandler builds services and handlers and returns the root http.Handler.
func NewHandler(d Deps) (http.Handler, error) {
	idSvc, err := identity.NewService(d.DB, d.Now, d.BcryptCost, d.SessionTTL)
	if err != nil {
		return nil, err
	}
	idH := identity.NewHandler(idSvc, d.CookieSecure)
	roomH := rooms.NewHandler(rooms.NewService(d.DB, d.Now))
	trialH := trials.NewHandler(trials.NewService(d.DB, d.Now, d.Seed))

	mux := http.NewServeMux()
	auth := func(h http.HandlerFunc) http.Handler { return idH.RequireAuth(h) }

	// Probes (no auth).
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		httpserver.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/v1/ready", readyHandler(d.DB))

	// Identity.
	mux.HandleFunc("POST /api/v1/auth/register", idH.Register)
	mux.HandleFunc("POST /api/v1/auth/login", idH.Login)
	mux.Handle("POST /api/v1/auth/logout", auth(idH.Logout))
	mux.Handle("GET /api/v1/auth/me", auth(idH.Me))

	// Rooms.
	mux.Handle("POST /api/v1/rooms", auth(roomH.Create))
	mux.Handle("GET /api/v1/rooms", auth(roomH.List))
	mux.Handle("POST /api/v1/rooms/join", auth(roomH.Join))
	mux.Handle("GET /api/v1/rooms/{id}", auth(roomH.Get))
	mux.Handle("GET /api/v1/rooms/{id}/events", auth(roomH.Events))

	// Trials.
	mux.Handle("POST /api/v1/rooms/{id}/trials", auth(trialH.CreateTrial))
	mux.Handle("GET /api/v1/rooms/{id}/trials", auth(trialH.ListRoomTrials))
	mux.Handle("GET /api/v1/trials/{id}", auth(trialH.GetTrial))
	mux.Handle("POST /api/v1/trials/{id}/start", auth(trialH.StartTrial))
	mux.Handle("GET /api/v1/trials/{id}/candles", auth(trialH.Candles))

	// Rounds.
	mux.Handle("GET /api/v1/rounds/{id}", auth(trialH.GetRound))
	mux.Handle("POST /api/v1/rounds/{id}/decisions", auth(trialH.CommitDecision))
	mux.Handle("POST /api/v1/rounds/{id}/reviews", auth(trialH.SubmitReview))
	mux.Handle("POST /api/v1/rounds/{id}/lock", auth(trialH.Transition(trials.ActionLock)))
	mux.Handle("POST /api/v1/rounds/{id}/reveal", auth(trialH.Transition(trials.ActionReveal)))
	mux.Handle("POST /api/v1/rounds/{id}/complete", auth(trialH.Transition(trials.ActionComplete)))

	// Anything else under /api/ is a JSON 404.
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		httpserver.WriteError(w, r, apperr.New(apperr.KindNotFound, "ROUTE_NOT_FOUND", "No such endpoint"))
	})

	return httpserver.Chain(mux,
		httpserver.RequestContext(d.Log),
		httpserver.Recover(),
		httpserver.SecurityHeaders(),
	), nil
}

// readyHandler reports 200 only when the database answers and every
// embedded migration has been applied; otherwise 503.
func readyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		notReady := func(reason string) {
			httpserver.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "reason": reason})
		}
		if err := db.PingContext(ctx); err != nil {
			notReady("database unreachable")
			return
		}
		files, _ := fs.Glob(migrations.FS, "*.sql")
		var applied int
		if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM schema_migrations").Scan(&applied); err != nil || applied < len(files) {
			notReady("migrations pending")
			return
		}
		httpserver.WriteJSON(w, http.StatusOK, map[string]any{"status": "ready", "migrations": applied})
	}
}
