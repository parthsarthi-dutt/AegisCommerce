package postgres

import (
	"context"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
)

type MerchantRepository struct {
	tm *database.TransactionManager
}

func NewMerchantRepository(tm *database.TransactionManager) *MerchantRepository {
	return &MerchantRepository{tm: tm}
}

func (r *MerchantRepository) GetMerchant(ctx context.Context, id uuid.UUID) (*domain.Merchant, error) {
	db := r.tm.GetDB(ctx)
	
	query := `
		SELECT id, name, description, api_key_id, status, contact_email, created_at, updated_at
		FROM merchants
		WHERE id = $1
	`
	var m domain.Merchant
	err := db.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.Name, &m.Description, &m.APIKeyID, &m.Status, &m.ContactEmail, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MerchantRepository) GetCapabilities(ctx context.Context, merchantID uuid.UUID) ([]domain.Capability, error) {
	// MVP Decision: We return static platform capabilities.
	// In V2, these would be stored in a `merchant_capabilities` table or JSONB column.
	return []domain.Capability{
		{
			Type: "payment",
			Key:  "supported_methods",
			Value: map[string]any{"methods": []string{"agent_wallet", "upi"}},
		},
	}, nil
}

func (r *MerchantRepository) GetPolicies(ctx context.Context, merchantID uuid.UUID) ([]domain.Policy, error) {
	// MVP Decision: Static informational policies.
	// Note: The actual financial/spending limits are strictly evaluated via 
	// AuthorizationGrants in the PolicyEngine. These are just text rules for the LLM to read.
	return []domain.Policy{
		{
			Type:    "return",
			Title:   "Standard 7-Day Return",
			Content: map[string]any{"days": 7, "condition": "unopened"},
			Version: 1,
		},
	}, nil
}