package domain

import (
	"time"

	"github.com/google/uuid"
)

// AuditEvent tracks standard agent interactions for non-repudiation.
type AuditEvent struct {
	ID        uuid.UUID      `json:"id"`
	AgentID   uuid.UUID      `json:"agent_id"`
	EventType string         `json:"event_type"` // e.g., "search", "purchase_attempt"
	Resource  string         `json:"resource"`   // e.g., "/products", "/checkout"
	Metadata  map[string]any `json:"metadata,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}

// SecurityEvent tracks malicious or failed authentication attempts.
type SecurityEvent struct {
	ID        uuid.UUID      `json:"id"`
	AgentID   *uuid.UUID     `json:"agent_id,omitempty"` // May be nil if attacker is unknown
	EventType string         `json:"event_type"`         // e.g., "invalid_hmac", "catalog_tampering"
	Severity  string         `json:"severity"`           // "low", "medium", "high", "critical"
	IPAddress string         `json:"ip_address,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}