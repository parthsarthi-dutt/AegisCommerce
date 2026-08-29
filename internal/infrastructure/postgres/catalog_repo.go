package postgres

import (
	"context"

	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/database"
	"github.com/google/uuid"
)

type CatalogRepository struct {
	tm *database.TransactionManager
}

func NewCatalogRepository(tm *database.TransactionManager) *CatalogRepository {
	return &CatalogRepository{tm: tm}
}

func (r *CatalogRepository) GetProduct(ctx context.Context, productID uuid.UUID) (*domain.ProductDetail, error) {
	db := r.tm.GetDB(ctx) // Automatically uses Tx if present, otherwise uses Pool
	
	// We JOIN the fast-moving inventory table with the static product table.
	query := `
		SELECT p.id, p.merchant_id, p.sku, p.name, p.description, p.category, 
		       p.price_paise, p.currency, p.image_url, p.content_hash, p.is_active, 
		       p.created_at, p.updated_at,
		       pi.quantity, pi.reserved_quantity
		FROM products p
		JOIN product_inventory pi ON p.id = pi.product_id
		WHERE p.id = $1 AND p.is_active = true
	`
	
	var pd domain.ProductDetail
	err := db.QueryRow(ctx, query, productID).Scan(
		&pd.ID, &pd.MerchantID, &pd.SKU, &pd.Name, &pd.Description, &pd.Category,
		&pd.PricePaise, &pd.Currency, &pd.ImageURL, &pd.ContentHash, &pd.IsActive,
		&pd.CreatedAt, &pd.UpdatedAt,
		&pd.Quantity, &pd.ReservedQuantity,
	)
	
	if err != nil {
		// Note: We return raw pgx errors here. The Application layer use-cases 
		// will map pgx.ErrNoRows to apperrors.NewNotFound().
		return nil, err
	}
	
	return &pd, nil
}

func (r *CatalogRepository) SearchProducts(ctx context.Context, filter domain.SearchFilter) ([]domain.ProductDetail, error) {
	db := r.tm.GetDB(ctx)
	
	// We use standard ILIKE and parameter binding to prevent SQL injection.
	query := `
		SELECT p.id, p.merchant_id, p.sku, p.name, p.description, p.category, 
		       p.price_paise, p.currency, p.image_url, p.content_hash, p.is_active, 
		       p.created_at, p.updated_at,
		       pi.quantity, pi.reserved_quantity
		FROM products p
		JOIN product_inventory pi ON p.id = pi.product_id
		WHERE p.merchant_id = $1 AND p.is_active = true
		  AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR p.description ILIKE '%' || $2 || '%')
		  AND ($3 = '' OR p.category = $3)
		  AND ($4 = 0 OR p.price_paise <= $4)
		ORDER BY p.created_at DESC
		LIMIT $5 OFFSET $6
	`
	
	limit := filter.Limit
	if limit == 0 || limit > 50 {
		limit = 50 // Hard cap to prevent memory exhaustion (Rule 10.9)
	}
	
	rows, err := db.Query(ctx, query, 
		filter.MerchantID, 
		filter.Query, 
		filter.Category, 
		filter.MaxPrice, 
		limit, 
		filter.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var products []domain.ProductDetail
	for rows.Next() {
		var pd domain.ProductDetail
		err := rows.Scan(
			&pd.ID, &pd.MerchantID, &pd.SKU, &pd.Name, &pd.Description, &pd.Category,
			&pd.PricePaise, &pd.Currency, &pd.ImageURL, &pd.ContentHash, &pd.IsActive,
			&pd.CreatedAt, &pd.UpdatedAt,
			&pd.Quantity, &pd.ReservedQuantity,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, pd)
	}
	
	return products, nil
}