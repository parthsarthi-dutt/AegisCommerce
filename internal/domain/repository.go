package domain

import (
	"context"

	"github.com/google/uuid"
)

// CatalogRepository handles product discovery.
type CatalogRepository interface {
	GetProduct(ctx context.Context, productID uuid.UUID) (*ProductDetail, error)
	SearchProducts(ctx context.Context, filter SearchFilter) ([]ProductDetail, error)
}

// MerchantRepository handles merchant profiles and rules.
type MerchantRepository interface {
	GetMerchant(ctx context.Context, id uuid.UUID) (*Merchant, error)
	GetCapabilities(ctx context.Context, merchantID uuid.UUID) ([]Capability, error)
	GetPolicies(ctx context.Context, merchantID uuid.UUID) ([]Policy, error)
}

// AuthorizationRepository handles policy grants and usage limits.
type AuthorizationRepository interface {
	GetActiveGrant(ctx context.Context, agentID uuid.UUID) (*Grant, error)
	GetUsage(ctx context.Context, grantID uuid.UUID) (*GrantUsage, error)

	// Atomic reservation methods for the Saga pattern
	ReserveUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error
	CommitUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error
	ReleaseUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error
}

// TransactionRepository handles the core financial state machine.
type TransactionRepository interface {
	Create(ctx context.Context, tx *Transaction) error
	Get(ctx context.Context, id uuid.UUID) (*Transaction, error)
	GetByGatewayOrderID(ctx context.Context, orderID string) (*Transaction, error) // <-- ADD THIS LINE
	UpdateStatus(ctx context.Context, id uuid.UUID, status TxStatus, reason string) error
	
	// Idempotency methods prevent double-charging on retries
	CheckIdempotency(ctx context.Context, key string, scope string) (*Transaction, error)
	RecordIdempotency(ctx context.Context, key string, scope string, txID uuid.UUID) error

	UpdateGatewayOrder(ctx context.Context, id uuid.UUID, orderID string) error
}


// AuditRepository handles non-repudiation and security tracking.
type AuditRepository interface {
	RecordEvent(ctx context.Context, event AuditEvent) error
	RecordSecurityEvent(ctx context.Context, event SecurityEvent) error
	RecordPolicyDecision(ctx context.Context, txID uuid.UUID, decision PolicyDecisionRecord) error
}