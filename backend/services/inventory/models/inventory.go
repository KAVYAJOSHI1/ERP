package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type Product struct {
	ID          string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SKU         string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"sku"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Unit        string         `gorm:"type:varchar(50);not null" json:"unit"`
	Category    string         `gorm:"type:varchar(100);not null" json:"category"`
	Description string         `gorm:"type:text" json:"description"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Product) TableName() string {
	return "inventory.products"
}

type Warehouse struct {
	ID        string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string         `gorm:"type:varchar(255);not null" json:"name"`
	Location  string         `gorm:"type:varchar(255)" json:"location"`
	Capacity  float64        `gorm:"type:numeric(12,2)" json:"capacity"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Warehouse) TableName() string {
	return "inventory.warehouses"
}

type StockLevel struct {
	ID           string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProductID    string         `gorm:"type:uuid;not null;uniqueIndex:idx_prod_wh" json:"product_id"`
	WarehouseID  string         `gorm:"type:uuid;not null;uniqueIndex:idx_prod_wh" json:"warehouse_id"`
	Quantity     float64        `gorm:"type:numeric(12,2);not null;default:0.0" json:"quantity"`
	ReservedQty  float64        `gorm:"type:numeric(12,2);not null;default:0.0" json:"reserved_qty"`
	ReorderPoint float64        `gorm:"type:numeric(12,2);not null;default:0.0" json:"reorder_point"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (StockLevel) TableName() string {
	return "inventory.stock_levels"
}

type StockTransaction struct {
	ID            string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProductID     string    `gorm:"type:uuid;not null" json:"product_id"`
	WarehouseID   string    `gorm:"type:uuid;not null" json:"warehouse_id"`
	Delta         float64   `gorm:"type:numeric(12,2);not null" json:"delta"`
	Type          string    `gorm:"type:varchar(50);not null" json:"type"`
	ReferenceID   string    `gorm:"type:varchar(255)" json:"reference_id"`
	CorrelationID string    `gorm:"type:varchar(255)" json:"correlation_id"`
	CreatedAt     time.Time `json:"created_at"`
}

func (StockTransaction) TableName() string {
	return "inventory.stock_transactions"
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
	return "inventory.outbox_events"
}
