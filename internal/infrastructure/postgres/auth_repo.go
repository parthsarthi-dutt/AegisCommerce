package postgres

import (
	"context"
	"fmt"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
)

type AuthRepository struct {
	tm *database.TransactionManager
}

func NewAuthRepository(tm *database.TransactionManager) *AuthRepository {
	return &AuthRepository{tm: tm}
}

func (r *AuthRepository) GetActiveGrant(ctx context.Context, agentID uuid.UUID) (*domain.Grant, error) {
	db := r.tm.GetDB(ctx)
	
	// We only return grants that have not expired.
	query := `
		SELECT id, agent_id, granted_by, merchant_id, max_amount_paise, currency, 
		       allowed_categories, denied_categories, max_single_transaction, 
		       status, created_at, expires_at, revoked_at
		FROM authorization_grants
		WHERE agent_id = $1 AND status = 'active' AND expires_at > NOW()
		LIMIT 1
	`
	var g domain.Grant
	err := db.QueryRow(ctx, query, agentID).Scan(
		&g.ID, &g.AgentID, &g.GrantedBy, &g.MerchantID, &g.MaxAmountPaise, &g.Currency,
		&g.AllowedCategories, &g.DeniedCategories, &g.MaxSingleTransaction,
		&g.Status, &g.CreatedAt, &g.ExpiresAt, &g.RevokedAt,
	)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *AuthRepository) GetUsage(ctx context.Context, grantID uuid.UUID) (*domain.GrantUsage, error) {
	db := r.tm.GetDB(ctx)
	
	query := `
		SELECT grant_id, amount_consumed, amount_reserved, transaction_count, last_used_at, updated_at
		FROM grant_usage
		WHERE grant_id = $1
	`
	var u domain.GrantUsage
	err := db.QueryRow(ctx, query, grantID).Scan(
		&u.GrantID, &u.AmountConsumed, &u.AmountReserved, &u.TransactionCount, &u.LastUsedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ReserveUsage is Phase 1 of the Saga. It MUST run inside a transaction.
func (r *AuthRepository) ReserveUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error {
	db := r.tm.GetDB(ctx)
	
	// CRITICAL SECURITY FEATURE: Atomic Concurrency Enforcement
	// Even though the PolicyEngine in Go approved the transaction, we enforce the
	// mathematical limit in the UPDATE statement itself. If two concurrent requests
	// try to reserve money at the exact same millisecond, PostgreSQL will serialize
	// these UPDATEs. The first will succeed. The second will fail the WHERE clause.
	query := `
		UPDATE grant_usage gu
		SET amount_reserved = gu.amount_reserved + $1::bigint,
		    updated_at = NOW()
		FROM authorization_grants ag
		WHERE gu.grant_id = $2::uuid AND ag.id = gu.grant_id
		  AND (gu.amount_consumed + gu.amount_reserved + $1::bigint) <= ag.max_amount_paise
	`
	
	tag, err := db.Exec(ctx, query, amountPaise, grantID)
	if err != nil {
		return err
	}
	
	// If RowsAffected is 0, it means the WHERE clause failed (limit exceeded).
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("failed to reserve usage: limit exceeded or grant not found")
	}
	
	return nil
}

// CommitUsage is Phase 3a of the Saga (Razorpay Success).
func (r *AuthRepository) CommitUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error {
	db := r.tm.GetDB(ctx)
	
	// Moves money from reserved -> consumed.
	query := `
		UPDATE grant_usage
		SET amount_reserved = amount_reserved - $1,
		    amount_consumed = amount_consumed + $1,
		    transaction_count = transaction_count + 1,
		    last_used_at = NOW(),
		    updated_at = NOW()
		WHERE grant_id = $2 AND amount_reserved >= $1
	`
	
	tag, err := db.Exec(ctx, query, amountPaise, grantID)
	if err != nil {
		return err
	}
	
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("failed to commit usage: insufficient reserved amount")
	}
	return nil
}

// ReleaseUsage is Phase 3b of the Saga (Razorpay Failure).
func (r *AuthRepository) ReleaseUsage(ctx context.Context, grantID uuid.UUID, amountPaise int64) error {
	db := r.tm.GetDB(ctx)
	
	// Removes the reservation, making the limit available for future attempts.
	query := `
		UPDATE grant_usage
		SET amount_reserved = amount_reserved - $1,
		    updated_at = NOW()
		WHERE grant_id = $2 AND amount_reserved >= $1
	`
	
	tag, err := db.Exec(ctx, query, amountPaise, grantID)
	if err != nil {
		return err
	}
	
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("failed to release usage: insufficient reserved amount")
	}
	return nil
}