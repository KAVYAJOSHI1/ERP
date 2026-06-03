package main

import (
	"log"
	"os"

	"auth-service/config"
	"auth-service/handlers"

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
	config.ConnectRedis()

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

	prometheus := fiberprometheus.New("auth-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "auth-service",
		})
	})

	// Service endpoints (will be proxied from gateway /api/auth/*)
	app.Post("/auth/register", handlers.Register)
	app.Post("/auth/login", handlers.Login)
	app.Post("/auth/refresh", handlers.Refresh)
	app.Post("/auth/logout", handlers.Logout)
	app.Get("/auth/me", handlers.UserMe)

	port := os.Getenv("AUTH_SERVICE_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Auth service listening on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
