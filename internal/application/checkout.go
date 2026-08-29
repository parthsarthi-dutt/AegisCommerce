package application

import (
	"context"
	"fmt"
	"log/slog"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/apperrors"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
)

type CheckoutRequest struct {
	MerchantID     uuid.UUID
	ProductID      uuid.UUID
	Quantity       int
	ExpectedPrice  int64
	Currency       string
	CatalogHash    string
	IdempotencyKey string
}

type CheckoutUseCase interface {
	ProposeTransaction(ctx context.Context, agentID uuid.UUID, req CheckoutRequest) (*domain.Transaction, error)
	ExecutePayment(ctx context.Context, txID uuid.UUID, idempotencyKey string) (*domain.Transaction, error)
	HandleWebhook(ctx context.Context, txID uuid.UUID, status string) error
}

type checkoutUseCase struct {
	tm                *database.TransactionManager
	catalogRepo       domain.CatalogRepository
	authRepo          domain.AuthorizationRepository
	txRepo            domain.TransactionRepository
	auditRepo         domain.AuditRepository
	gateway           domain.PaymentGateway
	policyEngine      domain.PolicyEngine
	integrityVerifier domain.IntegrityVerifier
	logger            *slog.Logger
}

func NewCheckoutUseCase(
	tm *database.TransactionManager,
	catalogRepo domain.CatalogRepository,
	authRepo domain.AuthorizationRepository,
	txRepo domain.TransactionRepository,
	auditRepo domain.AuditRepository,
	gateway domain.PaymentGateway,
	policyEngine domain.PolicyEngine,
	integrityVerifier domain.IntegrityVerifier,
	logger *slog.Logger,
) CheckoutUseCase {
	return &checkoutUseCase{
		tm:                tm,
		catalogRepo:       catalogRepo,
		authRepo:          authRepo,
		txRepo:            txRepo,
		auditRepo:         auditRepo,
		gateway:           gateway,
		policyEngine:      policyEngine,
		integrityVerifier: integrityVerifier,
		logger:            logger,
	}
}

