package models

import (
	"time"

	"gorm.io/gorm"
)

type BillOfMaterials struct {
	ID         string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProductID  string         `gorm:"type:uuid;not null" json:"product_id"`
	Name       string         `gorm:"type:varchar(255);not null" json:"name"`
	Version    string         `gorm:"type:varchar(50);not null;default:'1.0'" json:"version"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Components []BOMComponent `gorm:"foreignKey:BOMID" json:"components,omitempty"`
}

type BOMComponent struct {
	ID               string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BOMID            string    `gorm:"type:uuid;not null" json:"bom_id"`
	RawMaterialID    string    `gorm:"type:uuid;not null" json:"raw_material_id"`
	QuantityRequired float64   `gorm:"type:numeric(12,4);not null" json:"quantity_required"`
	CreatedAt        time.Time `json:"created_at"`
}

type WorkCenter struct {
	ID        string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string         `gorm:"type:varchar(255);not null" json:"name"`
	Capacity  float64        `gorm:"type:numeric(12,2)" json:"capacity"`
	Status    string         `gorm:"type:varchar(50);not null;default:'active'" json:"status"` // active, maintenance, inactive
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type ProductionRun struct {
	ID            string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BOMID         string     `gorm:"type:uuid;not null" json:"bom_id"`
	WorkCenterID  string     `gorm:"type:uuid;not null" json:"work_center_id"`
	Quantity      float64    `gorm:"type:numeric(12,2);not null" json:"quantity"`
	Status        string     `gorm:"type:varchar(50);not null;default:'planned'" json:"status"` // planned, in_progress, completed, failed
	CorrelationID string     `gorm:"type:varchar(255)" json:"correlation_id"`
	StartedAt     *time.Time `json:"started_at,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	// Associations
	BOM        *BillOfMaterials `gorm:"foreignKey:BOMID" json:"bom,omitempty"`
	WorkCenter *WorkCenter      `gorm:"foreignKey:WorkCenterID" json:"work_center,omitempty"`
}
