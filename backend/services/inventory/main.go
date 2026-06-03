package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	pkgKafka "backend/pkg/kafka"
	"backend/pkg/outbox"
	"inventory-service/config"
	"inventory-service/handlers"

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

	// Start outbox relay worker
	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers == "" {
		kafkaBrokers = "localhost:9092"
	}
	brokersList := strings.Split(kafkaBrokers, ",")

	producer := pkgKafka.NewProducer(brokersList)
	defer producer.Close()

	topicMap := map[string]string{
		"StockUpdated": "erp.inventory.stock-updated",
	}

	relayWorker := outbox.NewRelayWorker(config.DB, producer, "inventory-service", "inventory.outbox_events", topicMap)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go relayWorker.Start(ctx, 500*time.Millisecond)

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

	prometheus := fiberprometheus.New("inventory-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "inventory-service",
		})
	})

	// Service Routes (forwarded from gateway under /api/inventory/*)
	app.Get("/inventory/products", handlers.GetProducts)
	app.Post("/inventory/products", handlers.CreateProduct)
	app.Get("/inventory/warehouses", handlers.GetWarehouses)
	app.Post("/inventory/warehouses", handlers.CreateWarehouse)
	app.Get("/inventory/stock", handlers.GetStockLevels)
	app.Post("/inventory/stock/reorder-point", handlers.SetReorderPoint)
	app.Post("/inventory/stock/adjust", handlers.AdjustStock)

	port := os.Getenv("INVENTORY_SERVICE_PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Inventory service listening on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
