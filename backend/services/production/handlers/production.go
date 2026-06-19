package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"production-service/config"
	"production-service/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type CreateWCRequest struct {
	Name     string  `json:"name"`
	Capacity float64 `json:"capacity"`
	Status   string  `json:"status"`
}

type CreateBOMComponent struct {
	RawMaterialID    string  `json:"raw_material_id"`
	QuantityRequired float64 `json:"quantity_required"`
}

type CreateBOMRequest struct {
	ProductID  string               `json:"product_id"`
	Name       string               `json:"name"`
	Version    string               `json:"version"`
	Components []CreateBOMComponent `json:"components"`
}

type CreateRunRequest struct {
	BOMID        string  `json:"bom_id"`
	WorkCenterID string  `json:"work_center_id"`
	Quantity     float64 `json:"quantity"`
}

var INVENTORY_SERVICE_URL = os.Getenv("INVENTORY_SERVICE_URL")

func init() {
	if INVENTORY_SERVICE_URL == "" {
		INVENTORY_SERVICE_URL = "http://localhost:8081"
	}
}

// Helper function to call the Inventory Service for stock adjustments
func adjustInventoryStock(productID, warehouseID string, delta float64, adjustType, referenceID, correlationID string) error {
	url := fmt.Sprintf("%s/inventory/stock/adjust", INVENTORY_SERVICE_URL)

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
		return fmt.Errorf("inventory service communication failure: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("inventory adjustment failed (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

func GetWorkCenters(c *fiber.Ctx) error {
	var wcs []models.WorkCenter
	if err := config.DB.Find(&wcs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch work centers"})
	}
	return c.JSON(wcs)
}

func CreateWorkCenter(c *fiber.Ctx) error {
	var req CreateWCRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	wc := models.WorkCenter{
		Name:     req.Name,
		Capacity: req.Capacity,
		Status:   req.Status,
	}
	if wc.Status == "" {
		wc.Status = "active"
	}

	if err := config.DB.Create(&wc).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to create work center"})
	}
	return c.Status(210).JSON(wc)
}

func GetBOMs(c *fiber.Ctx) error {
	var boms []models.BillOfMaterials
	if err := config.DB.Preload("Components").Find(&boms).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch BOMs"})
	}
	return c.JSON(boms)
}

func CreateBOM(c *fiber.Ctx) error {
	var req CreateBOMRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	bom := models.BillOfMaterials{
		ProductID: req.ProductID,
		Name:      req.Name,
		Version:   req.Version,
	}
	if bom.Version == "" {
		bom.Version = "1.0"
	}

	err := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&bom).Error; err != nil {
			return err
		}

		for _, comp := range req.Components {
			cModel := models.BOMComponent{
				BOMID:            bom.ID,
				RawMaterialID:    comp.RawMaterialID,
				QuantityRequired: comp.QuantityRequired,
			}
			if err := tx.Create(&cModel).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to save BOM"})
	}

	// Reload with components
	config.DB.Preload("Components").First(&bom, "id = ?", bom.ID)
	return c.Status(201).JSON(bom)
}

func GetProductionRuns(c *fiber.Ctx) error {
	var runs []models.ProductionRun
	if err := config.DB.Preload("BOM").Preload("WorkCenter").Order("created_at desc").Find(&runs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch production runs"})
	}
	return c.JSON(runs)
}

func CreateProductionRun(c *fiber.Ctx) error {
	var req CreateRunRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	correlationID := c.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = fmt.Sprintf("prod-run-%d", time.Now().UnixNano())
	}

	// 1. Fetch BOM and Components
	var bom models.BillOfMaterials
	if err := config.DB.Preload("Components").First(&bom, "id = ?", req.BOMID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not Found", "message": "Bill of Materials not found"})
	}

	// 2. Fetch Work Center
	var wc models.WorkCenter
	if err := config.DB.First(&wc, "id = ?", req.WorkCenterID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not Found", "message": "Work Center not found"})
	}
	if wc.Status == "maintenance" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Work center is in maintenance"})
	}

	// 3. Deduct raw materials from inventory (Warehouse ID: d9336520-cdb8-4cf8-b0b3-87da46820efc)
	warehouseID := "d9336520-cdb8-4cf8-b0b3-87da46820efc"
	
	run := models.ProductionRun{
		BOMID:         req.BOMID,
		WorkCenterID:  req.WorkCenterID,
		Quantity:      req.Quantity,
		Status:        "in_progress",
		CorrelationID: correlationID,
	}

	now := time.Now()
	run.StartedAt = &now

	// Call stock deduction for each component
	for _, comp := range bom.Components {
		totalQtyRequired := comp.QuantityRequired * req.Quantity
		err := adjustInventoryStock(
			comp.RawMaterialID,
			warehouseID,
			-totalQtyRequired,
			"production_consumption",
			correlationID, // Use correlationID as references
			correlationID,
		)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error":   "Insufficient Materials",
				"message": fmt.Sprintf("Failed to deduct raw material: %v", err),
			})
		}
	}

	// 4. Save Production Run to database
	if err := config.DB.Create(&run).Error; err != nil {
		// Attempt to refund deducted materials in a production-ready system (out of scope for this simple workflow)
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to record production run"})
	}

	return c.Status(201).JSON(run)
}
