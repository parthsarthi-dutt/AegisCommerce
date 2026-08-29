package domain

import (
	"time"

	"github.com/google/uuid"
)

type TxStatus string

// Complete list of valid transaction states.
const (
	StatusCreated        TxStatus = "created"
	StatusAuthorized     TxStatus = "authorized"
	StatusPaymentPending TxStatus = "payment_pending"
	StatusCaptured       TxStatus = "captured"
	StatusCompleted      TxStatus = "completed"
	StatusFailed         TxStatus = "failed"
	StatusExpired        TxStatus = "expired"
	StatusPaymentFailed  TxStatus = "payment_failed"
	StatusPaymentUnknown TxStatus = "payment_status_unknown" // Explicit uncertainty state
)

// Transaction represents an attempt by an agent to purchase a product.
type Transaction struct {
	ID               uuid.UUID      `json:"id"`
	MerchantID       uuid.UUID      `json:"merchant_id"`
	AgentID          uuid.UUID      `json:"agent_id"`
	GrantID          uuid.UUID      `json:"grant_id"`
	SessionID        *uuid.UUID     `json:"session_id,omitempty"`
	IdempotencyKey   string         `json:"idempotency_key"`
	CatalogVersionID *uuid.UUID     `json:"catalog_version_id,omitempty"`
	Status           TxStatus       `json:"status"`
	TotalAmountPaise int64          `json:"total_amount_paise"`
	Currency         string         `json:"currency"`
	ProductID        uuid.UUID      `json:"product_id"`
	Quantity         int            `json:"quantity"`
	GatewayOrderID *string `json:"gateway_order_id,omitempty"`
	FailureReason    *string        `json:"failure_reason,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

// validTransitions defines the explicit state machine for financial safety.
var validTransitions = map[TxStatus][]TxStatus{
	StatusCreated:        {StatusAuthorized, StatusFailed, StatusExpired},
	StatusAuthorized:     {StatusPaymentPending, StatusFailed, StatusExpired},
	StatusPaymentPending: {StatusCaptured, StatusPaymentFailed, StatusPaymentUnknown},
	StatusCaptured:       {StatusCompleted, StatusFailed},
	StatusPaymentFailed:  {StatusPaymentPending, StatusFailed},                        // Retry allowed
	StatusPaymentUnknown: {StatusPaymentPending, StatusFailed, StatusCaptured},        // Resolved via reconciliation
}

// CanTransitionTo returns true if the transaction is allowed to move to the new state.
func (t *Transaction) CanTransitionTo(next TxStatus) bool {
	allowed, ok := validTransitions[t.Status]
	if !ok {
		return false
	}
	for _, status := range allowed {
		if status == next {
			return true
		}
	}
	return false
}
