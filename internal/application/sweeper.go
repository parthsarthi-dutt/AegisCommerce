package application

import (
	"context"
	"log/slog"
	"time"

	"agentic-commerce/internal/domain"
)

// Sweeper is a background worker that cleans up stale transactions.
// It finds payment_pending transactions older than a threshold and releases
// their reserved authorization funds back to the agent's grant.
//
// WHY THIS EXISTS:
// If a user abandons the Razorpay checkout or the process crashes between
// Phase 2 (gateway call) and Phase 3 (webhook), funds remain permanently
// locked in amount_reserved. The sweeper is the reconciliation mechanism
// that prevents financial leaks.
type Sweeper struct {
	txRepo   domain.TransactionRepository
	authRepo domain.AuthorizationRepository
	auditRepo domain.AuditRepository
	logger   *slog.Logger
	interval time.Duration
	staleAge time.Duration
}

// NewSweeper creates a background sweeper.
// interval: how often to check (e.g., 5 minutes)
// staleAge: how old a payment_pending tx must be to be considered stale (e.g., 30 minutes)
func NewSweeper(
	txRepo domain.TransactionRepository,
	authRepo domain.AuthorizationRepository,
	auditRepo domain.AuditRepository,
	logger *slog.Logger,
	interval time.Duration,
	staleAge time.Duration,
) *Sweeper {
	return &Sweeper{
		txRepo:   txRepo,
		authRepo: authRepo,
		auditRepo: auditRepo,
		logger:   logger,
		interval: interval,
		staleAge: staleAge,
	}
}

// Run starts the sweeper loop. It blocks until ctx is cancelled.
// Call this in a goroutine: go sweeper.Run(ctx)
func (s *Sweeper) Run(ctx context.Context) {
	s.logger.Info("Stale transaction sweeper started",
		"interval", s.interval.String(),
		"stale_age", s.staleAge.String(),
	)

	// Run once immediately on startup
	s.sweep(ctx)

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.sweep(ctx)
		case <-ctx.Done():
			s.logger.Info("Stale transaction sweeper shutting down")
			return
		}
	}
}

// sweep performs one pass of stale transaction cleanup.
func (s *Sweeper) sweep(ctx context.Context) {
	// 1. Sweep Payment Pending
	staleTxs, err := s.txRepo.FindStaleTransactions(ctx, domain.StatusPaymentPending, s.staleAge)
	if err != nil {
		s.logger.Error("Sweeper failed to query stale pending transactions", "error", err)
	} else {
		for _, tx := range staleTxs {
			// Release the reserved authorization funds
			if err := s.authRepo.ReleaseUsage(ctx, tx.GrantID, tx.TotalAmountPaise); err != nil {
				s.logger.Error("Sweeper failed to release usage",
					"tx_id", tx.ID,
					"grant_id", tx.GrantID,
					"amount", tx.TotalAmountPaise,
					"error", err,
				)
				continue
			}
			s.expireTx(ctx, &tx)
		}
	}

	// 2. Sweep Authorized (No funds reserved, just expire them)
	staleAuthTxs, err := s.txRepo.FindStaleTransactions(ctx, domain.StatusAuthorized, s.staleAge)
	if err != nil {
		s.logger.Error("Sweeper failed to query stale authorized transactions", "error", err)
	} else {
		for _, tx := range staleAuthTxs {
			s.expireTx(ctx, &tx)
		}
	}
}

func (s *Sweeper) expireTx(ctx context.Context, tx *domain.Transaction) {

		// Mark the transaction as expired
		if err := s.txRepo.UpdateStatus(ctx, tx.ID, domain.StatusExpired, "stale transaction swept - checkout abandoned"); err != nil {
			s.logger.Error("Sweeper failed to expire transaction",
				"tx_id", tx.ID,
				"error", err,
			)
			return
		}

		// Record audit event for the cleanup
		_ = s.auditRepo.RecordEvent(ctx, domain.AuditEvent{
			AgentID:   tx.AgentID,
			EventType: "transaction_swept",
			Resource:  "/sweeper",
			Metadata: map[string]any{
				"transaction_id": tx.ID.String(),
				"amount_paise":   tx.TotalAmountPaise,
				"reason":         "status exceeded stale threshold",
				"stale_age":      s.staleAge.String(),
			},
		})

		s.logger.Info("Sweeper cleaned up stale transaction",
			"tx_id", tx.ID,
			"amount", tx.TotalAmountPaise,
		)
}
