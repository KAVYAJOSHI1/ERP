package main

import (
	"context"
	"log"
	"os"
	"strings"

	"finance-service/config"
	"finance-service/consumer"
	"finance-service/handlers"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/ansrivas/fiberprometheus/v2"
)

func main() {
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
	defer cancel()

	// Start finance consumer in background
	financeConsumer := consumer.NewFinanceConsumer(config.DB, brokersList)
	go financeConsumer.Start(ctx)

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

	prometheus := fiberprometheus.New("finance-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
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

	log.Printf("Finance service listening on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
