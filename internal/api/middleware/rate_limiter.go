package middleware

import (
	"net/http"

	rediscache "agentic-commerce/internal/infrastructure/redis"
	"github.com/gin-gonic/gin"
)

// RateLimiter creates a Gin middleware that enforces per-agent rate limits.
// If Redis is nil (connection failed), the middleware is a no-op passthrough.
//
// WHY: A compromised or buggy AI agent could flood the payment pipeline
// with thousands of requests per second. Rate limiting at the Redis layer
// rejects 99% of burst traffic in <1ms, before it ever touches Postgres.
func RateLimiter(cache *rediscache.Cache, requestsPerMinute int) gin.HandlerFunc {
	return func(c *gin.Context) {
		// If Redis is unavailable, fail open (allow all traffic)
		if cache == nil {
			c.Next()
			return
		}

		// Extract agent identity from request
		// For MCP endpoints, the agent is identified by the session/auth header.
		// For MVP, we use the client IP as the rate limit key.
		agentKey := c.ClientIP()
		if agentID := c.GetHeader("X-Agent-ID"); agentID != "" {
			agentKey = agentID
		}

		allowed, err := cache.AllowRequest(c.Request.Context(), agentKey, requestsPerMinute, 60_000_000_000) // 1 minute in nanoseconds
		if err != nil {
			// Redis error — fail open
			c.Next()
			return
		}

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate limit exceeded",
				"message": "Too many requests. Please wait before retrying.",
				"limit":   requestsPerMinute,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
