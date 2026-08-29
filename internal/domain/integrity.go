package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"
)

type IntegrityVerifier interface {
	GenerateHash(productID uuid.UUID, sku string, pricePaise int64, currency string) string
	Verify(productID uuid.UUID, sku string, actualPrice int64, currency string, providedHash string) bool
}

// DefaultIntegrityVerifier implements cryptographic catalog verification.
type DefaultIntegrityVerifier struct{}

func NewIntegrityVerifier() *DefaultIntegrityVerifier {
	return &DefaultIntegrityVerifier{}
}

func (v *DefaultIntegrityVerifier) GenerateHash(productID uuid.UUID, sku string, pricePaise int64, currency string) string {
	// Canonical string format for hashing.
	// We bind ID, SKU, and Price together so none can be altered in isolation.
	data := fmt.Sprintf("%s|%s|%d|%s", productID.String(), sku, pricePaise, currency)
	
	hasher := sha256.New()
	hasher.Write([]byte(data))
	return hex.EncodeToString(hasher.Sum(nil))
}

func (v *DefaultIntegrityVerifier) Verify(productID uuid.UUID, sku string, actualPrice int64, currency string, providedHash string) bool {
	// We recalculate the hash based on the GROUND TRUTH (actualPrice from DB),
	// and compare it to the hash the agent provided.
	expectedHash := v.GenerateHash(productID, sku, actualPrice, currency)
	return expectedHash == providedHash
}