package checkout

import (
	"embed"
	"net/http"
	"os"

	"agentic-commerce/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// We use go:embed so the HTML file is baked right into the Go binary.
// This requires zero static file configuration on the server.
//go:embed index.html
var checkoutPage embed.FS

type Handler struct {
	txRepo domain.TransactionRepository
	keyID  string
}

func NewHandler(txRepo domain.TransactionRepository) *Handler {
	return &Handler{
		txRepo: txRepo,
		keyID:  os.Getenv("RAZORPAY_KEY_ID"), // We only expose the public Key ID
	}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	group := router.Group("/checkout")
	{
		group.GET("", h.ServeCheckoutPage)
		group.GET("/session", h.GetSession)
	}
}

func (h *Handler) ServeCheckoutPage(c *gin.Context) {
	file, _ := checkoutPage.ReadFile("index.html")
	c.Data(http.StatusOK, "text/html; charset=utf-8", file)
}

func (h *Handler) GetSession(c *gin.Context) {
	txIDStr := c.Query("transaction_id")
	if txIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "transaction_id is required"})
		return
	}

	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transaction_id format"})
		return
	}

	tx, err := h.txRepo.Get(c.Request.Context(), txID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transaction"})
		return
	}
	if tx == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	// Architectural Constraint: Ensure transaction is in the correct state
	if tx.Status != domain.StatusPaymentPending {
		c.JSON(http.StatusConflict, gin.H{"error": "transaction is not in payment_pending state"})
		return
	}

	if tx.GatewayOrderID == nil || *tx.GatewayOrderID == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "transaction does not have a gateway order ID"})
		return
	}

	// Only return the exact variables required by the frontend
	c.JSON(http.StatusOK, gin.H{
		"key_id":         h.keyID,
		"order_id":       *tx.GatewayOrderID,
		"amount":         tx.TotalAmountPaise,
		"currency":       tx.Currency,
		"transaction_id": tx.ID,
	})
}