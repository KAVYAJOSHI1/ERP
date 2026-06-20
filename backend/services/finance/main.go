package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"backend/pkg/database"
	"backend/pkg/logger"
	"finance-service/config"
	"finance-service/consumer"
	"finance-service/handlers"

	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Initialize structured logger
	logger.InitJSONLogger("finance-service")

	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	config.ConnectDB()

	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "localhost:9092"
	}
	brokersList := strings.Split(kafkaBrokers, ",")

	ctx, cancel := context.WithCancel(context.Background())

	// Start finance consumer in background
	financeConsumer := consumer.NewFinanceConsumer(config.DB, brokersList)
	go financeConsumer.Start(ctx)

	// Fiber app configuration
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			var e *fiber.Error
			if errors.As(err, &e) {
				code = e.Code
			}
			slog.Error("Request handler error", "error", err.Error(), "path", c.Path(), "method", c.Method())
			return c.Status(code).JSON(fiber.Map{
				"error":   "Internal Server Error",
				"message": err.Error(),
			})
		},
	})

	app.Use(recover.New())
	app.Use(fiberLogger.New(fiberLogger.Config{
		Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","ip":"${ip}"}` + "\n",
		Output: os.Stdout,
	}))

	prometheus := fiberprometheus.New("finance-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		dbErr := database.Ping(config.DB)
		if dbErr != nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "DOWN",
				"service": "finance-service",
				"details": fiber.Map{
					"database": false,
				},
			})
		}
		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "finance-service",
		})
	})

	// Routes
	app.Get("/finance/ledger", handlers.GetLedgerEntries)
	app.Get("/finance/accounts", handlers.GetAccounts)
	app.Get("/finance/invoices", handlers.GetInvoices)

	port := os.Getenv("FINANCE_SERVICE_PORT")
	if port == "" {
		port = "8083"
	}

	// Listen in a goroutine
	go func() {
		slog.Info("Finance service listening", "port", port)
		if err := app.Listen(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Failed to start server", "error", err)
			os.Exit(1)
		}
	}()

	// Signal interception for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down finance service server...")
	cancel() // Stops the finance consumer loop

	// Fiber shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		slog.Error("Fiber shutdown failed", "error", err)
	} else {
		slog.Info("Fiber server shutdown completed successfully")
	}

	// Close SQL DB Connection
	if config.DB != nil {
		sqlDB, err := config.DB.DB()
		if err == nil {
			if err := sqlDB.Close(); err != nil {
				slog.Error("SQL DB connection close failed", "error", err)
			} else {
				slog.Info("SQL DB connection closed successfully")
			}
		}
	}

	slog.Info("Finance service exited clean")
}
