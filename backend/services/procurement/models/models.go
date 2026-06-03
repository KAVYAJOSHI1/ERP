package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type Vendor struct {
	ID               string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name             string         `gorm:"type:varchar(255);not null" json:"name"`
	Email            string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Contact          string         `gorm:"type:varchar(255)" json:"contact"`
	PerformanceScore float64        `gorm:"type:numeric(5,2);default:100.00" json:"performance_score"`
	IsActive         bool           `gorm:"type:boolean;not null;default:true" json:"is_active"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Vendor) TableName() string {
	return "procurement.vendors"
}

type PurchaseOrder struct {
	ID            string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	VendorID      string         `gorm:"type:uuid;not null" json:"vendor_id"`
	Vendor        Vendor         `gorm:"foreignKey:VendorID" json:"vendor,omitempty"`
	Status        string         `gorm:"type:varchar(50);not null;default:'draft'" json:"status"`
	TotalAmount   float64        `gorm:"type:numeric(15,2);not null;default:0.00" json:"total_amount"`
	Currency      string         `gorm:"type:varchar(10);not null;default:'USD'" json:"currency"`
	CorrelationID string         `gorm:"type:varchar(255)" json:"correlation_id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	LineItems     []POLineItem   `gorm:"foreignKey:POID" json:"line_items,omitempty"`
}

func (PurchaseOrder) TableName() string {
	return "procurement.purchase_orders"
}

type POLineItem struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	POID      string    `gorm:"type:uuid;not null" json:"po_id"`
	ProductID string    `gorm:"type:uuid;not null" json:"product_id"`
	Quantity  float64   `gorm:"type:numeric(12,2);not null" json:"quantity"`
	UnitPrice float64   `gorm:"type:numeric(12,2);not null" json:"unit_price"`
	CreatedAt time.Time `json:"created_at"`
}

func (POLineItem) TableName() string {
	return "procurement.po_line_items"
}

type Quotation struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	VendorID  string    `gorm:"type:uuid;not null" json:"vendor_id"`
	Vendor    Vendor    `gorm:"foreignKey:VendorID" json:"vendor,omitempty"`
	ProductID string    `gorm:"type:uuid;not null" json:"product_id"`
	UnitPrice float64   `gorm:"type:numeric(12,2);not null" json:"unit_price"`
	ValidUntil time.Time `json:"valid_until"`
	CreatedAt time.Time `json:"created_at"`
}

func (Quotation) TableName() string {
	return "procurement.quotations"
}

type OutboxEvent struct {
	ID            string          `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AggregateType string          `gorm:"type:varchar(100);not null" json:"aggregate_type"`
	AggregateID   string          `gorm:"type:varchar(255);not null" json:"aggregate_id"`
	EventType     string          `gorm:"type:varchar(100);not null" json:"event_type"`
	Payload       json.RawMessage `gorm:"type:jsonb;not null" json:"payload"`
	Published     bool            `gorm:"type:boolean;not null;default:false" json:"published"`
	CreatedAt     time.Time       `json:"created_at"`
}

func (OutboxEvent) TableName() string {
	return "procurement.outbox_events"
}

type ProcessedEvent struct {
	EventID     string    `gorm:"type:uuid;primaryKey" json:"event_id"`
	ProcessedAt time.Time `json:"processed_at"`
}

func (ProcessedEvent) TableName() string {
	return "procurement.processed_events"
}
