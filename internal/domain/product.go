package domain

import (
	"time"

	"github.com/google/uuid"
)

// Product represents a single sellable item in the catalog.
type Product struct {
	ID          uuid.UUID `json:"id"`
	MerchantID  uuid.UUID `json:"merchant_id"`
	SKU         string    `json:"sku"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Category    string    `json:"category"`
	PricePaise  int64     `json:"price_paise"` // Always stored in smallest currency unit (paise)
	Currency    string    `json:"currency"`
	ImageURL    string    `json:"image_url,omitempty"`
	ContentHash string    `json:"content_hash"` // Cryptographic hash for integrity verification
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProductDetail aggregates the product and its inventory.
// This is the model returned to Agents via MCP, as they need to see stock levels.
type ProductDetail struct {
	Product
	Quantity         int `json:"quantity"`
	ReservedQuantity int `json:"reserved_quantity"`
}

// SearchFilter defines how products can be queried by the MCP tool.
type SearchFilter struct {
	MerchantID uuid.UUID
	Query      string // Full-text search string
	Category   string
	MaxPrice   int64
	Limit      int
	Offset     int
}
