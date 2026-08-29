package postgres

import (
	"context"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
)

type AuditRepository struct {
	tm *database.TransactionManager
}

func NewAuditRepository(tm *database.TransactionManager) *AuditRepository {
	return &AuditRepository{tm: tm}
}

func (r *AuditRepository) RecordEvent(ctx context.Context, event domain.AuditEvent) error {
	db := r.tm.GetDB(ctx)
	
	query := `
		INSERT INTO audit_events (agent_id, event_type, resource, metadata)
		VALUES ($1, $2, $3, $4)
	`
	_, err := db.Exec(ctx, query, event.AgentID, event.EventType, event.Resource, event.Metadata)
	return err
}

func (r *AuditRepository) RecordSecurityEvent(ctx context.Context, event domain.SecurityEvent) error {
	db := r.tm.GetDB(ctx)
	
	query := `
		INSERT INTO security_events (agent_id, event_type, severity, ip_address, details)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := db.Exec(ctx, query, event.AgentID, event.EventType, event.Severity, event.IPAddress, event.Details)
	return err
}

func (r *AuditRepository) RecordPolicyDecision(ctx context.Context, txID uuid.UUID, decision domain.PolicyDecisionRecord) error {
	db := r.tm.GetDB(ctx)
	
	query := `
		INSERT INTO policy_decisions (transaction_id, decision, amount_paise, reasoning, spending_check, time_check, active_check)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := db.Exec(ctx, query, txID, decision.Decision, decision.AmountPaise, decision.Reasoning, 
		decision.SpendingCheck, decision.TimeCheck, decision.ActiveCheck)
	return err
}