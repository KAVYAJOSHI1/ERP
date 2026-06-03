package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"finance-service/models"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/segmentio/kafka-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestFinanceConsumerE2E(t *testing.T) {
	// Connect to DB
	dsn := "host=localhost user=erp_user password=erp_password dbname=erp_db port=5435 sslmode=disable TimeZone=UTC"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "finance.",
			SingularTable: false,
		},
	})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Connect to MinIO
	endpoint := "localhost:9000"
	accessKeyID := "minio_admin"
	secretAccessKey := "minio_password"
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: false,
	})
	if err != nil {
		t.Fatalf("Failed to initialize MinIO client: %v", err)
	}

	// 1. Setup mock PO payload
	poID := uuid.New().String()
	vendorID := uuid.New().String()
	amount := 525.00
	corrID := "test-finance-corr-999"

	payload := PurchaseOrderCreatedPayload{
		POID:          poID,
		VendorID:      vendorID,
		TotalAmount:   amount,
		CorrelationID: corrID,
		Timestamp:     time.Now().UTC(),
	}

	payloadBytes, _ := json.Marshal(payload)

	// Since we are not triggering from Kafka directly in this simple E2E, 
	// we will manually construct the Kafka message and call handleMessage to bypass kafka queueing delays.
	// This tests the processing, MinIO upload, and ledgering logic directly.

	msg := kafka.Message{
		Partition: 0,
		Offset:    1,
		Value:     payloadBytes,
		Headers: []kafka.Header{
			{Key: "X-Event-ID", Value: []byte(uuid.New().String())},
		},
	}

	// 2. Initialize consumer (we don't start the loop, just use its handleMessage method)
	c := &FinanceConsumer{
		db:          db,
		minioClient: minioClient,
		bucketName:  "erp-invoices",
	}

	// 3. Process Message
	c.handleMessage(context.Background(), msg)

	// 4. Verify MinIO Upload
	objectName := fmt.Sprintf("invoice-%s.pdf", poID)
	_, err = minioClient.StatObject(context.Background(), c.bucketName, objectName, minio.StatObjectOptions{})
	if err != nil {
		t.Fatalf("Failed to find uploaded PDF in MinIO: %v", err)
	}
	t.Logf("Successfully verified PDF invoice uploaded to MinIO: %s", objectName)

	// 5. Verify Invoice Record
	var invoice models.Invoice
	if err := db.Where("po_id = ?", poID).First(&invoice).Error; err != nil {
		t.Fatalf("Failed to find Invoice record: %v", err)
	}
	if invoice.Amount != amount {
		t.Errorf("Invoice amount mismatch. Expected %.2f, got %.2f", amount, invoice.Amount)
	}
	t.Logf("Successfully verified Invoice DB record: ID %s, URL: %s", invoice.ID, invoice.PdfURL)

	// 6. Verify Double-Entry Ledger Bookkeeping
	var entries []models.LedgerEntry
	if err := db.Where("reference_id = ?", poID).Find(&entries).Error; err != nil {
		t.Fatalf("Failed to query ledger entries: %v", err)
	}

	if len(entries) != 2 {
		t.Fatalf("Expected exactly 2 ledger entries (debit and credit), found %d", len(entries))
	}

	totalDebit := 0.0
	totalCredit := 0.0
	for _, e := range entries {
		totalDebit += e.Debit
		totalCredit += e.Credit
	}

	if totalDebit != totalCredit {
		t.Fatalf("Ledger unbalanced! Total Debit: %.2f, Total Credit: %.2f", totalDebit, totalCredit)
	}
	if totalDebit != amount {
		t.Fatalf("Ledger amount mismatch! Expected %.2f, got %.2f", amount, totalDebit)
	}

	t.Logf("Successfully verified balanced double-entry ledger! Debit: %.2f, Credit: %.2f", totalDebit, totalCredit)

	// 7. Cleanup
	db.Exec("DELETE FROM finance.ledger_entries WHERE reference_id = ?", poID)
	db.Exec("DELETE FROM finance.invoices WHERE po_id = ?", poID)
	db.Exec("DELETE FROM finance.processed_events WHERE event_id = ?", string(msg.Headers[0].Value))
	minioClient.RemoveObject(context.Background(), c.bucketName, objectName, minio.RemoveObjectOptions{})
}
