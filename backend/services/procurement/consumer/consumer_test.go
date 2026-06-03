package consumer

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"procurement-service/models"

	pkgKafka "backend/pkg/kafka"
	"backend/pkg/outbox"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestE2EMessageFlow(t *testing.T) {
	dsn := "host=localhost user=erp_user password=erp_password dbname=erp_db port=5435 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to Postgres: %v", err)
	}

	// 1. Setup mock product
	productID := uuid.New().String()
	err = db.Exec("INSERT INTO inventory.products (id, sku, name, unit, category, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		productID, "TEST-SKU-999", "Test Widget", "pieces", "Raw Materials", "Integration test widget", time.Now(), time.Now()).Error
	if err != nil {
		t.Fatalf("Failed to create mock product: %v", err)
	}
	defer db.Exec("DELETE FROM inventory.products WHERE id = ?", productID)

	// 2. Setup mock stock level
	stockLevelID := uuid.New().String()
	warehouseID := "d9336520-cdb8-4cf8-b0b3-87da46820efc"
	err = db.Exec("INSERT INTO inventory.stock_levels (id, product_id, warehouse_id, quantity, reserved_qty, reorder_point, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		stockLevelID, productID, warehouseID, 5.0, 0.0, 20.0, time.Now(), time.Now()).Error
	if err != nil {
		t.Fatalf("Failed to create mock stock level: %v", err)
	}
	defer db.Exec("DELETE FROM inventory.stock_levels WHERE id = ?", stockLevelID)

	// 3. Write event to inventory outbox
	corrID := "test-correlation-id-999"
	eventPayload := map[string]interface{}{
		"product_id":     productID,
		"warehouse_id":   warehouseID,
		"quantity":       5.0,
		"reorder_point":  20.0,
		"delta":          -15.0,
		"correlation_id": corrID,
		"timestamp":      time.Now().UTC(),
	}
	payloadBytes, _ := json.Marshal(eventPayload)

	outboxEventID := uuid.New().String()
	err = db.Exec("INSERT INTO inventory.outbox_events (id, aggregate_type, aggregate_id, event_type, payload, published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		outboxEventID, "StockLevel", stockLevelID, "StockUpdated", payloadBytes, false, time.Now()).Error
	if err != nil {
		t.Fatalf("Failed to write mock outbox event: %v", err)
	}
	defer db.Exec("DELETE FROM inventory.outbox_events WHERE id = ?", outboxEventID)

	// 4. Start Outbox relay worker in goroutine
	brokers := []string{"localhost:9092"}
	producer := pkgKafka.NewProducer(brokers)
	defer producer.Close()

	topicMap := map[string]string{
		"StockUpdated": "erp.inventory.stock-updated",
	}

	relay := outbox.NewRelayWorker(db, producer, "inventory-service-test", "inventory.outbox_events", topicMap)
	ctxRelay, cancelRelay := context.WithCancel(context.Background())
	go relay.Start(ctxRelay, 100*time.Millisecond)

	// Wait for event to publish
	time.Sleep(2 * time.Second)
	cancelRelay()

	// 5. Run the Stock Consumer
	dbProc, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "procurement.",
			SingularTable: false,
		},
	})
	if err != nil {
		t.Fatalf("Failed to connect procurement schema DB: %v", err)
	}

	// Clean processed events table just in case
	dbProc.Exec("DELETE FROM procurement.processed_events WHERE event_id = ?", outboxEventID)

	cons := NewStockConsumer(dbProc, brokers, "procurement-test-group-"+uuid.New().String())
	ctxCons, cancelCons := context.WithCancel(context.Background())
	go cons.Start(ctxCons)

	// Wait for consumption and PO creation (Kafka consumer group join & partition assignment takes time)
	time.Sleep(6 * time.Second)
	cancelCons()

	// 6. Assert PO creation
	var po models.PurchaseOrder
	err = dbProc.Preload("LineItems").
		Joins("JOIN procurement.po_line_items ON po_line_items.po_id = purchase_orders.id").
		Where("po_line_items.product_id = ?", productID).
		First(&po).Error
	if err != nil {
		t.Fatalf("Failed to find generated Purchase Order: %v", err)
	}

	t.Logf("Successfully verified generated PO! ID: %s, Status: %s, Total: %.2f", po.ID, po.Status, po.TotalAmount)

	if po.Status != "auto_generated" {
		t.Errorf("Expected status auto_generated, got %s", po.Status)
	}
	if len(po.LineItems) != 1 || po.LineItems[0].ProductID != productID {
		t.Errorf("Line items mapping mismatch or empty")
	}

	// Clean up PO records
	dbProc.Exec("DELETE FROM procurement.po_line_items WHERE po_id = ?", po.ID)
	dbProc.Exec("DELETE FROM procurement.purchase_orders WHERE id = ?", po.ID)
	dbProc.Exec("DELETE FROM procurement.processed_events WHERE event_id = ?", outboxEventID)
}
