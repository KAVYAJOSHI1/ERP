package consumer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"finance-service/models"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/phpdave11/gofpdf"
	"github.com/segmentio/kafka-go"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PurchaseOrderCreatedPayload struct {
	POID          string    `json:"po_id"`
	VendorID      string    `json:"vendor_id"`
	TotalAmount   float64   `json:"total_amount"`
	CorrelationID string    `json:"correlation_id"`
	Timestamp     time.Time `json:"timestamp"`
}

type FinanceConsumer struct {
	db          *gorm.DB
	reader      *kafka.Reader
	minioClient *minio.Client
	bucketName  string
}

func NewFinanceConsumer(db *gorm.DB, brokers []string) *FinanceConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     brokers,
		GroupID:     "finance-service-group",
		Topic:       "erp.procurement.po-created",
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kafka.FirstOffset,
	})

	// Initialize MinIO client
	endpoint := "localhost:9000"
	accessKeyID := "minio_admin"
	secretAccessKey := "minio_password"
	useSSL := false

	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Fatalf("Failed to initialize MinIO client: %v", err)
	}

	return &FinanceConsumer{
		db:          db,
		reader:      reader,
		minioClient: minioClient,
		bucketName:  "erp-invoices",
	}
}

func (c *FinanceConsumer) Start(ctx context.Context) {
	log.Println("[Finance Consumer] Started listening to erp.procurement.po-created...")
	defer c.reader.Close()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Finance Consumer] Stopping consumer loop...")
			return
		default:
			msg, err := c.reader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("[Finance Consumer] Error reading message: %v", err)
				continue
			}

			c.handleMessage(ctx, msg)
		}
	}
}

func (c *FinanceConsumer) handleMessage(ctx context.Context, msg kafka.Message) {
	var eventID string
	for _, h := range msg.Headers {
		if h.Key == "X-Event-ID" {
			eventID = string(h.Value)
			break
		}
	}

	if eventID == "" {
		eventID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(fmt.Sprintf("%d-%d", msg.Partition, msg.Offset))).String()
	}

	var payload PurchaseOrderCreatedPayload
	if err := json.Unmarshal(msg.Value, &payload); err != nil {
		log.Printf("[Finance Consumer] Failed to unmarshal payload: %v", err)
		return
	}

	log.Printf("[Finance Consumer] Processing PO Created event. POID: %s, Amount: %.2f", payload.POID, payload.TotalAmount)

	err := c.db.Transaction(func(tx *gorm.DB) error {
		var processed models.ProcessedEvent
		err := tx.First(&processed, "event_id = ?", eventID).Error
		if err == nil {
			log.Printf("[Finance Consumer] Event %s already processed, skipping", eventID)
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}

		// 1. Generate PDF Invoice
		pdfBuf := generatePDFInvoice(payload)
		
		// 2. Upload to MinIO
		objectName := fmt.Sprintf("invoice-%s.pdf", payload.POID)
		_, err = c.minioClient.PutObject(ctx, c.bucketName, objectName, bytes.NewReader(pdfBuf.Bytes()), int64(pdfBuf.Len()), minio.PutObjectOptions{
			ContentType: "application/pdf",
		})
		if err != nil {
			log.Printf("[Finance Consumer] Failed to upload PDF to MinIO: %v", err)
			return err
		}

		pdfURL := fmt.Sprintf("http://localhost:9000/%s/%s", c.bucketName, objectName)

		// 3. Create Invoice Record
		invoice := models.Invoice{
			POID:   payload.POID,
			Amount: payload.TotalAmount,
			Status: "pending",
			PdfURL: pdfURL,
		}
		if err := tx.Create(&invoice).Error; err != nil {
			return err
		}

		// 4. Double-Entry Bookkeeping
		// Fetch Accounts (Pessimistic lock)
		var apAccount, invAccount models.Account
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("name = ?", "Accounts Payable").First(&apAccount).Error; err != nil {
			return fmt.Errorf("Accounts Payable not found: %w", err)
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("name = ?", "Raw Materials Inventory").First(&invAccount).Error; err != nil {
			return fmt.Errorf("Raw Materials Inventory not found: %w", err)
		}

		// Credit AP (Liability increases)
		apEntry := models.LedgerEntry{
			AccountID:     apAccount.ID,
			Credit:        payload.TotalAmount,
			Debit:         0,
			Description:   fmt.Sprintf("Invoice generated for PO %s", payload.POID),
			ReferenceID:   payload.POID,
			CorrelationID: payload.CorrelationID,
		}
		apAccount.Balance += payload.TotalAmount

		// Debit Inventory (Asset increases)
		invEntry := models.LedgerEntry{
			AccountID:     invAccount.ID,
			Debit:         payload.TotalAmount,
			Credit:        0,
			Description:   fmt.Sprintf("Raw materials received for PO %s", payload.POID),
			ReferenceID:   payload.POID,
			CorrelationID: payload.CorrelationID,
		}
		invAccount.Balance += payload.TotalAmount

		if err := tx.Create(&apEntry).Error; err != nil {
			return err
		}
		if err := tx.Save(&apAccount).Error; err != nil {
			return err
		}

		if err := tx.Create(&invEntry).Error; err != nil {
			return err
		}
		if err := tx.Save(&invAccount).Error; err != nil {
			return err
		}

		// 5. Mark Event Processed
		processedEvent := models.ProcessedEvent{
			EventID:     eventID,
			ProcessedAt: time.Now().UTC(),
		}
		if err := tx.Create(&processedEvent).Error; err != nil {
			return err
		}

		log.Printf("[Finance Consumer] Successfully processed PO %s: Generated invoice %s and updated ledger.", payload.POID, objectName)
		return nil
	})

	if err != nil {
		log.Printf("[Finance Consumer] Transaction failed: %v", err)
	}
}

func generatePDFInvoice(payload PurchaseOrderCreatedPayload) *bytes.Buffer {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "COMMERCIAL INVOICE")
	pdf.Ln(10)

	pdf.SetFont("Arial", "", 12)
	pdf.Cell(40, 10, fmt.Sprintf("Purchase Order ID: %s", payload.POID))
	pdf.Ln(8)
	pdf.Cell(40, 10, fmt.Sprintf("Vendor ID: %s", payload.VendorID))
	pdf.Ln(8)
	pdf.Cell(40, 10, fmt.Sprintf("Date Issued: %s", payload.Timestamp.Format("2006-01-02 15:04:05")))
	pdf.Ln(15)

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(40, 10, fmt.Sprintf("Total Amount Due: $%.2f USD", payload.TotalAmount))

	var buf bytes.Buffer
	_ = pdf.Output(&buf)
	return &buf
}
