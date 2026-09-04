package dashboard

import (
	"context"
	"encoding/json"
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
	router.GET("/api/test-db", func(c *gin.Context) {
		db := h.tm.GetDB(c.Request.Context())
		var count int
		err := db.QueryRow(context.Background(), "SELECT COUNT(*) FROM audit_events").Scan(&count)
		c.JSON(200, gin.H{"count": count, "err": err})
	})
	router.GET("/api/grant", h.GetGrantInfo)
	router.POST("/api/grant", h.UpdateGrant)
}

func (h *Handler) GetGrantInfo(c *gin.Context) {
	db := h.tm.GetDB(c.Request.Context())
	
	var maxAmount, amountConsumed, amountReserved int64
	err := db.QueryRow(c.Request.Context(), `
		SELECT g.max_amount_paise, u.amount_consumed, u.amount_reserved
		FROM authorization_grants g
		JOIN grant_usage u ON g.id = u.grant_id
		LIMIT 1
	`).Scan(&maxAmount, &amountConsumed, &amountReserved)
	
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch grant info"})
		return
	}
	
	c.JSON(200, gin.H{
		"max_amount": maxAmount,
		"consumed": amountConsumed,
		"reserved": amountReserved,
	})
}

func (h *Handler) UpdateGrant(c *gin.Context) {
	var req struct {
		MaxAmount int64 `json:"max_amount"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return
	}
	
	db := h.tm.GetDB(c.Request.Context())
	
	// Enforce constraint: max_amount cannot be less than (consumed + reserved)
	var consumed, reserved int64
	err := db.QueryRow(c.Request.Context(), `
		SELECT COALESCE(SUM(amount_consumed), 0), COALESCE(SUM(amount_reserved), 0)
		FROM grant_usage
	`).Scan(&consumed, &reserved)
	
	if err == nil {
		if req.MaxAmount < (consumed + reserved) {
			c.JSON(400, gin.H{"error": "Constraint violation: Max grant cannot be less than already consumed + reserved funds"})
			return
		}
	}

	_, err = db.Exec(c.Request.Context(), `
		UPDATE authorization_grants SET max_amount_paise = $1
	`, req.MaxAmount)
	
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update grant"})
		return
	}
	
	c.JSON(200, gin.H{"success": true})
}

func (h *Handler) GetDashboardData(c *gin.Context) {
	db := h.tm.GetDB(c.Request.Context())
	ctx := c.Request.Context()

	// ============================================================
	// 1. KPI METRICS
	// ============================================================

	var totalConsumed, totalReserved int64

	err := db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(amount_consumed), 0),
			COALESCE(SUM(amount_reserved), 0)
		FROM grant_usage
	`).Scan(&totalConsumed, &totalReserved)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch metrics",
		})
		return
	}

	// Real policy denial count.
	var policyDenials int

	err = db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM audit_events
		WHERE event_type IN (
			'policy_evaluation_denied',
			'unauthorized_agent_blocked',
			'catalog_tampering_detected',
			'idempotency_replay_prevented',
			'policy_grant_expired_denied'
		)
	`).Scan(&policyDenials)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch policy denials",
		})
		return
	}

	// Real active grant count.
	var activeGrants int

	err = db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM authorization_grants
		WHERE revoked_at IS NULL
		  AND expires_at > NOW()
	`).Scan(&activeGrants)

	if err != nil {
		// If revoked_at does not exist in your schema,
		// use the fallback query below.
		err = db.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM authorization_grants
			WHERE expires_at > NOW()
		`).Scan(&activeGrants)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to fetch active grants",
			})
			return
		}
	}

	// ============================================================
	// 2. TRANSACTIONS
	// ============================================================

	rows, err := db.Query(ctx, `
		SELECT
			t.id,
			p.name,
			t.total_amount_paise,
			t.status,
			t.currency,
			t.agent_id,
			t.gateway_order_id,
			t.failure_reason,
			t.metadata,
			t.created_at,
			t.updated_at,
			CASE
				WHEN t.created_at > '0002-01-01'
				THEN t.created_at
				ELSE t.updated_at
			END AS effective_date,
			COALESCE(g.max_amount_paise, 0),
			COALESCE(u.amount_consumed, 0),
			COALESCE(u.amount_reserved, 0)
		FROM transactions t
		JOIN products p
			ON t.product_id = p.id
		LEFT JOIN authorization_grants g
			ON t.grant_id = g.id
		LEFT JOIN grant_usage u
			ON g.id = u.grant_id
		ORDER BY effective_date DESC
		LIMIT 20
	`)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch transactions",
		})
		return
	}

	defer rows.Close()

	var transactions []map[string]any

	for rows.Next() {
		var (
			id             string
			productName    string
			status         string
			currency       string
			agentID        *string
			gatewayOrderID *string
			failureReason  *string

			amount         int64
			maxAmount      int64
			consumed       int64
			reserved       int64

			createdAt     time.Time
			updatedAt     time.Time
			effectiveDate time.Time

			metaBytes []byte
		)

		err := rows.Scan(
			&id,
			&productName,
			&amount,
			&status,
			&currency,
			&agentID,
			&gatewayOrderID,
			&failureReason,
			&metaBytes,
			&createdAt,
			&updatedAt,
			&effectiveDate,
			&maxAmount,
			&consumed,
			&reserved,
		)

		if err != nil {
			fmt.Printf("Error scanning transaction: %v\n", err)
			continue
		}

		var metadata map[string]any

		if len(metaBytes) > 0 {
			_ = json.Unmarshal(metaBytes, &metadata)
		}

		agent := "AI Agent"

		if agentID != nil && *agentID != "" {
			agent = *agentID
		}

		gatewayID := ""

		if gatewayOrderID != nil {
			gatewayID = *gatewayOrderID
		}

		failReason := ""

		if failureReason != nil {
			failReason = *failureReason
		}

		// --------------------------------------------------------
		// Transaction lifecycle
		// --------------------------------------------------------

		var lifecycle []string

		switch status {
		case "created":
			lifecycle = []string{
				"PROPOSED",
			}

		case "authorized":
			lifecycle = []string{
				"PROPOSED",
				"AUTHORIZED",
			}

		case "reserved":
			lifecycle = []string{
				"PROPOSED",
				"AUTHORIZED",
				"RESERVED",
			}

		case "payment_pending":
			lifecycle = []string{
				"PROPOSED",
				"AUTHORIZED",
				"RESERVED",
				"PAYMENT_PENDING",
			}

		case "captured":
			lifecycle = []string{
				"PROPOSED",
				"AUTHORIZED",
				"RESERVED",
				"PAYMENT_PENDING",
				"CAPTURED",
			}

		case "released":
			lifecycle = []string{
				"PROPOSED",
				"AUTHORIZED",
				"RESERVED",
				"RELEASED",
			}

		case "failed":
			lifecycle = []string{
				"PROPOSED",
				"FAILED",
			}

		default:
			lifecycle = []string{
				"PROPOSED",
			}
		}

		transactions = append(transactions, map[string]any{
			"id":               id,
			"product":          productName,
			"amountPaise":      amount,
			"currency":         currency,
			"agent":            agent,
			"status":           status,
			"date":             effectiveDate.Format(time.RFC3339),
			"createdAt":        createdAt.Format(time.RFC3339),
			"updatedAt":        updatedAt.Format(time.RFC3339),
			"gatewayOrderId":   gatewayID,
			"failureReason":    failReason,
			"metadata":         metadata,
			"grantLimitPaise":  maxAmount,
			"grantConsumedPaise": consumed,
			"grantReservedPaise": reserved,
			"grantRemainingPaise": maxAmount - consumed - reserved,
			"lifecycle":        lifecycle,
		})
	}

	if transactions == nil {
		transactions = []map[string]any{}
	}

	// ============================================================
	// 3. AUDIT EVENTS
	// ============================================================

	var auditEvents []map[string]any

	auditRows, err := db.Query(ctx, `
		SELECT
			id,
			event_type,
			resource,
			metadata,
			created_at
		FROM audit_events
		ORDER BY created_at DESC
		LIMIT 20
	`)

	if err == nil {
		defer auditRows.Close()

		for auditRows.Next() {
			var (
				id             string
				eventType      string
				resource       *string
				metadataBytes  []byte
				createdAt      time.Time
			)

			err := auditRows.Scan(
				&id,
				&eventType,
				&resource,
				&metadataBytes,
				&createdAt,
			)

			if err != nil {
				fmt.Printf("Audit row scan error: %v\n", err)
				continue
			}

			var details map[string]any

			if len(metadataBytes) > 0 {
				_ = json.Unmarshal(metadataBytes, &details)
			}

			resourceValue := ""

			if resource != nil {
				resourceValue = *resource
			}

			auditEvents = append(auditEvents, map[string]any{
				"id":         id,
				"event_type": eventType,
				"resource":   resourceValue,
				"details":    details,
				"date":       createdAt.Format(time.RFC3339),
			})
		}
	}

	// ============================================================
	// 4. POLICY DECISIONS
	//
	// This is the important part.
	//
	// Your policy engine records DENY in policy_decisions.
	// Therefore dashboard must read that table too.
	// ============================================================

	policyRows, err := db.Query(ctx, `
		SELECT
			pd.transaction_id,
			pd.decision,
			pd.amount_paise,
			pd.reasoning,
			pd.spending_check,
			pd.time_check,
			pd.active_check,
			t.created_at
		FROM policy_decisions pd
		LEFT JOIN transactions t
			ON pd.transaction_id = t.id
		ORDER BY t.created_at DESC
		LIMIT 20
	`)

	if err == nil {
		defer policyRows.Close()

		for policyRows.Next() {
			var (
				transactionID string
				decision      string
				reasoning     string

				amountPaise int64

				spendingCheck bool
				timeCheck     bool
				activeCheck   bool

				createdAt time.Time
			)

			err := policyRows.Scan(
				&transactionID,
				&decision,
				&amountPaise,
				&reasoning,
				&spendingCheck,
				&timeCheck,
				&activeCheck,
				&createdAt,
			)

			if err != nil {
				fmt.Printf("Policy decision scan error: %v\n", err)
				continue
			}

			auditEvents = append(auditEvents, map[string]any{
				"id":         transactionID,
				"event_type": "policy_evaluation",
				"resource":   transactionID,
				"details": map[string]any{
					"decision":       decision,
					"amount_paise":   amountPaise,
					"reasoning":      reasoning,
					"spending_check": spendingCheck,
					"time_check":     timeCheck,
					"active_check":   activeCheck,
				},
				"date": createdAt.Format(time.RFC3339),
			})
		}
	}

	if auditEvents == nil {
		auditEvents = []map[string]any{}
	}

	// ============================================================
	// 5. POLICY STATISTICS
	//
	// Useful for dashboard graphs.
	// ============================================================

	var allowedCount int
	var deniedCount int

	err = db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (
				WHERE UPPER(decision) = 'ALLOW'
			),
			COUNT(*) FILTER (
				WHERE UPPER(decision) = 'DENY'
			)
		FROM policy_decisions
	`).Scan(
		&allowedCount,
		&deniedCount,
	)

	if err != nil {
		allowedCount = 0
		deniedCount = policyDenials
	}

	// ============================================================
	// 6. TRANSACTION STATUS COUNTS
	//
	// Gives frontend useful real-time chart data.
	// ============================================================

	type StatusCount struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}

	statusRows, err := db.Query(ctx, `
		SELECT
			status,
			COUNT(*)
		FROM transactions
		GROUP BY status
		ORDER BY COUNT(*) DESC
	`)

	var statusBreakdown []StatusCount

	if err == nil {
		defer statusRows.Close()

		for statusRows.Next() {
			var s StatusCount

			if err := statusRows.Scan(
				&s.Status,
				&s.Count,
			); err == nil {
				statusBreakdown = append(statusBreakdown, s)
			}
		}
	}

	if statusBreakdown == nil {
		statusBreakdown = []StatusCount{}
	}

	// ============================================================
	// 7. RESPONSE
	// ============================================================

	c.JSON(http.StatusOK, gin.H{
		"metrics": map[string]any{
			"total_revenue_paise": totalConsumed,
			"funds_reserved_paise": totalReserved,
			"policy_denials":       policyDenials,
			"active_grants":        activeGrants,
			"policy_allowed":       allowedCount,
			"policy_denied":        deniedCount,
		},

		"transactions": transactions,

		"audit_trail": auditEvents,

		"policy_stats": map[string]any{
			"allowed": allowedCount,
			"denied":  deniedCount,
		},

		"status_breakdown": statusBreakdown,
	})
}
