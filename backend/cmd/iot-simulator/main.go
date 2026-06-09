package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// TelemetryPayload defines the exact JSON schema expected by the API Gateway
type TelemetryPayload struct {
	SensorID     string    `json:"sensor_id"`
	PalletID     string    `json:"pallet_id"`
	Location     string    `json:"location"`
	TemperatureC float64   `json:"temperature_c"`
	Timestamp    time.Time `json:"timestamp"`
}

const (
	totalPallets = 100
	tickRate     = 2 * time.Second // 100 pallets / 2s = ~50 requests per second
)

func main() {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:5000/api/iot/telemetry" // Fallback for local testing
	}

	// Optimize HTTP client for high-throughput connection pooling
	client := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 100,
		},
	}

	var wg sync.WaitGroup
	cancel := false // Simple shutdown flag

	log.Printf("Starting IoT Simulator: %d pallets blasting to %s", totalPallets, gatewayURL)

	// Spin up 100 concurrent workers
	for i := 1; i <= totalPallets; i++ {
		wg.Add(1)
		go simulatePallet(i, client, gatewayURL, &wg, &cancel)
	}

	// Graceful shutdown listener
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("\nShutdown signal received. Spinning down sensors...")
	cancel = true
	wg.Wait()
	log.Println("All sensors offline. Simulator terminated safely.")
}

func simulatePallet(id int, client *http.Client, url string, wg *sync.WaitGroup, cancel *bool) {
	defer wg.Done()

	palletID := fmt.Sprintf("PAL-LITH-%03d", id)
	sensorID := fmt.Sprintf("SNS-BATT-%03d", id)
	location := fmt.Sprintf("Warehouse-Zone-%s", string(rune('A'+(id%4)))) // Zones A-D

	ticker := time.NewTicker(tickRate)
	defer ticker.Stop()

	// Seed RNG per goroutine to avoid locking overhead
	rng := rand.New(rand.NewSource(time.Now().UnixNano() + int64(id)))

	for range ticker.C {
		if *cancel {
			return
		}

		// Base temp between 20.0C and 23.0C
		temp := 20.0 + (rng.Float64() * 3.0)

		// 1% chance of thermal runaway (spike to 30C - 35C)
		if rng.Float64() < 0.01 {
			temp = 30.0 + (rng.Float64() * 5.0)
			log.Printf("⚠️ THERMAL SPIKE INITIATED: %s is at %.2f°C", palletID, temp)
		}

		payload := TelemetryPayload{
			SensorID:     sensorID,
			PalletID:     palletID,
			Location:     location,
			TemperatureC: float64(int(temp*100)) / 100, // Round to 2 decimals
			Timestamp:    time.Now().UTC(),
		}

		jsonData, _ := json.Marshal(payload)

		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Network Error (%s): %v", palletID, err)
			continue
		}
		resp.Body.Close()
	}
}
