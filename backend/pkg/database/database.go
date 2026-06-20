package database

import (
	"fmt"
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// DBConfig holds the database connection and pool parameters
type DBConfig struct {
	Host          string
	Port          string
	User          string
	Password      string
	DBName        string
	SSLMode       string
	Schema        string
	MaxIdleConns  int
	MaxOpenConns  int
	MaxLifeTime   time.Duration
	RetryAttempts int
	RetryInterval time.Duration
}

// Connect establishes a connection to PostgreSQL database with retries and configures the pool
func Connect(cfg DBConfig) (*gorm.DB, error) {
	if cfg.SSLMode == "" {
		cfg.SSLMode = "disable"
	}
	if cfg.MaxIdleConns == 0 {
		cfg.MaxIdleConns = 10
	}
	if cfg.MaxOpenConns == 0 {
		cfg.MaxOpenConns = 100
	}
	if cfg.MaxLifeTime == 0 {
		cfg.MaxLifeTime = time.Hour
	}
	if cfg.RetryAttempts == 0 {
		cfg.RetryAttempts = 5
	}
	if cfg.RetryInterval == 0 {
		cfg.RetryInterval = 2 * time.Second
	}

	var dsn string
	if cfg.Schema != "" {
		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s search_path=%s TimeZone=UTC",
			cfg.Host, cfg.User, cfg.Password, cfg.DBName, cfg.Port, cfg.SSLMode, cfg.Schema)
	} else {
		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
			cfg.Host, cfg.User, cfg.Password, cfg.DBName, cfg.Port, cfg.SSLMode)
	}

	var db *gorm.DB
	var err error

	gormConfig := &gorm.Config{}
	if cfg.Schema != "" {
		gormConfig.NamingStrategy = schema.NamingStrategy{
			TablePrefix:   cfg.Schema + ".",
			SingularTable: false,
		}
	}

	for i := 1; i <= cfg.RetryAttempts; i++ {
		slog.Info("Connecting to database", "attempt", i, "host", cfg.Host, "port", cfg.Port, "schema", cfg.Schema)
		db, err = gorm.Open(postgres.Open(dsn), gormConfig)
		if err == nil {
			break
		}
		slog.Warn("Failed to connect to database, retrying...", "error", err, "attempt", i, "next_attempt_in", cfg.RetryInterval)
		time.Sleep(cfg.RetryInterval)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after %d attempts: %w", cfg.RetryAttempts, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(cfg.MaxLifeTime)

	slog.Info("Successfully connected to database and configured connection pool", "schema", cfg.Schema)
	return db, nil
}

// Ping checks if the database connection is still alive
func Ping(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}
