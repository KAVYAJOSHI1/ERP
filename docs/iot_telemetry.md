# IoT Battery Telemetry System

## Overview

The IoT telemetry pipeline streams real-time battery pallet temperature data from 100 simulated sensors through the platform and surfaces critical thermal spike alerts in the dashboard within milliseconds.

## Data Flow

```
IoT Simulator (Go)
  → POST /api/iot/telemetry (Gateway)
  → Kafka: iot.telemetry.battery (3 partitions)
  → IoT Worker (Go)
      ├── temp >= 28°C?
      │     ├── INSERT iot.alerts (PostgreSQL)
      │     └── Publish → Kafka: inventory.alerts.critical
      └── Gateway WebSocket Hub
            → WS /ws/alerts (authenticated clients)
            → Frontend CriticalAlertBanner
```

## Components

### 1. IoT Simulator (`backend/cmd/iot-simulator`)
- 100 concurrent goroutines, one per pallet (PAL-LITH-001 … PAL-LITH-100)
- Tick rate: every 2 seconds → ~50 req/s aggregate
- Normal temperature: 20–23°C
- Thermal spike (1% probability): 30–35°C
- Graceful shutdown on SIGINT/SIGTERM

### 2. Gateway Ingestion Route (`POST /api/iot/telemetry`)
- Validates `sensor_id`, `pallet_id`, `temperature_c`
- Fire-and-forget publish to `iot.telemetry.battery` (key = pallet_id)
- Returns `202 Accepted` immediately

### 3. IoT Worker (`backend/cmd/iot-worker`)
- Kafka consumer group `iot-worker` on `iot.telemetry.battery`
- Spike threshold: **28.0°C** (exported as `IsThermalSpike(temp)` for testing)
- On spike:
  1. INSERT into `iot.alerts` table (auto-migrated via GORM)
  2. Publish `CriticalAlert` JSON to `inventory.alerts.critical`

### 4. Gateway WebSocket Hub (`ws://gateway:5000/ws/alerts`)
- JWT-protected: pass token as query param `?token=<jwt>`
- Kafka consumer group `gateway-alerts-ws` on `inventory.alerts.critical`
- Broadcasts to all connected authenticated clients in real time

### 5. Frontend
- **`useTelemetrySocket`** hook — connects on login, auto-reconnects every 3s on drop
- **`useAlertStore`** (Zustand) — stores up to 50 alerts, newest first
- **`CriticalAlertBanner`** — fixed top banner, flashes red, shows pallet + temp + location, dismiss per alert or clear all

## Kafka Topics

| Topic | Partitions | Purpose |
|---|---|---|
| `iot.telemetry.battery` | 3 | Raw telemetry from all 100 sensors |
| `inventory.alerts.critical` | 1 | Thermal spike alerts → WebSocket broadcast |

## Database Schema

```sql
CREATE SCHEMA IF NOT EXISTS iot;

CREATE TABLE iot.alerts (
  id            UUID        PRIMARY KEY,
  pallet_id     VARCHAR     NOT NULL,
  sensor_id     VARCHAR     NOT NULL,
  location      VARCHAR     NOT NULL,
  temperature_c DECIMAL     NOT NULL,
  detected_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX ON iot.alerts (pallet_id);
CREATE INDEX ON iot.alerts (detected_at DESC);
```

> Table is auto-migrated by the IoT Worker on startup via GORM `AutoMigrate`.

## Running the Stack

```bash
# Start all infrastructure + IoT components
docker compose up --build

# View thermal spike logs
docker logs -f erp-iot-worker

# View simulator output
docker logs -f erp-iot-simulator
```

## Running Tests

```bash
# Go worker unit tests (no dependencies needed)
cd backend/cmd/iot-worker
go test ./...

# Gateway route tests
cd gateway
npm install
npx jest

# Frontend store tests
cd frontend
npm install --save-dev jest @types/jest ts-jest jest-environment-jsdom
npx jest src/__tests__/alertStore.test.ts
```

## Alert Message Schema

```json
{
  "type": "THERMAL_SPIKE",
  "pallet_id": "PAL-LITH-042",
  "sensor_id": "SNS-BATT-042",
  "location": "Warehouse-Zone-B",
  "temperature_c": 33.21,
  "detected_at": "2026-06-10T12:34:56.789Z"
}
```
