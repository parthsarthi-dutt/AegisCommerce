package dashboard

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"agentic-commerce/pkg/database"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	tm *database.TransactionManager
}

func NewHandler(tm *database.TransactionManager) *Handler {
	return &Handler{tm: tm}
}

func (h *Handler) RegisterRoutes(router *gin.Engine) {
	router.GET("/api/dashboard", h.GetDashboardData)
}

func (h *Handler) GetDashboardData(c *gin.Context) {
	db := h.tm.GetDB(c.Request.Context())

	// 1. Fetch KPI Metrics
	var totalConsumed, totalReserved int64
	err := db.QueryRow(context.Background(), `
		SELECT 
			COALESCE(SUM(amount_consumed), 0), 
			COALESCE(SUM(amount_reserved), 0) 
		FROM grant_usage
	`).Scan(&totalConsumed, &totalReserved)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch metrics"})
		return
	}

	// 2. Fetch Policy Denials Count (from audit_events)
	var policyDenials int
	db.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM audit_events WHERE event_type = 'policy_evaluation' AND details->>'decision' = 'DENY'
	`).Scan(&policyDenials)

	// 3. Fetch Recent Transactions
	rows, err := db.Query(context.Background(), `
		SELECT t.id, p.name, t.total_amount_paise, t.status, t.created_at
		FROM transactions t
		JOIN products p ON t.product_id = p.id
		ORDER BY t.created_at DESC
		LIMIT 10
	`)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transactions"})
		return
	}
	defer rows.Close()

	var transactions []map[string]any
	for rows.Next() {
		var id, productName, status string
		var amount int64
		var createdAt time.Time
		
		if err := rows.Scan(&id, &productName, &amount, &status, &createdAt); err == nil {
			transactions = append(transactions, map[string]any{
				"id":      id,
				"product": productName,
				"amount":  amount,
				"agent":   "Gemini-Flash",
				"status":  status,
				"date":    createdAt.Format(time.RFC3339),
			})
		} else {
            // log the error if scan fails
            fmt.Printf("Error scanning row: %v\n", err)
        }
	}

	// If no transactions, ensure we don't return null
	if transactions == nil {
		transactions = []map[string]any{}
	}

	c.JSON(http.StatusOK, gin.H{
		"metrics": map[string]any{
			"total_revenue_paise": totalConsumed,
			"funds_reserved_paise": totalReserved,
			"policy_denials": policyDenials,
			"active_grants": 1, 
		},
		"transactions": transactions,
	})
}
