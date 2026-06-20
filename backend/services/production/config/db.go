package config

import (
	"log/slog"
	"os"

	"backend/pkg/database"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	var err error
	DB, err = database.Connect(database.DBConfig{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		User:     os.Getenv("DB_USER"),
		Password: os.Getenv("DB_PASSWORD"),
		DBName:   os.Getenv("DB_NAME"),
		SSLMode:  os.Getenv("DB_SSLMODE"),
		Schema:   "production",
	})
	if err != nil {
		slog.Error("Database connection failed", "error", err)
		os.Exit(1)
	}
}
