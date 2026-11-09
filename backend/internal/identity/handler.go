package identity

import (
	"context"
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
	"github.com/khoalysitinh/market-forge/backend/internal/platform/httpserver"
)

// CookieName is the session cookie. CSRFHeader carries the CSRF token on
// every state-changing request made with that cookie.
const (
	CookieName = "mf_session"
	CSRFHeader = "X-CSRF-Token"
)

// Handler exposes identity over HTTP.
type Handler struct {
	svc          *Service
	cookieSecure bool
}

func NewHandler(svc *Service, cookieSecure bool) *Handler {
	return &Handler{svc: svc, cookieSecure: cookieSecure}
}

// meResponse is returned by login and /auth/me. The CSRF token is readable
// by our own JavaScript (same origin) but not by other sites.
type meResponse struct {
	User      User      `json:"user"`
	CSRFToken string    `json:"csrf_token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Register handles POST /api/v1/auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var in RegisterInput
	if err := httpserver.DecodeJSON(w, r, &in); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	user, err := h.svc.Register(r.Context(), in)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	httpserver.WriteJSON(w, http.StatusCreated, map[string]User{"user": user})
}

// Login handles POST /api/v1/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var in LoginInput
	if err := httpserver.DecodeJSON(w, r, &in); err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	res, err := h.svc.Login(r.Context(), in)
	if err != nil {
		httpserver.WriteError(w, r, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    res.Token,
		Path:     "/api/",
		Expires:  res.ExpiresAt,
		HttpOnly: true,                 // JavaScript cannot read the token
		Secure:   h.cookieSecure,       // HTTPS only in real deployments
		SameSite: http.SameSiteLaxMode, // not sent on cross-site POSTs
	})
	httpserver.WriteJSON(w, http.StatusOK, meResponse{User: res.User, CSRFToken: res.CSRFToken, ExpiresAt: res.ExpiresAt})
}

// Logout handles POST /api/v1/auth/logout (behind RequireAuth).
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(CookieName)
	if err == nil {
		if err := h.svc.Logout(r.Context(), c.Value); err != nil {
			httpserver.WriteError(w, r, err)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: CookieName, Value: "", Path: "/api/", MaxAge: -1,
		HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteLaxMode})
	w.WriteHeader(http.StatusNoContent)
}

// Me handles GET /api/v1/auth/me (behind RequireAuth).
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	a := mustAuth(r.Context())
	httpserver.WriteJSON(w, http.StatusOK, meResponse{User: a.user, CSRFToken: a.session.CSRFToken, ExpiresAt: a.session.ExpiresAt})
}

type authKey struct{}

type authInfo struct {
	user    User
	session Session
}

// RequireAuth rejects requests without a valid session (401). For methods
// that change state it also requires the X-CSRF-Token header to match the
// session's token (403). The user ID always comes from the session — never
// from anything the client sends.
func (h *Handler) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(CookieName)
		if err != nil {
			httpserver.WriteError(w, r, apperr.ErrUnauthenticated)
			return
		}
		user, sess, err := h.svc.Authenticate(r.Context(), c.Value)
		if err != nil {
			httpserver.WriteError(w, r, err)
			return
		}
		if !isSafeMethod(r.Method) {
			got := r.Header.Get(CSRFHeader)
			if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(sess.CSRFToken)) != 1 {
				httpserver.WriteError(w, r, apperr.ErrCSRF)
				return
			}
		}
		ctx := context.WithValue(r.Context(), authKey{}, authInfo{user: user, session: sess})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UserFrom returns the authenticated user. ok is false outside RequireAuth.
func UserFrom(ctx context.Context) (User, bool) {
	a, ok := ctx.Value(authKey{}).(authInfo)
	return a.user, ok
}

func mustAuth(ctx context.Context) authInfo {
	a, ok := ctx.Value(authKey{}).(authInfo)
	if !ok {
		panic("identity: handler registered without RequireAuth")
	}
	return a
}

func isSafeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}
