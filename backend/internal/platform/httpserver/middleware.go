package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"
)

// Middleware wraps a handler with extra behaviour.
type Middleware func(http.Handler) http.Handler

// Chain applies middlewares so that the first one listed runs first.
func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

type ctxKey int

const (
	ctxKeyRequestID ctxKey = iota
	ctxKeyLogger
)

// RequestIDFrom returns the request ID set by the RequestContext middleware.
func RequestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(ctxKeyRequestID).(string)
	return id
}

// LoggerFrom returns the request-scoped logger (with request_id attached).
func LoggerFrom(ctx context.Context) *slog.Logger {
	l, _ := ctx.Value(ctxKeyLogger).(*slog.Logger)
	return loggerOrDefault(l)
}

// RequestContext assigns a request ID, stores a request-scoped logger in the
// context, and logs one line per request after it finishes.
func RequestContext(log *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := newRequestID()
			reqLog := log.With("request_id", id)
			ctx := context.WithValue(r.Context(), ctxKeyRequestID, id)
			ctx = context.WithValue(ctx, ctxKeyLogger, reqLog)

			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			sw.Header().Set("X-Request-ID", id)
			start := time.Now()
			next.ServeHTTP(sw, r.WithContext(ctx))
			reqLog.Info("http request",
				"method", r.Method, "path", r.URL.Path, "status", sw.status,
				"duration_ms", time.Since(start).Milliseconds())
		})
	}
}

// Recover turns a panic into a 500 response instead of killing the server.
func Recover() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if p := recover(); p != nil {
					LoggerFrom(r.Context()).Error("panic", "panic", p)
					WriteJSON(w, http.StatusInternalServerError, errorBody{Error: errorDetail{
						Code: "INTERNAL", Message: "Internal server error"}})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders adds conservative headers to every API response.
func SecurityHeaders() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "no-referrer")
			h.Set("Cache-Control", "no-store")
			next.ServeHTTP(w, r)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func newRequestID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b) // crypto/rand.Read never fails on supported platforms
	return hex.EncodeToString(b)
}
