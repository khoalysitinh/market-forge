// Package apperr defines the business error type shared by all modules.
//
// Services return *apperr.Error for failures the caller is allowed to see
// (validation, permission, state conflicts). The HTTP layer maps Kind to a
// status code. Any other error is treated as an internal error: it is logged
// on the server and the client only sees a generic message.
package apperr

import (
	"errors"
	"fmt"
)

// Kind classifies an error so the HTTP layer can choose a status code
// without knowing every individual error code.
type Kind int

const (
	KindInvalid       Kind = iota + 1 // malformed input -> 400
	KindUnauthorized                  // not logged in / bad session -> 401
	KindForbidden                     // logged in but not allowed -> 403
	KindNotFound                      // resource missing or hidden -> 404
	KindConflict                      // state or uniqueness conflict -> 409
	KindUnprocessable                 // well-formed but violates a business rule -> 422
)

// Error is a business error with a stable machine-readable Code.
// Code values are part of the public API contract (see docs/api/API.md).
type Error struct {
	Kind    Kind
	Code    string
	Message string
}

func (e *Error) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }

// New creates a business error.
func New(kind Kind, code, message string) *Error {
	return &Error{Kind: kind, Code: code, Message: message}
}

// As extracts an *Error from err (following wrapping), or returns nil.
func As(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return nil
}

// Common errors reused by several modules.
var (
	ErrUnauthenticated  = New(KindUnauthorized, "UNAUTHENTICATED", "Login required")
	ErrCSRF             = New(KindForbidden, "CSRF_TOKEN_INVALID", "Missing or invalid CSRF token")
	ErrOwnerOnly        = New(KindForbidden, "OWNER_ONLY", "Only the room owner can do this")
	ErrIdempotencyReuse = New(KindConflict, "IDEMPOTENCY_KEY_REUSED",
		"This Idempotency-Key was already used with a different request body")
)
