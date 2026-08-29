package domain

import (
	"time"

	"github.com/google/uuid"
)

type AgentStatus string

const (
	AgentStatusActive    AgentStatus = "active"
	AgentStatusSuspended AgentStatus = "suspended"
	AgentStatusRevoked   AgentStatus = "revoked"
)

// Agent represents an AI buyer interacting with the system.
type Agent struct {
	ID          uuid.UUID   `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	HMACKeyID   string      `json:"hmac_key_id"` // Public identifier for protocol authentication
	AgentType   string      `json:"agent_type"`  // e.g., 'buyer', 'auditor', 'test'
	Status      AgentStatus `json:"status"`
	CreatedAt   time.Time   `json:"created_at"`
}

// AgentSession represents a time-bounded interaction session for an Agent.
type AgentSession struct {
	ID        uuid.UUID `json:"id"`
	AgentID   uuid.UUID `json:"agent_id"`
	Status    string    `json:"status"` // 'active', 'expired', 'terminated'
	IPAddress string    `json:"ip_address,omitempty"`
	UserAgent string    `json:"user_agent,omitempty"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
