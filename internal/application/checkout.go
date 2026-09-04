package application

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/apperrors"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
)

type CheckoutRequest struct {
    MerchantID     uuid.UUID `json:"merchant_id"`
    ProductID      uuid.UUID `json:"product_id"`
    Quantity       int       `json:"quantity"`
    ExpectedPrice  int64     `json:"expected_price"`
    Currency       string    `json:"currency"`
    CatalogHash    string    `json:"catalog_hash"`
    IdempotencyKey string    `json:"idempotency_key"`
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
// ProposeTransaction is Phase 1 of the Saga. It evaluates policy and reserves limits.
func (uc *checkoutUseCase) ProposeTransaction(
	ctx context.Context,
	agentID uuid.UUID,
	req CheckoutRequest,
) (*domain.Transaction, error) {

	// 1. Idempotency Check (Scope: "proposal")
	existingTx, err := uc.txRepo.CheckIdempotency(
		ctx,
		req.IdempotencyKey,
		"proposal",
	)
	if err != nil {
		return nil, apperrors.NewInternal("failed to check idempotency", err)
	}

	if existingTx != nil {
		if auditErr := uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
			AgentID:   agentID,
			EventType: "idempotency_replay_prevented",
			Resource:  "/checkout/propose",
			Metadata: map[string]any{
				"tx_id": existingTx.ID,
				"decision": "DENY",
			},
		}); auditErr != nil {
			uc.logger.Error("failed to record replay audit event", "error", auditErr)
		}
		uc.logger.Info(
			"returning idempotent proposal",
			"tx_id",
			existingTx.ID,
		)
		return existingTx, nil
	}

	// 2. Fetch Ground Truth Product
	product, err := uc.catalogRepo.GetProduct(ctx, req.ProductID)
	if err != nil || product == nil {
		return nil, apperrors.NewNotFound("product not found", err)
	}

	// 3. Cryptographic Integrity Check
	isValid := uc.integrityVerifier.Verify(
		product.ID,
		product.SKU,
		product.PricePaise,
		product.Currency,
		req.CatalogHash,
	)

	if !isValid {
		if auditErr := uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
			AgentID:   agentID,
			EventType: "catalog_tampering_detected",
			Resource:  "/checkout/propose",
			Metadata: map[string]any{
				"expected_price": product.PricePaise,
				"provided_hash":  req.CatalogHash,
				"decision":       "DENY",
			},
		}); auditErr != nil {
			uc.logger.Error("failed to record catalog tampering audit event", "error", auditErr)
		}

		return nil, apperrors.NewIntegrity(
			"catalog integrity verification failed. Price or SKU was altered.",
			nil,
		)
	}

	totalAmount := product.PricePaise * int64(req.Quantity)

	var createdTx *domain.Transaction
	var policyErr error

	// PHASE 1 SAGA BOUNDARY
	err = uc.tm.WithTx(ctx, func(txCtx context.Context) error {

		// ---------------------------------------------------------
		// A. Fetch Authorization Grant
		// ---------------------------------------------------------

		grant, err := uc.authRepo.GetActiveGrant(txCtx, agentID)
		if err != nil || grant == nil {
			eventType := "unauthorized_agent_blocked"
			reason := "no active authorization grant found"
			if err != nil && err.Error() == "grant expired" {
				eventType = "policy_grant_expired_denied"
				reason = "grant expired or revoked"
			}
			
			// Use the parent 'ctx' instead of 'txCtx' so this audit event
			// is committed immediately and not rolled back by the error return.
			if auditErr := uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
				AgentID:   agentID,
				EventType: eventType,
				Resource:  "/checkout/propose",
				Metadata: map[string]any{
					"reason":   reason,
					"decision": "DENY",
				},
			}); auditErr != nil {
				uc.logger.Error("failed to record blocked agent audit event", "error", auditErr)
			}
			return apperrors.NewUnauthorized(
				reason,
				err,
			)
		}

		usage, err := uc.authRepo.GetUsage(txCtx, grant.ID)
		if err != nil {
			return apperrors.NewInternal(
				"failed to fetch grant usage",
				err,
			)
		}

		// ---------------------------------------------------------
		// B. Deterministic Policy Evaluation
		// ---------------------------------------------------------

		decision := uc.policyEngine.Evaluate(
			txCtx,
			totalAmount,
			grant,
			usage,
		)

		// Create transaction FIRST so policy_decisions can safely
		// reference its ID.
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
			Metadata: map[string]any{
				"historical_grant_limit":    grant.MaxAmountPaise,
				"historical_grant_consumed": usage.AmountConsumed,
				"historical_grant_reserved": usage.AmountReserved,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// ---------------------------------------------------------
		// C. POLICY DENIED
		// ---------------------------------------------------------

		if decision.Decision == domain.DecisionDeny {

			newTx.Status = domain.StatusFailed

			reason := decision.Reasoning
			newTx.FailureReason = &reason

			// 1. Persist the failed transaction.
			if err := uc.txRepo.Create(txCtx, newTx); err != nil {
				return apperrors.NewInternal(
					"failed to record denied transaction",
					err,
				)
			}

			// 2. Persist the policy decision.
			if err := uc.auditRepo.RecordPolicyDecision(
				txCtx,
				newTx.ID,
				decision,
			); err != nil {
				return apperrors.NewInternal(
					"failed to record policy denial",
					err,
				)
			}

			// 3. Persist idempotency so the same request cannot
			// repeatedly create new denied transactions.
			if err := uc.txRepo.RecordIdempotency(
				txCtx,
				req.IdempotencyKey,
				"proposal",
				newTx.ID,
			); err != nil {
				return apperrors.NewInternal(
					"failed to record denied transaction idempotency",
					err,
				)
			}

			// IMPORTANT:
			// Record an audit_events entry as well.
			// Your dashboard Audit Trail reads audit_events,
			// while the KPI reads policy_decisions.
			if err := uc.auditRepo.RecordEvent(
				txCtx,
				domain.AuditEvent{
					AgentID:   agentID,
					EventType: "policy_evaluation_denied",
					Resource:  "/checkout/propose",
					Metadata: map[string]any{
						"transaction_id": newTx.ID.String(),
						"product_id":     req.ProductID.String(),
						"amount_paise":   totalAmount,
						"decision":       "DENY",
						"reason":         decision.Reasoning,
						"spending_check": decision.SpendingCheck,
						"time_check":     decision.TimeCheck,
						"active_check":   decision.ActiveCheck,
						"status":         string(domain.StatusFailed),
					},
				},
			); err != nil {
				return apperrors.NewInternal(
					"failed to record policy denial audit event",
					err,
				)
			}

			// Make the failed transaction available to the caller
			// even though the request itself returns 403.
			createdTx = newTx

			policyErr = apperrors.NewForbidden(
				fmt.Sprintf(
					"policy denied: %s",
					decision.Reasoning,
				),
				nil,
			)
			return nil
		}

		// ---------------------------------------------------------
		// D. ATOMIC RESERVATION (MOVED TO EXECUTE PHASE)
		// ---------------------------------------------------------
		// Per user requirements, AUTHORIZED state no longer reserves funds.
		// Funds are reserved during ExecutePayment (transition to payment_pending).

		// ---------------------------------------------------------
		// E. AUTHORIZED
		// ---------------------------------------------------------

		newTx.Status = domain.StatusAuthorized

		if err := uc.txRepo.Create(txCtx, newTx); err != nil {
			return err
		}

		if err := uc.txRepo.RecordIdempotency(
			txCtx,
			req.IdempotencyKey,
			"proposal",
			newTx.ID,
		); err != nil {
			return err
		}

		if err := uc.auditRepo.RecordPolicyDecision(
			txCtx,
			newTx.ID,
			decision,
		); err != nil {
			return err
		}

		createdTx = newTx

		return nil
	})

	if err != nil {
		return nil, err
	}
	if policyErr != nil {
		return createdTx, policyErr
	}

	// ---------------------------------------------------------
	// AUDIT: Successful proposal
	// ---------------------------------------------------------

	if createdTx != nil {
		if err := uc.auditRepo.RecordEvent(
			ctx,
			domain.AuditEvent{
				AgentID:   agentID,
				EventType: "purchase_proposed",
				Resource:  "/checkout/propose",
				Metadata: map[string]any{
					"transaction_id": createdTx.ID.String(),
					"product_id":     req.ProductID.String(),
					"amount_paise":   createdTx.TotalAmountPaise,
					"quantity":       req.Quantity,
					"status":         string(createdTx.Status),
				},
			},
		); err != nil {
			uc.logger.Error(
				"failed to record successful proposal audit",
				"error",
				err,
			)
		}
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

	// 2.5 ATOMIC RESERVATION
	// Reserve usage here before entering payment_pending
	if err := uc.authRepo.ReserveUsage(ctx, tx.GrantID, tx.TotalAmountPaise); err != nil {
		uc.txRepo.UpdateStatus(ctx, tx.ID, domain.StatusFailed, "insufficient grant limit to reserve during execution")
		return nil, apperrors.NewForbidden("insufficient grant limit to reserve requested amount during execution", err)
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

		// AUDIT: Record gateway failure
		uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
			AgentID:   tx.AgentID,
			EventType: "payment_gateway_failed",
			Resource:  "/checkout/execute",
			Metadata: map[string]any{
				"transaction_id": tx.ID.String(),
				"amount_paise":   tx.TotalAmountPaise,
				"error":           err.Error(),
			},
		})

		return nil, apperrors.NewInternal("payment failed", err)
	}

	// Success: Update the Gateway Order ID
	err = uc.txRepo.UpdateGatewayOrder(ctx, tx.ID, order.ID)
	if err != nil {
		return nil, apperrors.NewInternal("failed to save gateway order", err)
	}

	tx.GatewayOrderID = &order.ID
	tx.Status = domain.StatusPaymentPending

	// AUDIT: Record successful payment execution
	uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
		AgentID:   tx.AgentID,
		EventType: "payment_executed",
		Resource:  "/checkout/execute",
		Metadata: map[string]any{
			"transaction_id":   tx.ID.String(),
			"gateway_order_id": order.ID,
			"amount_paise":     tx.TotalAmountPaise,
			"status":            "payment_pending",
		},
	})

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
		err := uc.tm.WithTx(ctx, func(txCtx context.Context) error {
			uc.txRepo.UpdateStatus(txCtx, tx.ID, domain.StatusCaptured, "")
			return uc.authRepo.CommitUsage(txCtx, tx.GrantID, tx.TotalAmountPaise)
		})
		if err == nil {
			// AUDIT: Record successful capture
			uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
				AgentID:   tx.AgentID,
				EventType: "payment_captured",
				Resource:  "/webhook",
				Metadata: map[string]any{
					"transaction_id": tx.ID.String(),
					"amount_paise":   tx.TotalAmountPaise,
				},
			})
		}
		return err
		
	} else if status == "failed" {
		if !tx.CanTransitionTo(domain.StatusPaymentFailed) {
			return nil
		}
		
		// PHASE 3b: Release Usage
		err := uc.tm.WithTx(ctx, func(txCtx context.Context) error {
			uc.txRepo.UpdateStatus(txCtx, tx.ID, domain.StatusPaymentFailed, "gateway webhook failed")
			return uc.authRepo.ReleaseUsage(txCtx, tx.GrantID, tx.TotalAmountPaise)
		})
		if err == nil {
			// AUDIT: Record payment failure + fund release
			uc.auditRepo.RecordEvent(ctx, domain.AuditEvent{
				AgentID:   tx.AgentID,
				EventType: "payment_failed_funds_released",
				Resource:  "/webhook",
				Metadata: map[string]any{
					"transaction_id":   tx.ID.String(),
					"amount_released":  tx.TotalAmountPaise,
				},
			})
		}
		return err
	}
	
	return nil
}