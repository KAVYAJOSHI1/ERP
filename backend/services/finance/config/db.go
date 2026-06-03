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
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "finance.",
			SingularTable: false,
		},
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	DB = db
	log.Println("Successfully connected to finance schema in PostgreSQL")
}
