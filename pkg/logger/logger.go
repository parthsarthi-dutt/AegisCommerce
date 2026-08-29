package logger

import (
	"log/slog"
	"os"
)

// New creates a structured JSON logger.
//
// Why JSON? Structured logs are machine-parseable. Every log line is a JSON
// object with consistent fields. This enables filtering by agent_id,
// transaction_id, error type, etc. in any log aggregation tool.
//
// Why slog? It's Go's standard library structured logger (since Go 1.21).
// Zero dependencies. Production-grade. Supports key-value pairs natively.
func New() *slog.Logger {
	opts := &slog.HandlerOptions{
		Level:     slog.LevelDebug, // Debug for development; switch to Info in production
		AddSource: true,            // Includes file:line in every log entry
	}

	handler := slog.NewJSONHandler(os.Stdout, opts)
	return slog.New(handler)
}
