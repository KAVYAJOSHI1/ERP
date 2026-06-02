package handlers

import (
	"encoding/json"
	"time"

	"inventory-service/config"
	"inventory-service/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type CreateProductRequest struct {
	SKU         string `json:"sku"`
	Name        string `json:"name"`
	Unit        string `json:"unit"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

type CreateWarehouseRequest struct {
	Name     string  `json:"name"`
	Location string  `json:"location"`
	Capacity float64 `json:"capacity"`
}

type SetReorderPointRequest struct {
	ProductID    string  `json:"product_id"`
	WarehouseID  string  `json:"warehouse_id"`
	ReorderPoint float64 `json:"reorder_point"`
}

type AdjustStockRequest struct {
	ProductID   string  `json:"product_id"`
	WarehouseID string  `json:"warehouse_id"`
	Delta       float64 `json:"delta"`
	Type        string  `json:"type"` // incoming, outgoing, adjustment, reservation
	ReferenceID string  `json:"reference_id"`
}

type StockUpdatedEventPayload struct {
	ProductID     string    `json:"product_id"`
	WarehouseID   string    `json:"warehouse_id"`
	Quantity      float64   `json:"quantity"`
	ReorderPoint  float64   `json:"reorder_point"`
	Delta         float64   `json:"delta"`
	CorrelationID string    `json:"correlation_id"`
	Timestamp     time.Time `json:"timestamp"`
}

func GetProducts(c *fiber.Ctx) error {
	var products []models.Product
	if err := config.DB.Find(&products).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch products"})
	}
	return c.JSON(products)
}

func CreateProduct(c *fiber.Ctx) error {
	var req CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.SKU == "" || req.Name == "" || req.Unit == "" || req.Category == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "SKU, Name, Unit, and Category are required"})
	}

	product := models.Product{
		SKU:         req.SKU,
		Name:        req.Name,
		Unit:        req.Unit,
		Category:    req.Category,
		Description: req.Description,
	}

	if err := config.DB.Create(&product).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to create product"})
	}

	return c.Status(201).JSON(product)
}

func GetWarehouses(c *fiber.Ctx) error {
	var warehouses []models.Warehouse
	if err := config.DB.Find(&warehouses).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch warehouses"})
	}
	return c.JSON(warehouses)
}

func CreateWarehouse(c *fiber.Ctx) error {
	var req CreateWarehouseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Name is required"})
	}

	warehouse := models.Warehouse{
		Name:     req.Name,
		Location: req.Location,
		Capacity: req.Capacity,
	}

	if err := config.DB.Create(&warehouse).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to create warehouse"})
	}

	return c.Status(201).JSON(warehouse)
}

func GetStockLevels(c *fiber.Ctx) error {
	var stockLevels []models.StockLevel
	
	// Query params to filter
	productID := c.Query("product_id")
	warehouseID := c.Query("warehouse_id")

	query := config.DB
	if productID != "" {
		query = query.Where("product_id = ?", productID)
	}
	if warehouseID != "" {
		query = query.Where("warehouse_id = ?", warehouseID)
	}

	if err := query.Find(&stockLevels).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch stock levels"})
	}

	return c.JSON(stockLevels)
}

func SetReorderPoint(c *fiber.Ctx) error {
	var req SetReorderPointRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.ProductID == "" || req.WarehouseID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Product ID and Warehouse ID are required"})
	}

	var stockLevel models.StockLevel
	err := config.DB.Where("product_id = ? AND warehouse_id = ?", req.ProductID, req.WarehouseID).First(&stockLevel).Error
	
	if err == gorm.ErrRecordNotFound {
		stockLevel = models.StockLevel{
			ProductID:    req.ProductID,
			WarehouseID:  req.WarehouseID,
			Quantity:     0,
			ReservedQty:  0,
			ReorderPoint: req.ReorderPoint,
		}
		if err := config.DB.Create(&stockLevel).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to create stock level record"})
		}
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to lookup stock level"})
	} else {
		stockLevel.ReorderPoint = req.ReorderPoint
		if err := config.DB.Save(&stockLevel).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to update reorder point"})
		}
	}

	return c.JSON(stockLevel)
}

// AdjustStock performs pessimistic SELECT FOR UPDATE to prevent race conditions during concurrent stock updates,
// and saves an atomic event payload in the transactional outbox table.
func AdjustStock(c *fiber.Ctx) error {
	var req AdjustStockRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.ProductID == "" || req.WarehouseID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Product ID and Warehouse ID are required"})
	}

	correlationID := c.Get("X-Correlation-ID") // passed from gateway
	if correlationID == "" {
		correlationID = "manual-adjust-no-trace"
	}

	var finalStockLevel models.StockLevel

	// Begin ACID transaction
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		var stockLevel models.StockLevel

		// 1. Pessimistic lock row for product+warehouse (SELECT FOR UPDATE)
		err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("product_id = ? AND warehouse_id = ?", req.ProductID, req.WarehouseID).
			First(&stockLevel).Error

		if err == gorm.ErrRecordNotFound {
			// Initialize new stock level
			stockLevel = models.StockLevel{
				ProductID:    req.ProductID,
				WarehouseID:  req.WarehouseID,
				Quantity:     0,
				ReservedQty:  0,
				ReorderPoint: 0,
			}
			if err := tx.Create(&stockLevel).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		// Validate stock wouldn't go negative on shipments
		if stockLevel.Quantity+req.Delta < 0 {
			return fiber.NewError(400, "Insufficient stock: cannot make inventory level negative")
		}

		// 2. Adjust level
		stockLevel.Quantity += req.Delta
		if err := tx.Save(&stockLevel).Error; err != nil {
			return err
		}

		finalStockLevel = stockLevel

		// 3. Record Audit Transaction Trail
		transaction := models.StockTransaction{
			ProductID:     req.ProductID,
			WarehouseID:   req.WarehouseID,
			Delta:         req.Delta,
			Type:          req.Type,
			ReferenceID:   req.ReferenceID,
			CorrelationID: correlationID,
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		// 4. Construct Event Payload for Outbox
		eventPayload := StockUpdatedEventPayload{
			ProductID:     req.ProductID,
			WarehouseID:   req.WarehouseID,
			Quantity:      stockLevel.Quantity,
			ReorderPoint:  stockLevel.ReorderPoint,
			Delta:         req.Delta,
			CorrelationID: correlationID,
			Timestamp:     time.Now().UTC(),
		}

		jsonPayload, err := json.Marshal(eventPayload)
		if err != nil {
			return err
		}

		// 5. Write to transactional outbox
		outboxEvent := models.OutboxEvent{
			AggregateType: "StockLevel",
			AggregateID:   stockLevel.ID,
			EventType:     "StockUpdated",
			Payload:       json.RawMessage(jsonPayload),
			Published:     false,
		}

		if err := tx.Create(&outboxEvent).Error; err != nil {
			return err
		}

		return nil // commit both writes atomically
	})

	if err != nil {
		if fiberErr, ok := err.(*fiber.Error); ok {
			return c.Status(fiberErr.Code).JSON(fiber.Map{"error": "Bad Request", "message": fiberErr.Message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":     "Stock level adjusted successfully",
		"stock_level": finalStockLevel,
	})
}
