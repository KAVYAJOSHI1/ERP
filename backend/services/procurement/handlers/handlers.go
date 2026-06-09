package handlers

import (
	"encoding/json"
	"time"

	"procurement-service/models"
	"procurement-service/telemetry"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

var DB *gorm.DB

type CreateVendorRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type CreatePOLineItemRequest struct {
	ProductID string  `json:"product_id"`
	Quantity  float64 `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type CreatePORequest struct {
	VendorID  string                    `json:"vendor_id"`
	Currency  string                    `json:"currency"`
	LineItems []CreatePOLineItemRequest `json:"line_items"`
}

type UpdatePOStatusRequest struct {
	Status string `json:"status"`
}

type PurchaseOrderCreatedPayload struct {
	POID          string    `json:"po_id"`
	VendorID      string    `json:"vendor_id"`
	TotalAmount   float64   `json:"total_amount"`
	CorrelationID string    `json:"correlation_id"`
	Timestamp     time.Time `json:"timestamp"`
}

func GetVendors(c *fiber.Ctx) error {
	var vendors []models.Vendor
	if err := DB.Find(&vendors).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch vendors"})
	}
	return c.JSON(vendors)
}

func CreateVendor(c *fiber.Ctx) error {
	var req CreateVendorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.Name == "" || req.Email == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Name and Email are required"})
	}

	vendor := models.Vendor{
		Name:             req.Name,
		Email:            req.Email,
		Contact:          req.Phone,
		PerformanceScore: 100.00,
		IsActive:         true,
	}

	if err := DB.Create(&vendor).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to create vendor"})
	}

	telemetry.VendorsCreatedTotal.Inc()
	return c.Status(201).JSON(vendor)
}

func GetPurchaseOrders(c *fiber.Ctx) error {
	var pos []models.PurchaseOrder
	if err := DB.Preload("Vendor").Order("created_at desc").Find(&pos).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch purchase orders"})
	}
	return c.JSON(pos)
}

func GetPurchaseOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	var po models.PurchaseOrder
	if err := DB.Preload("Vendor").Preload("LineItems").First(&po, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Not Found", "message": "Purchase order not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch purchase order details"})
	}
	return c.JSON(po)
}

func CreatePurchaseOrder(c *fiber.Ctx) error {
	var req CreatePORequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.VendorID == "" || len(req.LineItems) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Vendor ID and at least one line item are required"})
	}

	correlationID := c.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = "manual-po-no-trace"
	}

	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}

	var finalPO models.PurchaseOrder

	err := DB.Transaction(func(tx *gorm.DB) error {
		var totalAmount float64 = 0.0
		for _, item := range req.LineItems {
			totalAmount += item.Quantity * item.UnitPrice
		}

		po := models.PurchaseOrder{
			VendorID:      req.VendorID,
			Status:        "draft",
			TotalAmount:   totalAmount,
			Currency:      currency,
			CorrelationID: correlationID,
		}

		if err := tx.Create(&po).Error; err != nil {
			return err
		}

		for _, item := range req.LineItems {
			lineItem := models.POLineItem{
				POID:      po.ID,
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				UnitPrice: item.UnitPrice,
			}
			if err := tx.Create(&lineItem).Error; err != nil {
				return err
			}
		}

		payload := PurchaseOrderCreatedPayload{
			POID:          po.ID,
			VendorID:      po.VendorID,
			TotalAmount:   po.TotalAmount,
			CorrelationID: correlationID,
			Timestamp:     time.Now().UTC(),
		}

		jsonPayload, err := json.Marshal(payload)
		if err != nil {
			return err
		}

		outboxEvent := models.OutboxEvent{
			AggregateType: "PurchaseOrder",
			AggregateID:   po.ID,
			EventType:     "PurchaseOrderCreated",
			Payload:       json.RawMessage(jsonPayload),
			Published:     false,
		}

		if err := tx.Create(&outboxEvent).Error; err != nil {
			return err
		}

		finalPO = po
		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": err.Error()})
	}

	telemetry.PurchaseOrdersTotal.WithLabelValues("manual").Inc()

	DB.Preload("Vendor").Preload("LineItems").First(&finalPO, "id = ?", finalPO.ID)
	return c.Status(201).JSON(finalPO)
}

func UpdatePurchaseOrderStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var req UpdatePOStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	validStatuses := map[string]bool{
		"draft":          true,
		"approved":       true,
		"auto_generated": true,
		"sent":           true,
		"received":       true,
		"cancelled":      true,
	}

	if !validStatuses[req.Status] {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid status value"})
	}

	var po models.PurchaseOrder
	if err := DB.First(&po, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Not Found", "message": "Purchase order not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to look up PO"})
	}

	correlationID := c.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = "manual-po-update-no-trace"
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		po.Status = req.Status
		if err := tx.Save(&po).Error; err != nil {
			return err
		}

		payload := fiber.Map{
			"po_id":          po.ID,
			"vendor_id":      po.VendorID,
			"status":         po.Status,
			"total_amount":   po.TotalAmount,
			"correlation_id": correlationID,
			"timestamp":      time.Now().UTC(),
		}

		jsonPayload, err := json.Marshal(payload)
		if err != nil {
			return err
		}

		eventType := "PurchaseOrderUpdated"
		if po.Status == "received" {
			eventType = "PurchaseOrderReceived"
		}

		outboxEvent := models.OutboxEvent{
			AggregateType: "PurchaseOrder",
			AggregateID:   po.ID,
			EventType:     eventType,
			Payload:       json.RawMessage(jsonPayload),
			Published:     false,
		}

		return tx.Create(&outboxEvent).Error
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": err.Error()})
	}

	telemetry.PurchaseOrderStatusUpdatesTotal.WithLabelValues(req.Status).Inc()

	DB.Preload("Vendor").Preload("LineItems").First(&po, "id = ?", po.ID)
	return c.JSON(po)
}
