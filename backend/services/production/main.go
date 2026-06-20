package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/pkg/database"
	"backend/pkg/logger"
	"production-service/config"
	"production-service/handlers"
	"production-service/models"

	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	// Initialize structured logger
	logger.InitJSONLogger("production-service")

	// Try loading env files from various relative locations
	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	config.ConnectDB()

	ctx, cancel := context.WithCancel(context.Background())

	// Launch shop floor simulation background worker
	go startShopFloorSimulationWorker(ctx)

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

	prometheus := fiberprometheus.New("production-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		dbErr := database.Ping(config.DB)
		if dbErr != nil {
			return c.Status(503).JSON(fiber.Map{
				"status":  "DOWN",
				"service": "production-service",
				"details": fiber.Map{
					"database": false,
				},
			})
		}
		return c.JSON(fiber.Map{
			"status":  "UP",
			"service": "production-service",
		})
	})

	// Service Routes
	app.Get("/production/wc", handlers.GetWorkCenters)
	app.Post("/production/wc", handlers.CreateWorkCenter)
	app.Get("/production/bom", handlers.GetBOMs)
	app.Post("/production/bom", handlers.CreateBOM)
	app.Get("/production/runs", handlers.GetProductionRuns)
	app.Post("/production/runs", handlers.CreateProductionRun)

	port := os.Getenv("PRODUCTION_SERVICE_PORT")
	if port == "" {
		port = "8085"
	}

	// Listen in a goroutine
	go func() {
		slog.Info("Production service listening", "port", port)
		if err := app.Listen(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Failed to start server", "error", err)
			os.Exit(1)
		}
	}()

	// Signal interception for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down production service server...")
	cancel() // Stops background shop floor simulation worker loop

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

	slog.Info("Production service exited clean")
}

// Background simulation worker to transition production runs from in_progress -> completed
// and deposit finished yield goods into inventory.
func startShopFloorSimulationWorker(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Default yield completion time: 30 seconds for quick local testing/verification
	const runDuration = 30 * time.Second
	warehouseID := "d9336520-cdb8-4cf8-b0b3-87da46820efc"

	slog.Info("Shop floor simulation worker active")

	for {
		select {
		case <-ctx.Done():
			slog.Info("Shop floor simulation worker stopping due to context cancel...")
			return
		case <-ticker.C:
			if config.DB == nil {
				continue
			}

			var runs []models.ProductionRun
			err := config.DB.Preload("BOM").Where("status = ?", "in_progress").Find(&runs).Error
			if err != nil {
				slog.Error("Failed to scan active runs in shop floor worker", "error", err)
				continue
			}

			for _, run := range runs {
				if run.StartedAt == nil {
					continue
				}

				elapsed := time.Since(*run.StartedAt)
				if elapsed >= runDuration {
					now := time.Now()

					err := config.DB.Transaction(func(tx *gorm.DB) error {
						// Atomic update to avoid double-processing across replicas
						res := tx.Model(&models.ProductionRun{}).
							Where("id = ? AND status = ?", run.ID, "in_progress").
							Updates(map[string]interface{}{
								"status":       "completed",
								"completed_at": &now,
							})
						if res.Error != nil {
							return res.Error
						}
						if res.RowsAffected == 0 {
							return fmt.Errorf("already processed or completed")
						}

						// Yield yield goods back to inventory stock!
						if run.BOM != nil {
							err := creditInventoryStock(
								run.BOM.ProductID,
								warehouseID,
								run.Quantity,
								"production_yield",
								run.CorrelationID,
								run.CorrelationID,
							)
							if err != nil {
								return fmt.Errorf("failed to deposit yielded goods: %w", err)
							}
						}
						return nil
					})

					if err != nil {
						slog.Error("Failed to complete run", "run_id", run.ID, "error", err)
					} else {
						slog.Info("Run completed. Yielded units to inventory", "run_id", run.ID, "quantity", run.Quantity)
					}
				}
			}
		}
	}
}

func creditInventoryStock(productID, warehouseID string, delta float64, adjustType, referenceID, correlationID string) error {
	invURL := os.Getenv("INVENTORY_SERVICE_URL")
	if invURL == "" {
		invURL = "http://localhost:8081"
	}
	url := fmt.Sprintf("%s/inventory/stock/adjust", invURL)

	payload := map[string]interface{}{
		"product_id":   productID,
		"warehouse_id": warehouseID,
		"delta":        delta,
		"type":         adjustType,
		"reference_id": referenceID,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if correlationID != "" {
		req.Header.Set("X-Correlation-ID", correlationID)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("inventory credit failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}
