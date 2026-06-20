package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/pkg/database"
	"backend/pkg/logger"
	"auth-service/config"
	"auth-service/handlers"

	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Initialize structured logger
	logger.InitJSONLogger("auth-service")

	// Try loading env files from various relative locations
	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	// Verify critical JWT Secret configuration
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		slog.Warn("JWT_SECRET is not configured! Defaulting to placeholder secret. Please set JWT_SECRET in production env.")
	}

	config.ConnectDB()
	config.ConnectRedis()

	app := fiber.New(fiber.Config{
		DisableStartupMessage: true, // We will log startup in JSON ourselves
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
	// Use fiber custom logger to output structured JSON formatted logs for access
	app.Use(fiberLogger.New(fiberLogger.Config{
		Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","ip":"${ip}"}` + "\n",
		Output: os.Stdout,
	}))

	prometheus := fiberprometheus.New("auth-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check with active dependency checking
	app.Get("/health", func(c *fiber.Ctx) error {
		dbErr := database.Ping(config.DB)
		
		var redisErr error
		if config.RedisClient != nil {
			_, redisErr = config.RedisClient.Ping(context.Background()).Result()
		} else {
			redisErr = errors.New("redis client is nil")
		}

		if dbErr != nil || redisErr != nil {
			status := 503
			return c.Status(status).JSON(fiber.Map{
				"status":  "DOWN",
				"service": "auth-service",
				"details": fiber.Map{
					"database": dbErr == nil,
					"redis":    redisErr == nil,
				},
			})
		}

		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "auth-service",
		})
	})

	// Service endpoints (proxied from gateway /api/auth/*)
	app.Post("/auth/register", handlers.Register)
	app.Post("/auth/login", handlers.Login)
	app.Post("/auth/refresh", handlers.Refresh)
	app.Post("/auth/logout", handlers.Logout)
	app.Get("/auth/me", handlers.UserMe)
	app.Get("/auth/users", handlers.GetUsers)

	port := os.Getenv("AUTH_SERVICE_PORT")
	if port == "" {
		port = "8080"
	}

	// Listen in a goroutine for graceful shutdown
	go func() {
		slog.Info("Auth service listening", "port", port)
		if err := app.Listen(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Failed to start server", "error", err)
			os.Exit(1)
		}
	}()

	// Signal interception for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down auth service server...")
	
	// Fiber shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		slog.Error("Fiber shutdown failed", "error", err)
	} else {
		slog.Info("Fiber server shutdown completed successfully")
	}

	// Close Redis connection
	if config.RedisClient != nil {
		if err := config.RedisClient.Close(); err != nil {
			slog.Error("Redis connection close failed", "error", err)
		} else {
			slog.Info("Redis connection closed successfully")
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

	slog.Info("Auth service exited clean")
}
