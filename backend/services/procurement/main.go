package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	pkgKafka "backend/pkg/kafka"
	"backend/pkg/outbox"
	"procurement-service/config"
	"procurement-service/consumer"
	"procurement-service/handlers"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/ansrivas/fiberprometheus/v2"
)

func main() {
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
	defer producer.Close()

	// Outbox topic map
	topicMap := map[string]string{
		"PurchaseOrderCreated":  "erp.procurement.po-created",
		"PurchaseOrderUpdated":  "erp.audit.all-events",
		"PurchaseOrderReceived": "erp.audit.all-events",
	}

	relayWorker := outbox.NewRelayWorker(config.DB, producer, "procurement-service", "procurement.outbox_events", topicMap)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start Outbox relay loop
	go relayWorker.Start(ctx, 500*time.Millisecond)

	// Start stock consumer in background
	stockConsumer := consumer.NewStockConsumer(config.DB, brokersList, "procurement-service-group")
	go stockConsumer.Start(ctx)

	// Fiber app configuration
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error":   "Internal Server Error",
				"message": err.Error(),
			})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())

	prometheus := fiberprometheus.New("procurement-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
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

	log.Printf("Procurement service listening on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
