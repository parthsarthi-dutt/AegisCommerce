package apperrors

import "fmt"

// ErrorType classifies errors for HTTP status mapping and structured handling.
// The MCP/REST layer maps these to protocol-appropriate responses.
type ErrorType string

const (
	TypeNotFound     ErrorType = "NOT_FOUND"     // 404 — resource doesn't exist
	TypeValidation   ErrorType = "VALIDATION"    // 400 — input is malformed
	TypeUnauthorized ErrorType = "UNAUTHORIZED"  // 401 — identity not verified
	TypeForbidden    ErrorType = "FORBIDDEN"     // 403 — identity verified but action not allowed
	TypeConflict     ErrorType = "CONFLICT"      // 409 — idempotency conflict, duplicate
	TypeIntegrity    ErrorType = "INTEGRITY"     // 422 — catalog hash mismatch
	TypeInternal     ErrorType = "INTERNAL"      // 500 — unexpected system error
)

// AppError is the standard application error.
// Message is safe to return to external callers (agents, frontend).
// Internal is the underlying error — logged but never exposed externally.
type AppError struct {
	Type     ErrorType
	Message  string // Safe for external response
	Internal error  // Original error — logged, never sent to client
}

func (e *AppError) Error() string {
	if e.Internal != nil {
		return fmt.Sprintf("%s: %s (internal: %v)", e.Type, e.Message, e.Internal)
	}
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// Unwrap enables errors.Is and errors.As to traverse the error chain.
func (e *AppError) Unwrap() error {
	return e.Internal
}

// Constructor functions — keep domain logic clean and readable.

func NewNotFound(msg string, err error) *AppError {
	return &AppError{Type: TypeNotFound, Message: msg, Internal: err}
}

func NewValidation(msg string, err error) *AppError {
	return &AppError{Type: TypeValidation, Message: msg, Internal: err}
}

func NewUnauthorized(msg string, err error) *AppError {
	return &AppError{Type: TypeUnauthorized, Message: msg, Internal: err}
}

func NewForbidden(msg string, err error) *AppError {
	return &AppError{Type: TypeForbidden, Message: msg, Internal: err}
}

func NewConflict(msg string, err error) *AppError {
	return &AppError{Type: TypeConflict, Message: msg, Internal: err}
}

func NewIntegrity(msg string, err error) *AppError {
	return &AppError{Type: TypeIntegrity, Message: msg, Internal: err}
}

func NewInternal(msg string, err error) *AppError {
	return &AppError{Type: TypeInternal, Message: msg, Internal: err}
}