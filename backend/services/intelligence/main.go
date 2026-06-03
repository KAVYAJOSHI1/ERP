package main

import (
	"log"
	"os"

	"intelligence-service/handlers"

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

	handlers.ConnectDB()

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

	prometheus := fiberprometheus.New("intelligence-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "intelligence-service",
		})
	})

	// Routes
	app.Get("/intelligence/forecast", handlers.GetForecast)

	port := os.Getenv("INTELLIGENCE_SERVICE_PORT")
	if port == "" {
		port = "8084"
	}

	log.Printf("Intelligence service listening on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
