package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"backend/pkg/incident"
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
	// Mark this as an internal orchestration call so the inventory service does
	// not raise its own incident — the production service owns the escalation.
	req.Header.Set("X-Service-Origin", "production-service")
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

// productionRunView is a production run plus, when the run failed and was
// escalated, the linked IncidentAI incident and its current resolution status.
type productionRunView struct {
	models.ProductionRun
	Incident *incidentLinkView `json:"incident,omitempty"`
}

type incidentLinkView struct {
	IncidentID       string `json:"incident_id"`
	IncidentNumber   string `json:"incident_number"`
	IncidentStatus   string `json:"incident_status"`
	IncidentAIStatus string `json:"incident_ai_status,omitempty"`
	CorrelationID    string `json:"correlation_id"`
	ErrorMessage     string `json:"error_message"`
	Route            string `json:"route,omitempty"`
}

func GetProductionRuns(c *fiber.Ctx) error {
	var runs []models.ProductionRun
	if err := config.DB.Preload("BOM").Preload("WorkCenter").Order("created_at desc").Find(&runs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch production runs"})
	}

	ids := make([]string, 0, len(runs))
	for _, r := range runs {
		ids = append(ids, r.ID)
	}
	links, err := incident.GetByTransactionIDs(config.DB, ids)
	if err != nil {
		slog.Warn("could not load incident links for production runs", "error", err)
		links = nil
	}

	views := make([]productionRunView, 0, len(runs))
	for i := range runs {
		v := productionRunView{ProductionRun: runs[i]}
		if l, ok := links[runs[i].ID]; ok && l != nil {
			v.Incident = &incidentLinkView{
				IncidentID:       l.IncidentID,
				IncidentNumber:   l.IncidentNumber,
				IncidentStatus:   l.IncidentStatus,
				IncidentAIStatus: l.IncidentAIStatus,
				CorrelationID:    l.CorrelationID,
				ErrorMessage:     l.ErrorMessage,
				Route:            l.Route,
			}
		}
		views = append(views, v)
	}
	return c.JSON(views)
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

	// 3. Deduct raw materials from inventory. The warehouse is resolved from
	//    persisted inventory state, never a hard-coded UUID.
	warehouseID, err := ResolveWarehouseID(config.DB)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":          "Internal Server Error",
			"message":        fmt.Sprintf("Could not resolve production warehouse: %v", err),
			"correlation_id": correlationID,
		})
	}

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
	for idx, comp := range bom.Components {
		totalQtyRequired := comp.QuantityRequired * req.Quantity
		derr := adjustInventoryStock(
			comp.RawMaterialID,
			warehouseID,
			-totalQtyRequired,
			"production_consumption",
			correlationID, // Use correlationID as references
			correlationID,
		)
		if derr != nil {
			if idx > 0 {
				// A prior component was already deducted; compensation is out of
				// scope for this pass (see audit). The failed run row records it.
				slog.Warn("production run failed after partial material deduction",
					"correlation_id", correlationID, "deducted_components", idx)
			}

			// Persist the failed transaction so the incident has a real, linkable id.
			failedAt := time.Now()
			run.Status = "failed"
			run.CompletedAt = &failedAt
			if perr := config.DB.Create(&run).Error; perr != nil {
				slog.Error("failed to persist failed production run", "error", perr)
			}

			errMsg := fmt.Sprintf("Failed to deduct raw material: %v", derr)
			incView := escalateFailure(
				correlationID, run.ID, "production_run.create",
				comp.RawMaterialID, lookupSKU(comp.RawMaterialID), "/production", errMsg,
			)

			resp := fiber.Map{
				"error":          "Insufficient Materials",
				"message":        errMsg,
				"correlation_id": correlationID,
				"transaction_id": run.ID,
			}
			if incView != nil {
				resp["incident"] = incView
			}
			return c.Status(400).JSON(resp)
		}
	}

	// 4. Save Production Run to database
	if err := config.DB.Create(&run).Error; err != nil {
		// Attempt to refund deducted materials in a production-ready system (out of scope for this simple workflow)
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to record production run"})
	}

	return c.Status(201).JSON(run)
}
