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
	pkgKafka "backend/pkg/kafka"
	"backend/pkg/logger"
	"backend/pkg/outbox"
	"procurement-service/config"
	"procurement-service/consumer"
	"procurement-service/handlers"

	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Initialize structured logger
	logger.InitJSONLogger("procurement-service")

	// Try loading env files from various relative locations
	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	config.ConnectDB()
	handlers.DB = config.DB

	// Parse Kafka brokers
	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "localhost:9092"
	}
	brokersList := strings.Split(kafkaBrokers, ",")

	// Initialize Kafka Producer for Outbox Relay
	producer := pkgKafka.NewProducer(brokersList)

	// Outbox topic map
	topicMap := map[string]string{
		"PurchaseOrderCreated":  "erp.procurement.po-created",
		"PurchaseOrderUpdated":  "erp.audit.all-events",
		"PurchaseOrderReceived": "erp.audit.all-events",
	}

	relayWorker := outbox.NewRelayWorker(config.DB, producer, "procurement-service", "procurement.outbox_events", topicMap)
	ctx, cancel := context.WithCancel(context.Background())

	// Start Outbox relay loop in background
	go relayWorker.Start(ctx, 500*time.Millisecond)

	// Start stock consumer in background
	stockConsumer := consumer.NewStockConsumer(config.DB, brokersList, "procurement-service-group")
	go stockConsumer.Start(ctx)

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

	prometheus := fiberprometheus.New("procurement-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		dbErr := database.Ping(config.DB)
		if dbErr != nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "DOWN",
				"service": "procurement-service",
				"details": fiber.Map{
					"database": false,
				},
			})
		}
		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "procurement-service",
		})
	})

	// Routes
	app.Get("/procurement/vendors", handlers.GetVendors)
	app.Post("/procurement/vendors", handlers.CreateVendor)
	app.Get("/procurement/po", handlers.GetPurchaseOrders)
	app.Post("/procurement/po", handlers.CreatePurchaseOrder)
	app.Get("/procurement/po/:id", handlers.GetPurchaseOrder)
	app.Put("/procurement/po/:id/status", handlers.UpdatePurchaseOrderStatus)

	port := os.Getenv("PROCUREMENT_SERVICE_PORT")
	if port == "" {
		port = "8082"
	}

	// Listen in a goroutine
	go func() {
		slog.Info("Procurement service listening", "port", port)
		if err := app.Listen(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Failed to start server", "error", err)
			os.Exit(1)
		}
	}()

	// Signal interception for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down procurement service server...")
	cancel() // Cancels consumer and relay worker loops

	// Fiber shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		slog.Error("Fiber shutdown failed", "error", err)
	} else {
		slog.Info("Fiber server shutdown completed successfully")
	}

	// Close Kafka producer
	if producer != nil {
		if err := producer.Close(); err != nil {
			slog.Error("Kafka producer close failed", "error", err)
		} else {
			slog.Info("Kafka producer closed successfully")
		}
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

	slog.Info("Procurement service exited clean")
}
