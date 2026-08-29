package contextutil

import (
	"context"

	"github.com/google/uuid"
)

// unexported type prevents context key collisions
type contextKey string

const (
	agentIDKey    contextKey = "agent_id"
	sessionIDKey  contextKey = "session_id"
	requestIDKey  contextKey = "request_id"
)

// WithAgentID injects the agent ID into the context.
func WithAgentID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, agentIDKey, id)
}

// GetAgentID extracts the agent ID from the context.
func GetAgentID(ctx context.Context) (uuid.UUID, bool) {
	val, ok := ctx.Value(agentIDKey).(uuid.UUID)
	return val, ok
}

// WithRequestID injects the request trace ID.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

// GetRequestID extracts the request trace ID.
func GetRequestID(ctx context.Context) (string, bool) {
	val, ok := ctx.Value(requestIDKey).(string)
	return val, ok
}