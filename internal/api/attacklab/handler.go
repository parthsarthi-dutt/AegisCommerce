package attacklab

import (
	"context"
	"fmt"
	"net/http"

	"agentic-commerce/internal/application"
	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/apperrors"
	"agentic-commerce/pkg/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	checkoutUC application.CheckoutUseCase
	authRepo   domain.AuthorizationRepository
	catalogRepo domain.CatalogRepository
	tm         *database.TransactionManager
}

func NewHandler(
	checkoutUC application.CheckoutUseCase,
	authRepo domain.AuthorizationRepository,
	catalogRepo domain.CatalogRepository,
	tm *database.TransactionManager,
) *Handler {
	return &Handler{
		checkoutUC:  checkoutUC,
		authRepo:    authRepo,
		catalogRepo: catalogRepo,
		tm:          tm,
	}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api/attacklab")
	api.POST("/run", h.RunAttack)
}

type AttackRequest struct {
	AttackID string `json:"attack_id"`
}

type AttackResponse struct {
	Success        bool   `json:"success"` // true if the system CORRECTLY defended against the attack
	ExpectedResult string `json:"expected_result"`
	ActualResult   string `json:"actual_result"`
	Details        any    `json:"details,omitempty"`
}

func (h *Handler) RunAttack(c *gin.Context) {
	var req AttackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// For the MVP, we assume a pre-seeded demo agent and product exist.
	// In a real hackathon demo, you'd fetch these dynamically, but we'll use a hardcoded helper 
	// or fetch the first available for the sake of the demonstration.
	agentID, merchantID, product, err := h.getDemoData(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "demo data not found", "details": err.Error()})
		return
	}

	var res AttackResponse

	switch req.AttackID {
	case "unauthorized_agent":
		res = h.attackUnauthorizedAgent(c.Request.Context(), merchantID, product)
	case "catalog_poisoning":
		res = h.attackCatalogPoisoning(c.Request.Context(), agentID, merchantID, product)
	case "over_limit":
		res = h.attackOverLimit(c.Request.Context(), agentID, merchantID, product)
	case "replay_attack":
		res = h.attackReplay(c.Request.Context(), agentID, merchantID, product)
	case "expired_grant":
		res = h.attackExpiredGrant(c.Request.Context(), agentID, merchantID, product)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown attack_id"})
		return
	}

	c.JSON(http.StatusOK, res)
}

// getDemoData fetches the first available agent, merchant, and product to use in the attacks.
func (h *Handler) getDemoData(ctx context.Context) (uuid.UUID, uuid.UUID, *domain.ProductDetail, error) {
	// A real implementation would query the DB. For this handler, we will simulate grabbing the first items.
	// Since we don't have GetFirstAgent in the repo, we can execute a raw SQL query via the TransactionManager
	db := h.tm.GetDB(ctx)
	
	var agentID uuid.UUID
	err := db.QueryRow(ctx, "SELECT id FROM agents LIMIT 1").Scan(&agentID)
	if err != nil {
		return uuid.Nil, uuid.Nil, nil, fmt.Errorf("no agents found: %w", err)
	}

	var merchantID uuid.UUID
	err = db.QueryRow(ctx, "SELECT id FROM merchants LIMIT 1").Scan(&merchantID)
	if err != nil {
		return uuid.Nil, uuid.Nil, nil, fmt.Errorf("no merchants found: %w", err)
	}

	var productID uuid.UUID
	err = db.QueryRow(ctx, "SELECT id FROM products WHERE merchant_id = $1 LIMIT 1", merchantID).Scan(&productID)
	if err != nil {
		return uuid.Nil, uuid.Nil, nil, fmt.Errorf("no products found: %w", err)
	}

	product, err := h.catalogRepo.GetProduct(ctx, productID)
	if err != nil {
		return uuid.Nil, uuid.Nil, nil, fmt.Errorf("failed to fetch product: %w", err)
	}

	return agentID, merchantID, product, nil
}

// 1. Unauthorized Agent
func (h *Handler) attackUnauthorizedAgent(ctx context.Context, merchantID uuid.UUID, product *domain.ProductDetail) AttackResponse {
	fakeAgentID := uuid.New() // Generate a random, unknown agent ID
	
	// Create the agent in the DB so that the audit_events foreign key constraint passes
	db := h.tm.GetDB(ctx)
	_, err := db.Exec(ctx, "INSERT INTO agents (id, name, description, hmac_key_id, hmac_secret_hash, agent_type) VALUES ($1, 'Rogue Agent', 'Test rogue agent', $2, 'hash', 'autonomous')", fakeAgentID, uuid.New().String())
	if err != nil {
		fmt.Printf("Error inserting rogue agent: %v\n", err)
	}

	req := application.CheckoutRequest{
		MerchantID:     merchantID,
		ProductID:      product.ID,
		Quantity:       1,
		ExpectedPrice:  product.PricePaise,
		Currency:       product.Currency,
		CatalogHash:    product.ContentHash,
		IdempotencyKey: uuid.New().String(),
	}

	_, err = h.checkoutUC.ProposeTransaction(ctx, fakeAgentID, req)
	
	actualResult := "success (FAIL)"
	success := false
	if err != nil {
		actualResult = err.Error()
		success = apperrors.IsUnauthorized(err)
	}

	return AttackResponse{
		Success:        success,
		ExpectedResult: "DENIED - no active authorization grant found",
		ActualResult:   actualResult,
	}
}