// ProposeTransaction is Phase 1 of the Saga. It evaluates policy and reserves limits.
func (uc *checkoutUseCase) ProposeTransaction(ctx context.Context, agentID uuid.UUID, req CheckoutRequest) (*domain.Transaction, error) {
	// 1. Idempotency Check (Scope: "proposal")
	existingTx, err := uc.txRepo.CheckIdempotency(ctx, req.IdempotencyKey, "proposal")
	if err != nil {
		return nil, apperrors.NewInternal("failed to check idempotency", err)
	}
	if existingTx != nil {
		uc.logger.Info("returning idempotent proposal", "tx_id", existingTx.ID)
		return existingTx, nil // Safely return exact previous state
	}

	// 2. Fetch Ground Truth Product
	product, err := uc.catalogRepo.GetProduct(ctx, req.ProductID)
	if err != nil || product == nil {
		return nil, apperrors.NewNotFound("product not found", err)
	}

	// 3. Cryptographic Integrity Check (Anti-Tampering)
	isValid := uc.integrityVerifier.Verify(product.ID, product.SKU, product.PricePaise, product.Currency, req.CatalogHash)
	if !isValid {
		uc.auditRepo.RecordSecurityEvent(ctx, domain.SecurityEvent{
			AgentID:   &agentID,
			EventType: "catalog_tampering_detected",
			Severity:  "critical",
			Details: map[string]any{
				"expected_price": product.PricePaise,
				"provided_hash":  req.CatalogHash,
			},
		})
		return nil, apperrors.NewIntegrity("catalog integrity verification failed. Price or SKU was altered.", nil)
	}

	totalAmount := product.PricePaise * int64(req.Quantity)
	var createdTx *domain.Transaction
	
	// PHASE 1 SAGA BOUNDARY: Open Database Transaction
	err = uc.tm.WithTx(ctx, func(txCtx context.Context) error {
		// A. Fetch Auth Limits
		grant, err := uc.authRepo.GetActiveGrant(txCtx, agentID)
		if err != nil || grant == nil {
			return apperrors.NewUnauthorized("no active authorization grant found", err)
		}
		
		usage, err := uc.authRepo.GetUsage(txCtx, grant.ID)
		if err != nil {
			return apperrors.NewInternal("failed to fetch grant usage", err)
		}

		// B. Deterministic Policy Evaluation
		decision := uc.policyEngine.Evaluate(txCtx, totalAmount, grant, usage)
		
		newTx := &domain.Transaction{
			ID:               uuid.New(),
			MerchantID:       req.MerchantID,
			AgentID:          agentID,
			GrantID:          grant.ID,
			IdempotencyKey:   req.IdempotencyKey,
			Status:           domain.StatusCreated,
			TotalAmountPaise: totalAmount,
			Currency:         product.Currency,
			ProductID:        product.ID,
			Quantity:         req.Quantity,
		}

		// Record the exact reasoning for explainability
		uc.auditRepo.RecordPolicyDecision(txCtx, newTx.ID, decision)

		if decision.Decision == domain.DecisionDeny {
			newTx.Status = domain.StatusFailed
			reason := decision.Reasoning
			newTx.FailureReason = &reason
			uc.txRepo.Create(txCtx, newTx)
			uc.txRepo.RecordIdempotency(txCtx, req.IdempotencyKey, "proposal", newTx.ID)
			return apperrors.NewForbidden(fmt.Sprintf("policy denied: %s", decision.Reasoning), nil)
		}

		// C. Atomic Reservation
		err = uc.authRepo.ReserveUsage(txCtx, grant.ID, totalAmount)
		if err != nil {
			return apperrors.NewForbidden("insufficient limits to reserve amount concurrently", err)
		}

		newTx.Status = domain.StatusAuthorized
		err = uc.txRepo.Create(txCtx, newTx)
		if err != nil {
			return err
		}
		
		err = uc.txRepo.RecordIdempotency(txCtx, req.IdempotencyKey, "proposal", newTx.ID)
		if err != nil {
			return err
		}
		
		createdTx = newTx
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdTx, nil
}

// ExecutePayment is Phase 2 of the Saga. It calls the external Gateway.
func (uc *checkoutUseCase) ExecutePayment(ctx context.Context, txID uuid.UUID, idempotencyKey string) (*domain.Transaction, error) {
	// 1. Idempotency Check (Scope: "payment")
	existingTx, err := uc.txRepo.CheckIdempotency(ctx, idempotencyKey, "payment")
	if err != nil {
		return nil, apperrors.NewInternal("failed to check idempotency", err)
	}
	if existingTx != nil {
		uc.logger.Info("returning idempotent payment execution", "tx_id", existingTx.ID)
		return existingTx, nil
	}

	tx, err := uc.txRepo.Get(ctx, txID)
	if err != nil || tx == nil {
		return nil, apperrors.NewNotFound("transaction not found", err)
	}

	// 2. FSM Safety Check
	if !tx.CanTransitionTo(domain.StatusPaymentPending) {
		return nil, apperrors.NewConflict(fmt.Sprintf("cannot execute payment from state: %s", tx.Status), nil)
	}

	// Move state to payment_pending
	err = uc.txRepo.UpdateStatus(ctx, tx.ID, domain.StatusPaymentPending, "")
	if err != nil {
		return nil, apperrors.NewInternal("failed to update state", err)
	}
	uc.txRepo.RecordIdempotency(ctx, idempotencyKey, "payment", tx.ID)

	// 3. Network Call to Payment Gateway (OUTSIDE OF ANY DB TRANSACTION)
	order, err := uc.gateway.CreateOrder(ctx, tx.TotalAmountPaise, tx.Currency, tx.ID.String())
	
	if err != nil {
		// Network Failure: We mark payment failed, but wait for reconciliation/retries.
		// If it's a hard failure, we release the reserved limits.
		uc.logger.Error("payment gateway failed", "error", err)
		uc.txRepo.UpdateStatus(ctx, tx.ID, domain.StatusPaymentFailed, "gateway error")
		uc.authRepo.ReleaseUsage(ctx, tx.GrantID, tx.TotalAmountPaise)
		return nil, apperrors.NewInternal("payment failed", err)
	}

	// Success: Update the Gateway Order ID
	err = uc.txRepo.UpdateGatewayOrder(ctx, tx.ID, order.ID)
	if err != nil {
		return nil, apperrors.NewInternal("failed to save gateway order", err)
	}

	tx.GatewayOrderID = &order.ID
	tx.Status = domain.StatusPaymentPending
	return tx, nil
}

// HandleWebhook is Phase 3 of the Saga. It commits or releases limits asynchronously.
func (uc *checkoutUseCase) HandleWebhook(ctx context.Context, txID uuid.UUID, status string) error {
	tx, err := uc.txRepo.Get(ctx, txID)
	if err != nil || tx == nil {
		return err
	}
	
	if status == "captured" {
		if !tx.CanTransitionTo(domain.StatusCaptured) {
			return nil // Safely ignore duplicate webhooks (Idempotent)
		}
		
		// PHASE 3a: Commit Usage
		return uc.tm.WithTx(ctx, func(txCtx context.Context) error {
			uc.txRepo.UpdateStatus(txCtx, tx.ID, domain.StatusCaptured, "")
			return uc.authRepo.CommitUsage(txCtx, tx.GrantID, tx.TotalAmountPaise)
		})
		
	} else if status == "failed" {
		if !tx.CanTransitionTo(domain.StatusPaymentFailed) {
			return nil
		}
		
		// PHASE 3b: Release Usage
		return uc.tm.WithTx(ctx, func(txCtx context.Context) error {
			uc.txRepo.UpdateStatus(txCtx, tx.ID, domain.StatusPaymentFailed, "gateway webhook failed")
			return uc.authRepo.ReleaseUsage(txCtx, tx.GrantID, tx.TotalAmountPaise)
		})
	}
	
	return nil
}