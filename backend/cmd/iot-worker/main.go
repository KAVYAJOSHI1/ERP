package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const thermalSpikeThreshold = 28.0

// TelemetryPayload mirrors the simulator's output schema.
type TelemetryPayload struct {
	SensorID     string    `json:"sensor_id"`
	PalletID     string    `json:"pallet_id"`
	Location     string    `json:"location"`
	TemperatureC float64   `json:"temperature_c"`
	Timestamp    time.Time `json:"timestamp"`
}

// CriticalAlert is published to inventory.alerts.critical and broadcast via WebSocket.
type CriticalAlert struct {
	Type         string    `json:"type"`
	PalletID     string    `json:"pallet_id"`
	SensorID     string    `json:"sensor_id"`
	Location     string    `json:"location"`
	TemperatureC float64   `json:"temperature_c"`
	DetectedAt   time.Time `json:"detected_at"`
}

// IotAlert persists every detected thermal spike to PostgreSQL.
type IotAlert struct {
	ID           string    `gorm:"type:uuid;primaryKey"`
	PalletID     string    `gorm:"not null;index"`
	SensorID     string    `gorm:"not null"`
	Location     string    `gorm:"not null"`
	TemperatureC float64   `gorm:"not null"`
	DetectedAt   time.Time `gorm:"not null;index"`
}

func (IotAlert) TableName() string { return "iot.alerts" }

// IsThermalSpike is the pure detection predicate, exported for unit testing.
func IsThermalSpike(temp float64) bool {
	return temp >= thermalSpikeThreshold
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func connectDB() *gorm.DB {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		getenv("DB_HOST", "localhost"),
		getenv("DB_USER", "erp_user"),
		getenv("DB_PASSWORD", "erp_password"),
		getenv("DB_NAME", "erp_db"),
		getenv("DB_PORT", "5435"),
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error),
	})
	if err != nil {
		log.Fatalf("[IoT Worker] DB connect failed: %v", err)
	}
	db.Exec("CREATE SCHEMA IF NOT EXISTS iot")
	if err := db.AutoMigrate(&IotAlert{}); err != nil {
		log.Fatalf("[IoT Worker] AutoMigrate failed: %v", err)
	}
	log.Println("[IoT Worker] Database ready")
	return db
}

func main() {
	brokers := strings.Split(getenv("KAFKA_BROKERS", "localhost:9092"), ",")

	db := connectDB()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     brokers,
		GroupID:     "iot-worker",
		Topic:       "iot.telemetry.battery",
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kafka.LastOffset,
	})
	defer reader.Close()

	writer := &kafka.Writer{
		Addr:     kafka.TCP(brokers...),
		Balancer: &kafka.LeastBytes{},
		Async:    false,
	}
	defer writer.Close()

	ctx, cancel := context.WithCancel(context.Background())

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("[IoT Worker] Shutdown signal received")
		cancel()
	}()

	log.Printf("[IoT Worker] Consuming iot.telemetry.battery (spike threshold: %.1f°C)...", thermalSpikeThreshold)

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("[IoT Worker] Exiting cleanly")
				return
			}
			log.Printf("[IoT Worker] Read error: %v", err)
			continue
		}

		var payload TelemetryPayload
		if err := json.Unmarshal(msg.Value, &payload); err != nil {
			log.Printf("[IoT Worker] Unmarshal error: %v", err)
			continue
		}

		if !IsThermalSpike(payload.TemperatureC) {
			continue
		}

		log.Printf("[IoT Worker] THERMAL SPIKE: %s at %.2f°C in %s",
			payload.PalletID, payload.TemperatureC, payload.Location)

		detectedAt := time.Now().UTC()

		alert := IotAlert{
			ID:           uuid.New().String(),
			PalletID:     payload.PalletID,
			SensorID:     payload.SensorID,
			Location:     payload.Location,
			TemperatureC: payload.TemperatureC,
			DetectedAt:   detectedAt,
		}
		if err := db.Create(&alert).Error; err != nil {
			log.Printf("[IoT Worker] DB insert failed: %v", err)
		}

		critAlert := CriticalAlert{
			Type:         "THERMAL_SPIKE",
			PalletID:     payload.PalletID,
			SensorID:     payload.SensorID,
			Location:     payload.Location,
			TemperatureC: payload.TemperatureC,
			DetectedAt:   detectedAt,
		}
		critJSON, _ := json.Marshal(critAlert)

		if err := writer.WriteMessages(ctx, kafka.Message{
			Topic: "inventory.alerts.critical",
			Key:   []byte(payload.PalletID),
			Value: critJSON,
		}); err != nil {
			log.Printf("[IoT Worker] Kafka publish failed: %v", err)
		}
	}
}
