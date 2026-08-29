package domain

import (
	"time"

	"github.com/google/uuid"
)

type GrantStatus string

const (
	GrantStatusActive    GrantStatus = "active"
	GrantStatusExpired   GrantStatus = "expired"
	GrantStatusRevoked   GrantStatus = "revoked"
	GrantStatusExhausted GrantStatus = "exhausted"
)

// Grant represents a policy-bound authorization given to an agent.
type Grant struct {
	ID                   uuid.UUID   `json:"id"`
	AgentID              uuid.UUID   `json:"agent_id"`
	GrantedBy            string      `json:"granted_by"`
	MerchantID           *uuid.UUID  `json:"merchant_id,omitempty"` // nil means agent can transact with ANY merchant
	MaxAmountPaise       int64       `json:"max_amount_paise"`
	Currency             string      `json:"currency"`
	AllowedCategories    []string    `json:"allowed_categories"`
	DeniedCategories     []string    `json:"denied_categories"` // Deny takes priority over allow
	MaxSingleTransaction *int64      `json:"max_single_transaction,omitempty"`
	Status               GrantStatus `json:"status"`
	CreatedAt            time.Time   `json:"created_at"`
	ExpiresAt            time.Time   `json:"expires_at"`
	RevokedAt            *time.Time  `json:"revoked_at,omitempty"`
}

// GrantUsage tracks the consumed and reserved amounts for a grant.
// Separated from Grant because this is write-heavy (updated every transaction),
// while Grant is read-heavy.
type GrantUsage struct {
	GrantID          uuid.UUID  `json:"grant_id"`
	AmountConsumed   int64      `json:"amount_consumed"`
	AmountReserved   int64      `json:"amount_reserved"` // Required for the Reservation Saga
	TransactionCount int        `json:"transaction_count"`
	LastUsedAt       *time.Time `json:"last_used_at,omitempty"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
