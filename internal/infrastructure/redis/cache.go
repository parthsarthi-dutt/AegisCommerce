package redis

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache provides Redis-backed rate limiting and idempotency caching.
// It sits in front of Postgres as the hot-path layer for sub-millisecond checks.
type Cache struct {
	client *redis.Client
	logger *slog.Logger
}

// NewCache creates a Redis connection. If Redis is unreachable, the application
// continues to work (Postgres is the fallback), but logs a warning.
func NewCache(addr string, logger *slog.Logger) (*Cache, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     "", // No password for local docker dev
		DB:           0,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
		PoolSize:     20,
	})

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Warn("Redis connection failed, falling back to Postgres-only mode", "error", err)
		return nil, err
	}

	logger.Info("Connected to Redis successfully", "addr", addr)
	return &Cache{client: client, logger: logger}, nil
}

// Close gracefully shuts down the Redis connection.
func (c *Cache) Close() error {
	return c.client.Close()
}

// --- Rate Limiting ---
// Uses a sliding window counter pattern. Each agent gets N requests per window.

// AllowRequest checks if an agent is within their rate limit.
// Returns true if allowed, false if rate-limited.
func (c *Cache) AllowRequest(ctx context.Context, agentID string, limit int, window time.Duration) (bool, error) {
	// Key format: rate:{agentID}:{window_bucket}
	bucket := time.Now().Unix() / int64(window.Seconds())
	key := fmt.Sprintf("rate:%s:%d", agentID, bucket)

	count, err := c.client.Incr(ctx, key).Result()
	if err != nil {
		c.logger.Warn("Redis rate limit check failed, allowing request", "error", err)
		return true, nil // Fail open for availability
	}

	// Set TTL on first request in this window
	if count == 1 {
		c.client.Expire(ctx, key, window+time.Second) // +1s buffer to prevent edge cases
	}

	return count <= int64(limit), nil
}

// --- Idempotency Cache ---
// Hot-path duplicate detection. Postgres is the durable fallback.

// CheckIdempotency atomically checks if an idempotency key has been seen before.
// Returns true if this is a NEW key (first time), false if DUPLICATE.
func (c *Cache) CheckIdempotency(ctx context.Context, key string, scope string) (bool, error) {
	cacheKey := fmt.Sprintf("idem:%s:%s", scope, key)

	// SET NX = Set if Not Exists. Atomic. First caller wins.
	set, err := c.client.SetNX(ctx, cacheKey, "1", 24*time.Hour).Result()
	if err != nil {
		c.logger.Warn("Redis idempotency check failed, deferring to Postgres", "error", err)
		return true, nil // Fail open — Postgres will catch it
	}

	return set, nil // set=true means new key, set=false means duplicate
}

// RecordIdempotency stores the result of a processed request for fast retrieval.
func (c *Cache) RecordIdempotency(ctx context.Context, key string, scope string, txID string) error {
	cacheKey := fmt.Sprintf("idem:%s:%s", scope, key)
	return c.client.Set(ctx, cacheKey, txID, 24*time.Hour).Err()
}

// GetIdempotencyResult retrieves a cached idempotency result (transaction ID).
func (c *Cache) GetIdempotencyResult(ctx context.Context, key string, scope string) (string, error) {
	cacheKey := fmt.Sprintf("idem:%s:%s", scope, key)
	result, err := c.client.Get(ctx, cacheKey).Result()
	if err == redis.Nil {
		return "", nil // Not found
	}
	return result, err
}
