package domain

import (
	"context"
	"time"
)

type PolicyDecisionType string

const (
	DecisionAllow PolicyDecisionType = "allow"
	DecisionDeny  PolicyDecisionType = "deny"
)

// PolicyDecisionRecord tracks exactly why a decision was made.
// This is critical for the "explainability" requirement of the competition.
type PolicyDecisionRecord struct {
	Decision      PolicyDecisionType `json:"decision"`
	AmountPaise   int64              `json:"amount_paise"`
	Reasoning     string             `json:"reasoning"`
	SpendingCheck bool               `json:"spending_check"`
	TimeCheck     bool               `json:"time_check"`
	ActiveCheck   bool               `json:"active_check"`
}

type PolicyEngine interface {
	Evaluate(ctx context.Context, amountPaise int64, grant *Grant, usage *GrantUsage) PolicyDecisionRecord
}

// DefaultPolicyEngine is the deterministic implementation of the PolicyEngine.
type DefaultPolicyEngine struct{}

func NewPolicyEngine() *DefaultPolicyEngine {
	return &DefaultPolicyEngine{}
}

func (e *DefaultPolicyEngine) Evaluate(ctx context.Context, amountPaise int64, grant *Grant, usage *GrantUsage) PolicyDecisionRecord {
	// 1. Check Grant Status
	if grant.Status != GrantStatusActive {
		return PolicyDecisionRecord{
			Decision:    DecisionDeny,
			AmountPaise: amountPaise,
			Reasoning:   "grant is not active",
			ActiveCheck: false,
		}
	}

	// 2. Check Expiry
	if time.Now().After(grant.ExpiresAt) {
		return PolicyDecisionRecord{
			Decision:    DecisionDeny,
			AmountPaise: amountPaise,
			Reasoning:   "grant has expired",
			ActiveCheck: true,
			TimeCheck:   false,
		}
	}

	// 3. Check Spending Limits (Crucial for the Reservation Saga)
	// Consumed + Currently Reserved by inflight transactions + New Amount <= Max Limit
	totalCommitted := usage.AmountConsumed + usage.AmountReserved
	if totalCommitted+amountPaise > grant.MaxAmountPaise {
		return PolicyDecisionRecord{
			Decision:      DecisionDeny,
			AmountPaise:   amountPaise,
			Reasoning:     "insufficient remaining authorization limit",
			ActiveCheck:   true,
			TimeCheck:     true,
			SpendingCheck: false,
		}
	}

	// All checks pass
	return PolicyDecisionRecord{
		Decision:      DecisionAllow,
		AmountPaise:   amountPaise,
		Reasoning:     "all policy checks passed",
		ActiveCheck:   true,
		TimeCheck:     true,
		SpendingCheck: true,
	}
}