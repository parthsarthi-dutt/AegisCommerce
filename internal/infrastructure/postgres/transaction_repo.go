package postgres

import (
	"context"
	"errors"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TransactionRepository struct {
	tm *database.TransactionManager
}

func NewTransactionRepository(tm *database.TransactionManager) *TransactionRepository {
	return &TransactionRepository{tm: tm}
}

func (r *TransactionRepository) Create(ctx context.Context, tx *domain.Transaction) error {
	db := r.tm.GetDB(ctx)

	query := `
		INSERT INTO transactions (
			id, merchant_id, agent_id, grant_id, session_id, idempotency_key, 
			catalog_version_id, status, total_amount_paise, currency, 
			product_id, quantity, gateway_order_id, failure_reason, metadata, 
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
		)
	`
	_, err := db.Exec(ctx, query,
		tx.ID, tx.MerchantID, tx.AgentID, tx.GrantID, tx.SessionID, tx.IdempotencyKey,
		tx.CatalogVersionID, tx.Status, tx.TotalAmountPaise, tx.Currency,
		tx.ProductID, tx.Quantity, tx.GatewayOrderID, tx.FailureReason, tx.Metadata, 
		tx.CreatedAt, tx.UpdatedAt,
	)
	return err
}

func (r *TransactionRepository) Get(ctx context.Context, id uuid.UUID) (*domain.Transaction, error) {
	db := r.tm.GetDB(ctx)
	
	query := `
		SELECT id, merchant_id, agent_id, grant_id, session_id, idempotency_key, 
		       catalog_version_id, status, total_amount_paise, currency, 
		       product_id, quantity, gateway_order_id, failure_reason, metadata, 
		       created_at, updated_at
		FROM transactions
		WHERE id = $1
	`
	var tx domain.Transaction
	err := db.QueryRow(ctx, query, id).Scan(
		&tx.ID, &tx.MerchantID, &tx.AgentID, &tx.GrantID, &tx.SessionID, &tx.IdempotencyKey,
		&tx.CatalogVersionID, &tx.Status, &tx.TotalAmountPaise, &tx.Currency,
		&tx.ProductID, &tx.Quantity, &tx.GatewayOrderID, &tx.FailureReason, &tx.Metadata,
		&tx.CreatedAt, &tx.UpdatedAt,
	)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Return nil, nil when not found, to be handled by Use Case
		}
		return nil, err
	}
	return &tx, nil
}

func (r *TransactionRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.TxStatus, reason string) error {
	db := r.tm.GetDB(ctx)
	
	query := `
		UPDATE transactions
		SET status = $1, 
		    failure_reason = CASE WHEN $2 = '' THEN failure_reason ELSE $2 END,
		    updated_at = NOW()
		WHERE id = $3
	`
	_, err := db.Exec(ctx, query, status, reason, id)
	return err
}

func (r *TransactionRepository) CheckIdempotency(ctx context.Context, key string, scope string) (*domain.Transaction, error) {
	db := r.tm.GetDB(ctx)
	
	// We JOIN the idempotency_keys table with transactions.
	query := `
		SELECT t.id, t.merchant_id, t.agent_id, t.grant_id, t.session_id, t.idempotency_key, 
		       t.catalog_version_id, t.status, t.total_amount_paise, t.currency, 
		       t.product_id, t.quantity, t.gateway_order_id, t.failure_reason, t.metadata, 
		       t.created_at, t.updated_at
		FROM transactions t
		JOIN idempotency_keys ik ON t.id = ik.transaction_id
		WHERE ik.key = $1 AND ik.scope = $2
	`
	
	var tx domain.Transaction
	err := db.QueryRow(ctx, query, key, scope).Scan(
		&tx.ID, &tx.MerchantID, &tx.AgentID, &tx.GrantID, &tx.SessionID, &tx.IdempotencyKey,
		&tx.CatalogVersionID, &tx.Status, &tx.TotalAmountPaise, &tx.Currency,
		&tx.ProductID, &tx.Quantity, &tx.GatewayOrderID, &tx.FailureReason, &tx.Metadata,
		&tx.CreatedAt, &tx.UpdatedAt,
	)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Valid: No previous transaction used this idempotency key
		}
		return nil, err
	}
	
	return &tx, nil
}

func (r *TransactionRepository) RecordIdempotency(ctx context.Context, key string, scope string, txID uuid.UUID) error {
	db := r.tm.GetDB(ctx)
	
	// The DB schema requires `agent_id` as part of the Primary Key to guarantee 
	// one agent cannot accidentally (or maliciously) collide with another agent's key.
	// Instead of passing agentID to this function, we do an INSERT ... SELECT to grab it
	// directly from the transaction we just created.
	query := `
		INSERT INTO idempotency_keys (key, agent_id, scope, transaction_id)
		SELECT $1, agent_id, $2, $3
		FROM transactions WHERE id = $3
	`
	_, err := db.Exec(ctx, query, key, scope, txID)
	return err
}


func (r *TransactionRepository) UpdateGatewayOrder(ctx context.Context, id uuid.UUID, orderID string) error {
    db := r.tm.GetDB(ctx)

    query := `UPDATE transactions SET gateway_order_id = $1, updated_at = NOW() WHERE id = $2`
    _, err := db.Exec(ctx, query, orderID, id)
    return err
}

func (r *TransactionRepository) GetByGatewayOrderID(ctx context.Context, orderID string) (*domain.Transaction, error) {
	db := r.tm.GetDB(ctx)
	
	query := `
		SELECT id, merchant_id, agent_id, grant_id, session_id, idempotency_key, 
		       catalog_version_id, status, total_amount_paise, currency, 
		       product_id, quantity, gateway_order_id, failure_reason, metadata, 
		       created_at, updated_at
		FROM transactions
		WHERE gateway_order_id = $1
	`
	var tx domain.Transaction
	err := db.QueryRow(ctx, query, orderID).Scan(
		&tx.ID, &tx.MerchantID, &tx.AgentID, &tx.GrantID, &tx.SessionID, &tx.IdempotencyKey,
		&tx.CatalogVersionID, &tx.Status, &tx.TotalAmountPaise, &tx.Currency,
		&tx.ProductID, &tx.Quantity, &tx.GatewayOrderID, &tx.FailureReason, &tx.Metadata,
		&tx.CreatedAt, &tx.UpdatedAt,
	)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // Valid: Webhook might be for an order not generated by this system
		}
		return nil, err
	}
	return &tx, nil
}
