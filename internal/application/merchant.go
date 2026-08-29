package application

import (
	"context"
	"log/slog"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/apperrors"
	"github.com/google/uuid"
)

type MerchantUseCase interface {
	GetCapabilities(ctx context.Context, merchantID uuid.UUID) ([]domain.Capability, error)
	GetPolicies(ctx context.Context, merchantID uuid.UUID) ([]domain.Policy, error)
}

type merchantUseCase struct {
	repo   domain.MerchantRepository
	logger *slog.Logger
}

func NewMerchantUseCase(repo domain.MerchantRepository, logger *slog.Logger) MerchantUseCase {
	return &merchantUseCase{
		repo:   repo,
		logger: logger,
	}
}

func (uc *merchantUseCase) GetCapabilities(ctx context.Context, merchantID uuid.UUID) ([]domain.Capability, error) {
	uc.logger.Debug("getting merchant capabilities", "merchant_id", merchantID)
	
	caps, err := uc.repo.GetCapabilities(ctx, merchantID)
	if err != nil {
		uc.logger.Error("failed to get capabilities", "error", err)
		return nil, apperrors.NewInternal("failed to retrieve merchant capabilities", err)
	}
	
	return caps, nil
}

func (uc *merchantUseCase) GetPolicies(ctx context.Context, merchantID uuid.UUID) ([]domain.Policy, error) {
	uc.logger.Debug("getting merchant policies", "merchant_id", merchantID)
	
	policies, err := uc.repo.GetPolicies(ctx, merchantID)
	if err != nil {
		uc.logger.Error("failed to get policies", "error", err)
		return nil, apperrors.NewInternal("failed to retrieve merchant policies", err)
	}
	
	return policies, nil
}