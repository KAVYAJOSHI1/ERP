package config

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

var DB *gorm.DB

func ConnectDB() {
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dbSSL := os.Getenv("DB_SSLMODE")

	if dbSSL == "" {
		dbSSL = "disable"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s search_path=inventory",
		dbHost, dbUser, dbPassword, dbName, dbPort, dbSSL)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "inventory.",
			SingularTable: false,
		},
	})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	log.Println("Successfully connected to PostgreSQL (inventory schema)")
	DB = db
}
