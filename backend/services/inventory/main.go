package main

import (
	"log"
	"os"

	"inventory-service/config"
	"inventory-service/handlers"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Try loading env files from various relative locations
	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	config.ConnectDB()

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
