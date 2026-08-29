package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"agentic-commerce/internal/api/mcp"
	"agentic-commerce/internal/application"
	"agentic-commerce/internal/config"
	"agentic-commerce/internal/domain"
	"agentic-commerce/internal/infrastructure/postgres"
	"agentic-commerce/pkg/database"
	"agentic-commerce/pkg/logger"
	"agentic-commerce/pkg/razorpay"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Initialize Logger
	log := logger.New()
	slog.SetDefault(log)

	// 2. Load Configuration (Fail Fast Security)
	cfg, err := config.Load()
	if err != nil {
		log.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}
	log.Info("Configuration loaded successfully", "port", cfg.Port)

	// 3. Initialize Database Connection Pool
	dbPool, err := database.Connect(context.Background(), cfg.DatabaseURL, log)
	if err != nil {
		log.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()
	log.Info("Connected to PostgreSQL successfully")

	// 4. Initialize Context-Based Transaction Manager
	txManager := database.NewTransactionManager(dbPool, log)

	// 5. Initialize Repositories (Infrastructure Layer)
	catalogRepo := postgres.NewCatalogRepository(txManager)
	merchantRepo := postgres.NewMerchantRepository(txManager)
	authRepo := postgres.NewAuthRepository(txManager)
	txRepo := postgres.NewTransactionRepository(txManager)
	auditRepo := postgres.NewAuditRepository(txManager)

	// 6. Initialize External Gateways
	paymentGateway := razorpay.NewClient(razorpay.Config{
		KeyID:     cfg.RazorpayKeyID,
		KeySecret: cfg.RazorpayKeySecret,
	})

	// 7. Initialize Domain Services (The Pure Go Brains)
	policyEngine := domain.NewPolicyEngine()
	integrityVerifier := domain.NewIntegrityVerifier()

	// 8. Initialize Use Cases (Application Layer)
	catalogUC := application.NewCatalogUseCase(catalogRepo, log)
	merchantUC := application.NewMerchantUseCase(merchantRepo, log)
	checkoutUC := application.NewCheckoutUseCase(
		txManager,
		catalogRepo,
		authRepo,
		txRepo,
		auditRepo,
		paymentGateway,
		policyEngine,
		integrityVerifier,
		log,
	)

	// 9. Initialize HTTP Server & Routes
	router := gin.Default()
	
	// Standard health check for Docker/Kubernetes
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "1.0.0"})
	})

	// Register MCP API endpoints
	mcpHandler := mcp.NewHandler(catalogUC, merchantUC, checkoutUC)
	mcpHandler.RegisterRoutes(router)

	// 10. Graceful Shutdown Implementation (Rule 10.7)
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	go func() {
		log.Info("Starting Agentic Commerce Server", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("Server crashed", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal (Ctrl+C)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	log.Info("Interrupt signal received. Shutting down gracefully...")

	// 5-second timeout for inflight requests to finish
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("Server forced to shutdown", "error", err)
	}

	log.Info("Server exited safely.")
}
