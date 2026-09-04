package mcp

import (
	"errors"
	"net/http"
	"strconv"

	"agentic-commerce/internal/application"
	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/apperrors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	catalogUC  application.CatalogUseCase
	merchantUC application.MerchantUseCase
	checkoutUC application.CheckoutUseCase
}

func NewHandler(catalog application.CatalogUseCase, merchant application.MerchantUseCase, checkout application.CheckoutUseCase) *Handler {
	return &Handler{
		catalogUC:  catalog,
		merchantUC: merchant,
		checkoutUC: checkout,
	}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/mcp/v1")
	
	// Middlewares
	api.Use(h.AgentAuthMiddleware())

	// Agent Capabilities (Tools)
	api.GET("/products/search", h.SearchProducts)
	api.GET("/products/:id", h.GetProduct)
	api.GET("/policies", h.GetPolicies)
	api.POST("/checkout/propose", h.ProposeTransaction)
	api.POST("/checkout/execute", h.ExecutePayment)
	api.POST("/checkout/simulate-capture", h.SimulateCapture) // TEST MODE ONLY
}

// AgentAuthMiddleware simulates HMAC authentication for the Hackathon MVP.
// It extracts the Agent's identity from the headers so we know whose limits to check.
func (h *Handler) AgentAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		agentIDStr := c.GetHeader("X-Agent-ID")
		if agentIDStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing X-Agent-ID header"})
			c.Abort()
			return
		}
		
		agentID, err := uuid.Parse(agentIDStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent ID format"})
			c.Abort()
			return
		}
		
		c.Set("agent_id", agentID)
		c.Next()
	}
}

// Tool 1: search_products
func (h *Handler) SearchProducts(c *gin.Context) {
	merchantID, _ := uuid.Parse(c.Query("merchant_id")) // Ignoring error for MVP brevity
	maxPrice, _ := strconv.ParseInt(c.Query("max_price"), 10, 64)
	limit, _ := strconv.Atoi(c.Query("limit"))

	filter := domain.SearchFilter{
		MerchantID: merchantID,
		Query:      c.Query("query"),
		Category:   c.Query("category"),
		MaxPrice:   maxPrice,
		Limit:      limit,
	}

	products, err := h.catalogUC.SearchProducts(c.Request.Context(), filter)
	if err != nil {
		h.handleError(c, err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": products})
}

// Tool: get_product
func (h *Handler) GetProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id format"})
		return
	}

	product, err := h.catalogUC.GetProduct(c.Request.Context(), productID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": product})
}

// Tool 2: get_merchant_policies
func (h *Handler) GetPolicies(c *gin.Context) {
	merchantID, _ := uuid.Parse(c.Query("merchant_id"))
	
	policies, err := h.merchantUC.GetPolicies(c.Request.Context(), merchantID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": policies})
}

// Tool 3: propose_transaction
func (h *Handler) ProposeTransaction(c *gin.Context) {
	agentID := c.MustGet("agent_id").(uuid.UUID)
	
	var req application.CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json body"})
		return
	}

	tx, err := h.checkoutUC.ProposeTransaction(c.Request.Context(), agentID, req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": tx})
}

// Tool 4: execute_payment
func (h *Handler) ExecutePayment(c *gin.Context) {
	var req struct {
		TransactionID  uuid.UUID `json:"transaction_id"`
		IdempotencyKey string    `json:"idempotency_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json body"})
		return
	}

	tx, err := h.checkoutUC.ExecutePayment(c.Request.Context(), req.TransactionID, req.IdempotencyKey)
	if err != nil {
		h.handleError(c, err)
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": tx})
}

// Tool 5: simulate_capture (TEST MODE ONLY)
// Simulates a Razorpay payment.captured webhook for autonomous AI payment.
// In production, this would be replaced by a real Razorpay checkout + webhook flow.
func (h *Handler) SimulateCapture(c *gin.Context) {
	var req struct {
		TransactionID uuid.UUID `json:"transaction_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json body"})
		return
	}

	err := h.checkoutUC.HandleWebhook(c.Request.Context(), req.TransactionID, "captured")
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "captured", "message": "Payment simulated via Canara Bank Netbanking (Test Mode)"})
}

// handleError maps domain apperrors to exact HTTP status codes.
func (h *Handler) handleError(c *gin.Context, err error) {
	var appErr *apperrors.AppError
	if errors.As(err, &appErr) {
		switch appErr.Type {
		case apperrors.TypeNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": appErr.Message})
		case apperrors.TypeUnauthorized:
			c.JSON(http.StatusUnauthorized, gin.H{"error": appErr.Message})
		case apperrors.TypeForbidden:
			c.JSON(http.StatusForbidden, gin.H{"error": appErr.Message}) // Policy Denied!
		case apperrors.TypeConflict:
			c.JSON(http.StatusConflict, gin.H{"error": appErr.Message}) // State machine violation
		case apperrors.TypeIntegrity:
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": appErr.Message}) // Hallucinated price!
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		}
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