// 2. Catalog Poisoning (Hallucinated Price)
func (h *Handler) attackCatalogPoisoning(ctx context.Context, agentID, merchantID uuid.UUID, product *domain.ProductDetail) AttackResponse {
	// LLM hallucinates a lower price and alters the hash
	tamperedHash := "fake_hash_123"
	
	req := application.CheckoutRequest{
		MerchantID:     merchantID,
		ProductID:      product.ID,
		Quantity:       1,
		ExpectedPrice:  100, // Tried to sneak in a 1 Rupee price!
		Currency:       product.Currency,
		CatalogHash:    tamperedHash,
		IdempotencyKey: uuid.New().String(),
	}

	_, err := h.checkoutUC.ProposeTransaction(ctx, agentID, req)
	
	actualResult := "success (FAIL)"
	success := false
	if err != nil {
		actualResult = err.Error()
		success = apperrors.IsIntegrity(err)
	}

	return AttackResponse{
		Success:        success,
		ExpectedResult: "DENIED - catalog integrity verification failed. Price or SKU was altered.",
		ActualResult:   actualResult,
	}
}

// 3. Over-Limit Spending
func (h *Handler) attackOverLimit(ctx context.Context, agentID, merchantID uuid.UUID, product *domain.ProductDetail) AttackResponse {
	// Attempt to buy 10,000 units, which will definitely exceed the grant
	req := application.CheckoutRequest{
		MerchantID:     merchantID,
		ProductID:      product.ID,
		Quantity:       10000, 
		ExpectedPrice:  product.PricePaise,
		Currency:       product.Currency,
		CatalogHash:    product.ContentHash,
		IdempotencyKey: uuid.New().String(),
	}

	_, err := h.checkoutUC.ProposeTransaction(ctx, agentID, req)
	
	actualResult := "success (FAIL)"
	success := false
	if err != nil {
		actualResult = err.Error()
		success = apperrors.IsForbidden(err)
	}

	return AttackResponse{
		Success:        success,
		ExpectedResult: "DENIED - policy denied: insufficient remaining authorization limit",
		ActualResult:   actualResult,
	}
}

// 4. Replay Attack
func (h *Handler) attackReplay(ctx context.Context, agentID, merchantID uuid.UUID, product *domain.ProductDetail) AttackResponse {
	idemKey := uuid.New().String()
	
	req := application.CheckoutRequest{
		MerchantID:     merchantID,
		ProductID:      product.ID,
		Quantity:       1, 
		ExpectedPrice:  product.PricePaise,
		Currency:       product.Currency,
		CatalogHash:    product.ContentHash,
		IdempotencyKey: idemKey,
	}

	// First request - should succeed if agent has funds
	tx1, err1 := h.checkoutUC.ProposeTransaction(ctx, agentID, req)
	if err1 != nil {
		return AttackResponse{Success: false, ActualResult: "Setup failed: " + err1.Error()}
	}

	// Second request with SAME idempotency key
	tx2, err2 := h.checkoutUC.ProposeTransaction(ctx, agentID, req)
	
	success := err2 == nil && tx1.ID == tx2.ID

	return AttackResponse{
		Success:        success,
		ExpectedResult: "SUCCESS - returned exact same transaction ID from cache, no duplicate funds reserved",
		ActualResult:   fmt.Sprintf("tx1=%s, tx2=%s, err2=%v", tx1.ID, tx2.ID, err2),
	}
}

// 5. Expired Grant
func (h *Handler) attackExpiredGrant(ctx context.Context, agentID, merchantID uuid.UUID, product *domain.ProductDetail) AttackResponse {
	// We'll manually hack the database to expire the grant for a moment, try to buy, then restore it.
	db := h.tm.GetDB(ctx)
	_, _ = db.Exec(ctx, "UPDATE authorization_grants SET expires_at = NOW() - INTERVAL '1 day' WHERE agent_id = $1", agentID)
	
	// Defer restoring the grant so we don't break other demos
	defer func() {
		_, _ = db.Exec(context.Background(), "UPDATE authorization_grants SET expires_at = NOW() + INTERVAL '30 days' WHERE agent_id = $1", agentID)
	}()

	req := application.CheckoutRequest{
		MerchantID:     merchantID,
		ProductID:      product.ID,
		Quantity:       1,
		ExpectedPrice:  product.PricePaise,
		Currency:       product.Currency,
		CatalogHash:    product.ContentHash,
		IdempotencyKey: uuid.New().String(),
	}

	_, err := h.checkoutUC.ProposeTransaction(ctx, agentID, req)
	
	actualResult := "success (FAIL)"
	success := false
	if err != nil {
		actualResult = err.Error()
		success = apperrors.IsUnauthorized(err) || apperrors.IsForbidden(err)
	}

	return AttackResponse{
		Success:        success,
		ExpectedResult: "DENIED - grant has expired (or no active grant found)",
		ActualResult:   actualResult,
	}
}
