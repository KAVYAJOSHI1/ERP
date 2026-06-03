package models

import (
	"encoding/json"
	"time"
)

type Account struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"type:varchar(255);not null;unique" json:"name"`
	Type      string    `gorm:"type:varchar(50);not null" json:"type"` // asset, liability, equity, revenue, expense
	Currency  string    `gorm:"type:varchar(10);not null;default:USD" json:"currency"`
	Balance   float64   `gorm:"type:numeric(15,2);not null;default:0.00" json:"balance"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type LedgerEntry struct {
	ID            string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AccountID     string    `gorm:"type:uuid;not null" json:"account_id"`
	Account       *Account  `gorm:"foreignKey:AccountID" json:"account,omitempty"`
	Debit         float64   `gorm:"type:numeric(15,2);not null;default:0.00" json:"debit"`
	Credit        float64   `gorm:"type:numeric(15,2);not null;default:0.00" json:"credit"`
	Description   string    `gorm:"type:varchar(512)" json:"description"`
	ReferenceID   string    `gorm:"type:varchar(255)" json:"reference_id"`
	CorrelationID string    `gorm:"type:varchar(255)" json:"correlation_id"`
	CreatedAt     time.Time `gorm:"column:created_at;default:CURRENT_TIMESTAMP" json:"created_at"`
}

type Invoice struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	POID      string    `gorm:"column:po_id;type:uuid;not null" json:"po_id"`
	Amount    float64   `gorm:"type:numeric(15,2);not null" json:"amount"`
	Status    string    `gorm:"type:varchar(50);not null;default:pending" json:"status"` // pending, paid, overdue
	PdfURL    string    `gorm:"column:pdf_url;type:varchar(512)" json:"pdf_url"`
	IssuedAt  time.Time `gorm:"column:issued_at;default:CURRENT_TIMESTAMP" json:"issued_at"`
	UpdatedAt time.Time `json:"updated_at"`
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

type ProcessedEvent struct {
	EventID     string    `gorm:"type:uuid;primaryKey" json:"event_id"`
	ProcessedAt time.Time `gorm:"column:processed_at;default:CURRENT_TIMESTAMP" json:"processed_at"`
}
