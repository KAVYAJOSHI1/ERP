package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"production-service/config"
	"production-service/handlers"
	"production-service/models"

	"gorm.io/gorm"
	"github.com/ansrivas/fiberprometheus/v2"
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

	// Launch shop floor simulation background worker
	go startShopFloorSimulationWorker()

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

	prometheus := fiberprometheus.New("production-service")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
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

	log.Printf("Production service listening on port %s", port)
	log.Fatal(app.Listen(":" + port))
}

// Background simulation worker to transition production runs from in_progress -> completed
// and deposit finished yield goods into inventory.
func startShopFloorSimulationWorker() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Default yield completion time: 30 seconds for quick local testing/verification
	const runDuration = 30 * time.Second
	warehouseID := "d9336520-cdb8-4cf8-b0b3-87da46820efc"

	log.Println("Shop floor simulation worker active")

	for range ticker.C {
		if config.DB == nil {
			continue
		}

		var runs []models.ProductionRun
		err := config.DB.Preload("BOM").Where("status = ?", "in_progress").Find(&runs).Error
		if err != nil {
			log.Printf("[Worker Error] Failed to scan active runs: %v", err)
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
					log.Printf("[Worker Action] Failed to complete run %s: %v", run.ID, err)
				} else {
					log.Printf("[Worker Action] Run %s completed. Yielded %f units to inventory.", run.ID, run.Quantity)
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


