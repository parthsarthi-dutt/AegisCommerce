package webhook

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"

	"agentic-commerce/internal/application"
	"agentic-commerce/internal/domain"
	"agentic-commerce/pkg/razorpay"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	checkoutUC    application.CheckoutUseCase
	txRepo        domain.TransactionRepository
	logger        *slog.Logger
	webhookSecret string
}

func NewHandler(checkoutUC application.CheckoutUseCase, txRepo domain.TransactionRepository, logger *slog.Logger) *Handler {
	// In production, this should be a separate WEBHOOK_SECRET, 
	// but for MVP Razorpay often uses the key secret or a configured webhook secret.
	secret := os.Getenv("RAZORPAY_KEY_SECRET")
	if webhookSecret := os.Getenv("RAZORPAY_WEBHOOK_SECRET"); webhookSecret != "" {
		secret = webhookSecret
	}
	
	return &Handler{
		checkoutUC:    checkoutUC,
		txRepo:        txRepo,
		logger:        logger,
		webhookSecret: secret,
	}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	// Webhooks typically live under a dedicated namespace
	webhookGroup := router.Group("/webhooks")
	{
		webhookGroup.POST("/razorpay", h.HandleRazorpayWebhook)
	}
}

func (h *Handler) HandleRazorpayWebhook(c *gin.Context) {
	// 1. Read Raw Body (Required for Signature Verification)
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.logger.Error("failed to read webhook body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// 2. Cryptographic Signature Verification
	signature := c.GetHeader("X-Razorpay-Signature")
	if signature == "" {
		h.logger.Warn("missing razorpay signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return
	}

	isValid := razorpay.VerifySignature(string(bodyBytes), signature, h.webhookSecret)
	if !isValid {
		h.logger.Error("invalid razorpay webhook signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	// 3. Parse Webhook Event (Defense in Depth: map to exact expected fields)
	var payload struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					OrderID string `json:"order_id"`
					Status  string `json:"status"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}

	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		h.logger.Error("failed to parse webhook json", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}

	orderID := payload.Payload.Payment.Entity.OrderID
	if orderID == "" {
		// Not all webhooks might have an order ID depending on the event type.
		// We safely ignore them.
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return
	}

	// 4. Map Razorpay event to our Saga status
	var sagaStatus string
	switch payload.Event {
	case "payment.captured":
		sagaStatus = "captured"
	case "payment.failed":
		// CRITICAL ARCHITECTURE DECISION:
		// We do not fail the saga on payment.failed because Razorpay allows the user to click "Retry" 
		// and try another card on the same order. If we release the funds now, a subsequent success 
		// would have no reserved funds to commit! 
		// A background cron job will eventually cancel stale 'payment_pending' orders.
		h.logger.Info("payment failed, but ignoring to allow retry", "order_id", orderID)
		c.JSON(http.StatusOK, gin.H{"status": "ignored - allowing retry"})
		return
	default:
		// We safely ignore events we don't care about (Idempotent)
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return
	}

	// 5. Look up the Transaction by Gateway Order ID
	tx, err := h.txRepo.GetByGatewayOrderID(c.Request.Context(), orderID)
	if err != nil {
		h.logger.Error("database error looking up transaction", "error", err, "order_id", orderID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if tx == nil {
		h.logger.Warn("received webhook for unknown order", "order_id", orderID)
		c.JSON(http.StatusOK, gin.H{"status": "ignored - unknown order"})
		return
	}

	// 6. Finalize the Saga!
	err = h.checkoutUC.HandleWebhook(c.Request.Context(), tx.ID, sagaStatus)
	if err != nil {
		h.logger.Error("failed to handle webhook saga", "error", err, "tx_id", tx.ID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "saga processing failed"})
		return
	}

	h.logger.Info("successfully processed razorpay webhook", "event", payload.Event, "tx_id", tx.ID)
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
