package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all required application configuration.
type Config struct {
	Port              string
	DatabaseURL       string
	RedisURL          string
	RazorpayKeyID     string
	RazorpayKeySecret string
}

// Load reads configuration from environment variables.
// It fails fast if any required variable is missing.
func Load() (*Config, error) {
	// Attempt to load .env file. We ignore the error because in production,
	// environment variables might be injected directly by Docker/K8s without a .env file.
	_ = godotenv.Load()

	cfg := &Config{
		Port:              getEnvOrDefault("PORT", "8080"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		RedisURL:          getEnvOrDefault("REDIS_URL", "localhost:6379"),
		RazorpayKeyID:     os.Getenv("RAZORPAY_KEY_ID"),
		RazorpayKeySecret: os.Getenv("RAZORPAY_KEY_SECRET"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// validate ensures all required fields are present.
func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.RazorpayKeyID == "" {
		return fmt.Errorf("RAZORPAY_KEY_ID is required")
	}
	if c.RazorpayKeySecret == "" {
		return fmt.Errorf("RAZORPAY_KEY_SECRET is required")
	}
	return nil
}

func getEnvOrDefault(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
