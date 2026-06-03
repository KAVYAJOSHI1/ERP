package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"procurement-service/models"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StockUpdatedEventPayload struct {
	ProductID     string    `json:"product_id"`
	WarehouseID   string    `json:"warehouse_id"`
	Quantity      float64   `json:"quantity"`
	ReorderPoint  float64   `json:"reorder_point"`
	Delta         float64   `json:"delta"`
	CorrelationID string    `json:"correlation_id"`
	Timestamp     time.Time `json:"timestamp"`
}

type PurchaseOrderCreatedPayload struct {
	POID          string    `json:"po_id"`
	VendorID      string    `json:"vendor_id"`
	TotalAmount   float64   `json:"total_amount"`
	CorrelationID string    `json:"correlation_id"`
	Timestamp     time.Time `json:"timestamp"`
}

type StockConsumer struct {
	db     *gorm.DB
	reader *kafka.Reader
}

func NewStockConsumer(db *gorm.DB, brokers []string, groupID string) *StockConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     brokers,
		GroupID:     groupID,
		Topic:       "erp.inventory.stock-updated",
		MinBytes:    1,
		MaxBytes:    10e6, // 10MB
		StartOffset: kafka.FirstOffset,
	})
	return &StockConsumer{
		db:     db,
		reader: reader,
	}
}

func (c *StockConsumer) Start(ctx context.Context) {
	log.Println("[Procurement Consumer] Started listening to erp.inventory.stock-updated...")
	defer c.reader.Close()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Procurement Consumer] Stopping consumer loop...")
			return
		default:
			msg, err := c.reader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("[Procurement Consumer] Error reading message: %v", err)
				continue
			}

			c.handleMessage(ctx, msg)
		}
	}
}

func (c *StockConsumer) handleMessage(ctx context.Context, msg kafka.Message) {
	// 1. Extract Event ID for idempotency check
	var eventID string
	for _, h := range msg.Headers {
		if h.Key == "X-Event-ID" {
			eventID = string(h.Value)
			break
		}
	}

	// Fallback to a hash or UUID generated from offset if missing
	if eventID == "" {
		eventID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(fmt.Sprintf("%d-%d", msg.Partition, msg.Offset))).String()
	}

	// 2. Parse payload
	var payload StockUpdatedEventPayload
	if err := json.Unmarshal(msg.Value, &payload); err != nil {
		log.Printf("[Procurement Consumer] Failed to unmarshal payload: %v", err)
		return
	}

	log.Printf("[Procurement Consumer] Processing StockUpdated event. ProductID: %s, Qty: %.2f, ReorderPoint: %.2f, CorrelationID: %s",
		payload.ProductID, payload.Quantity, payload.ReorderPoint, payload.CorrelationID)

	// Check if reorder point is defined and stock is at or below it
	if payload.ReorderPoint <= 0 || payload.Quantity > payload.ReorderPoint {
		// No need to order stock, skip but mark event as processed to avoid re-evaluating
		c.markProcessed(eventID)
		return
	}

	// 3. Run processing inside DB transaction for atomic execution & idempotency
	err := c.db.Transaction(func(tx *gorm.DB) error {
		// Idempotency check: check if event was already processed
		var processed models.ProcessedEvent
		err := tx.First(&processed, "event_id = ?", eventID).Error
		if err == nil {
			log.Printf("[Procurement Consumer] Event %s already processed, skipping", eventID)
			return nil // commit transaction but do nothing
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}

		// Double-order check: Is there already a pending/auto-generated purchase order for this product?
		var count int64
		tx.Table("procurement.purchase_orders").
			Joins("JOIN procurement.po_line_items ON po_line_items.po_id = purchase_orders.id").
			Where("po_line_items.product_id = ? AND purchase_orders.status IN (?, ?, ?)",
				payload.ProductID, "draft", "approved", "auto_generated").
			Count(&count)

		if count > 0 {
			log.Printf("[Procurement Consumer] Product %s already has an active purchase order pending. Skipping auto-order.", payload.ProductID)
			// Still save processed event so we don't process it again
			return tx.Create(&models.ProcessedEvent{
				EventID:     eventID,
				ProcessedAt: time.Now().UTC(),
			}).Error
		}

		// Find best active vendor (highest performance score)
		var vendor models.Vendor
		err = tx.Where("is_active = true").Order("performance_score desc").First(&vendor).Error
		if err != nil {
			log.Printf("[Procurement Consumer] No active vendors found to order product %s from!", payload.ProductID)
			// Skip creating PO but mark processed
			return tx.Create(&models.ProcessedEvent{
				EventID:     eventID,
				ProcessedAt: time.Now().UTC(),
			}).Error
		}

		// Determine unit price from quotations if available, else default to 15.00
		var quotation models.Quotation
		unitPrice := 15.00
		err = tx.Where("vendor_id = ? AND product_id = ? AND valid_until > ?", vendor.ID, payload.ProductID, time.Now()).
			Order("created_at desc").First(&quotation).Error
		if err == nil {
			unitPrice = quotation.UnitPrice
		}

		// Calculate order quantity
		orderQty := (payload.ReorderPoint * 2) - payload.Quantity
		if orderQty <= 0 {
			orderQty = 100.0 // Default order size fallback
		}

		totalAmount := orderQty * unitPrice

		// Create PO
		po := models.PurchaseOrder{
			VendorID:      vendor.ID,
			Status:        "auto_generated",
			TotalAmount:   totalAmount,
			Currency:      "USD",
			CorrelationID: payload.CorrelationID,
		}
		if err := tx.Create(&po).Error; err != nil {
			return err
		}

		// Create Line Item
		lineItem := models.POLineItem{
			POID:      po.ID,
			ProductID: payload.ProductID,
			Quantity:  orderQty,
			UnitPrice: unitPrice,
		}
		if err := tx.Create(&lineItem).Error; err != nil {
			return err
		}

		// Write PO Created Outbox Event
		poCreatedPayload := PurchaseOrderCreatedPayload{
			POID:          po.ID,
			VendorID:      po.VendorID,
			TotalAmount:   po.TotalAmount,
			CorrelationID: payload.CorrelationID,
			Timestamp:     time.Now().UTC(),
		}

		jsonPayload, err := json.Marshal(poCreatedPayload)
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

		// Mark event as processed in same transaction
		processedEvent := models.ProcessedEvent{
			EventID:     eventID,
			ProcessedAt: time.Now().UTC(),
		}
		if err := tx.Create(&processedEvent).Error; err != nil {
			return err
		}

		log.Printf("[Procurement Consumer] Automatically generated PO %s for Product %s (Qty: %.2f, Total: %.2f %s) with Vendor %s",
			po.ID, payload.ProductID, orderQty, totalAmount, po.Currency, vendor.Name)

		return nil
	})

	if err != nil {
		log.Printf("[Procurement Consumer] Error processing event transaction: %v", err)
	}
}

func (c *StockConsumer) markProcessed(eventID string) {
	processed := models.ProcessedEvent{
		EventID:     eventID,
		ProcessedAt: time.Now().UTC(),
	}
	// Use ON CONFLICT DO NOTHING to ensure safety
	c.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&processed)
}
