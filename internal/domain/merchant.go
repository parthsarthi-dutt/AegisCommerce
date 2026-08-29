package domain

import (
	"time"

	"github.com/google/uuid"
)

type MerchantStatus string

const (
	MerchantStatusActive    MerchantStatus = "active"
	MerchantStatusSuspended MerchantStatus = "suspended"
)

// Merchant represents a business entity on the platform.
type Merchant struct {
	ID           uuid.UUID      `json:"id"`
	Name         string         `json:"name"`
	Description  string         `json:"description,omitempty"`
	APIKeyID     string         `json:"api_key_id"` // Public identifier, actual secret is hashed in DB
	Status       MerchantStatus `json:"status"`
	ContactEmail string         `json:"contact_email,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// Capability represents a specific feature a merchant supports (e.g., payment methods, protocols).
type Capability struct {
	Type  string         `json:"capability_type"`
	Key   string         `json:"capability_key"`
	Value map[string]any `json:"capability_value"`
}

// Policy represents a merchant's rules (e.g., return policy, shipping terms).
type Policy struct {
	Type    string         `json:"policy_type"`
	Title   string         `json:"title"`
	Content map[string]any `json:"content"`
	Version int            `json:"version"`
}
