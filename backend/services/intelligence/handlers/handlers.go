package handlers

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5435"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "erp_user"
	}
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "erp_password"
	}
	dbname := os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "erp_db"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC", host, user, password, dbname, port)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	DB = db
	log.Println("Successfully connected to database for intelligence analytics")
}

// ForecastResult represents the demand forecast for a single product
type ForecastResult struct {
	ProductID              string  `json:"product_id"`
	ProductName            string  `json:"product_name"`
	CurrentStock           float64 `json:"current_stock"`
	ReorderPoint           float64 `json:"reorder_point"`
	CalculatedDemandRate   float64 `json:"calculated_demand_rate"` // e.g., units per day
	RecommendedReorderQty  float64 `json:"recommended_reorder_qty"`
	ActionRequired         bool    `json:"action_required"`
}

func GetForecast(c *fiber.Ctx) error {
	// For demonstration of the Intelligence engine, we query inventory
	// and calculate a mocked moving average and demand rate.
	// In a real AI system, this would query a model endpoint or run a time-series DB aggregation.

	type productStock struct {
		ID           string
		Name         string
		Quantity     float64
		ReorderPoint float64
	}

	var results []productStock
	query := `
		SELECT p.id, p.name, s.quantity, s.reorder_point 
		FROM inventory.products p 
		JOIN inventory.stock_levels s ON p.id = s.product_id
	`
	if err := DB.Raw(query).Scan(&results).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	var forecasts []ForecastResult
	for _, item := range results {
		// Mock moving average: assume daily demand is 5% of reorder point + some noise
		demandRate := item.ReorderPoint * 0.05
		if demandRate < 1 {
			demandRate = 1.5
		}

		// Recommend reordering 30 days of stock
		recommendedQty := demandRate * 30

		forecasts = append(forecasts, ForecastResult{
			ProductID:             item.ID,
			ProductName:           item.Name,
			CurrentStock:          item.Quantity,
			ReorderPoint:          item.ReorderPoint,
			CalculatedDemandRate:  demandRate,
			RecommendedReorderQty: recommendedQty,
			ActionRequired:        item.Quantity <= item.ReorderPoint,
		})
	}

	return c.JSON(forecasts)
}
