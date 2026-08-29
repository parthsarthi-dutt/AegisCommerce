package application

import (
	"context"
	"errors"
	"log/slog"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/apperrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type CatalogUseCase interface {
	SearchProducts(ctx context.Context, filter domain.SearchFilter) ([]domain.ProductDetail, error)
	GetProduct(ctx context.Context, productID uuid.UUID) (*domain.ProductDetail, error)
}

type catalogUseCase struct {
	repo   domain.CatalogRepository
	logger *slog.Logger
}

func NewCatalogUseCase(repo domain.CatalogRepository, logger *slog.Logger) CatalogUseCase {
	return &catalogUseCase{
		repo:   repo,
		logger: logger,
	}
}

func (uc *catalogUseCase) SearchProducts(ctx context.Context, filter domain.SearchFilter) ([]domain.ProductDetail, error) {
	uc.logger.Debug("searching products", "merchant_id", filter.MerchantID, "query", filter.Query)
	
	products, err := uc.repo.SearchProducts(ctx, filter)
	if err != nil {
		uc.logger.Error("failed to search products", "error", err)
		return nil, apperrors.NewInternal("failed to retrieve product catalog", err)
	}
	
	// Normalize nil slices to empty slices for cleaner JSON serialization
	if products == nil {
		return []domain.ProductDetail{}, nil
	}
	
	return products, nil
}

func (uc *catalogUseCase) GetProduct(ctx context.Context, productID uuid.UUID) (*domain.ProductDetail, error) {
	uc.logger.Debug("getting product", "product_id", productID)
	
	product, err := uc.repo.GetProduct(ctx, productID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Translates infrastructure error into domain error
			return nil, apperrors.NewNotFound("product not found or is inactive", err)
		}
		uc.logger.Error("failed to get product", "error", err, "product_id", productID)
		return nil, apperrors.NewInternal("failed to retrieve product", err)
	}
	
	return product, nil
}