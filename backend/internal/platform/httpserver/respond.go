// Package httpserver contains HTTP plumbing shared by every module:
// JSON encoding/decoding, error mapping and middleware. It knows nothing
// about business rules.
package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strconv"

	"github.com/khoalysitinh/market-forge/backend/internal/platform/apperr"
)

// maxBodyBytes bounds request bodies. Our largest legitimate body is a
// decision (~4 KB of text); 64 KiB leaves plenty of room.
const maxBodyBytes = 64 << 10

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteJSON writes v as a JSON response with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// WriteError converts err into the structured error response.
// Business errors (*apperr.Error) are shown to the client. Anything else is
// logged with the request ID and the client gets a generic 500 — never a
// stack trace, SQL statement or secret.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	if ae := apperr.As(err); ae != nil {
		WriteJSON(w, statusFor(ae.Kind), errorBody{Error: errorDetail{Code: ae.Code, Message: ae.Message}})
		return
	}
	LoggerFrom(r.Context()).Error("internal error",
		"error", err.Error(), "method", r.Method, "path", r.URL.Path)
	WriteJSON(w, http.StatusInternalServerError, errorBody{Error: errorDetail{
		Code: "INTERNAL", Message: "Internal server error (request id " + RequestIDFrom(r.Context()) + ")",
	}})
}

func statusFor(k apperr.Kind) int {
	switch k {
	case apperr.KindInvalid:
		return http.StatusBadRequest
	case apperr.KindUnauthorized:
		return http.StatusUnauthorized
	case apperr.KindForbidden:
		return http.StatusForbidden
	case apperr.KindNotFound:
		return http.StatusNotFound
	case apperr.KindConflict:
		return http.StatusConflict
	case apperr.KindUnprocessable:
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

var (
	errNotJSON  = apperr.New(apperr.KindInvalid, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json")
	errBadJSON  = apperr.New(apperr.KindInvalid, "INVALID_JSON", "Request body is not valid JSON for this endpoint")
	errTooLarge = apperr.New(apperr.KindInvalid, "BODY_TOO_LARGE", "Request body is too large")
)

// DecodeJSON reads exactly one JSON object from the body into dst.
// Unknown fields are rejected so typos surface instead of being ignored.
// Requiring application/json also blocks classic cross-site HTML form posts.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	mt, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mt != "application/json" {
		return errNotJSON
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return errTooLarge
		}
		return errBadJSON
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errBadJSON // trailing data after the object
	}
	return nil
}

// PathID parses a positive integer path parameter such as {id}.
func PathID(r *http.Request, name string) (int64, error) {
	raw := r.PathValue(name)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, apperr.New(apperr.KindInvalid, "INVALID_ID", fmt.Sprintf("Path parameter %q must be a positive integer", name))
	}
	return id, nil
}

// QueryInt parses an optional non-negative integer query parameter.
func QueryInt(r *http.Request, name string, fallback int64) (int64, error) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v < 0 {
		return 0, apperr.New(apperr.KindInvalid, "INVALID_QUERY", fmt.Sprintf("Query parameter %q must be a non-negative integer", name))
	}
	return v, nil
}

// Logger helpers live here so WriteError can log without a global logger.
func loggerOrDefault(l *slog.Logger) *slog.Logger {
	if l == nil {
		return slog.Default()
	}
	return l
}
