# IoT‑Driven Supply‑Chain Telemetry – Implementation Plan

**Goal**: Extend the ERP system with a real‑time sensor data pipeline that ingests battery‑temperature telemetry, detects overheating, updates inventory status, and pushes instant alerts to the Next.js dashboard.

## User Review Required

> **IMPORTANT** – The plan adds new services, Docker‑Compose entries, and modifies existing gateway and frontend code. It will increase the Docker stack size and require a running Kafka broker. Please confirm you’re okay with these changes before we proceed.

---

## Open Questions

- **Kafka broker configuration**: Do you want to use the existing Kafka service in `docker‑compose.yml` (if already present) or add a new one?
- **Simulator deployment**: Should the IoT simulator run as a separate Docker service (recommended) or as a local binary you start manually?
- **WebSocket endpoint**: Preferred URL path for the client (e.g., `/ws/alerts`) and authentication method (none for demo, or JWT‑protected)?
- **Alert UI**: Any specific design for the red banner (color, animation) beyond the default flashing style?

---

## Proposed Changes

### 1. Docker‑Compose

- **Add Kafka service** (if not present) with Zookeeper, expose ports `9092` and `9093`.
- **Add new service** `iot‑simulator` that builds the Go binary from `cmd/iot-simulator` and runs it.
- **Expose a new Kafka topic** `iot.telemetry.battery` (creation is done at runtime by the producer).
- **Expose a new Kafka topic** `inventory.alerts.critical` (consumer will create if missing).

### 2. Go IoT Simulator (`cmd/iot-simulator/main.go`)

- Create a Go module under `cmd/iot-simulator`.
- Use `goroutine` pool (100 sensors) emitting JSON payloads (see schema).
- Random temperature spikes > 30 °C at ~1 % probability.
- HTTP POST to `http://gateway:3000/api/iot/telemetry` (adjust port as needed) at 50 req/s.
- Add `go.mod` with `net/http`, `encoding/json`, `math/rand`, `time`.

### 3. API Gateway (Node.js)

- Add new route `POST /api/iot/telemetry`.
- Validate payload using a JSON schema (e.g., `ajv`).
- Produce payload to Kafka topic `iot.telemetry.battery` using existing Kafka client (e.g., `kafkajs`).
- Respond `202 Accepted` immediately.
- Add WebSocket server (e.g., using `ws` or `socket.io`).
- Subscribe to `inventory.alerts.critical` topic and forward each message to connected WebSocket clients.

### 4. Intelligence Worker (Go)

- Either extend existing `intelligence` service or create `cmd/iot‑worker/main.go`.
- Use a Kafka consumer for `iot.telemetry.battery`.
- On each message, if `temperature_c > 28.0`:
  1. Begin a DB transaction (PostgreSQL).
  2. Update `inventory` table: `status = 'QUARANTINED'` for the `pallet_id`.
  3. Publish a message to `inventory.alerts.critical` (same transaction via outbox pattern).
- Use existing `pkg/kafka` utilities if present; otherwise add a lightweight consumer.

### 5. Frontend (Next.js)

- Create a WebSocket client hook (`useTelemetrySocket.ts`) that connects to `ws://localhost:3000/ws/alerts`.
- On message, dispatch to a Zustand store slice `alertStore`.
- Add a component `CriticalAlertBanner.tsx` that reads from the store and renders a flashing red banner.
- Ensure the page `pages/dashboard.tsx` includes the banner.

### 6. Documentation

- Update `README.md` with a new section “IoT Telemetry Module” and usage instructions.
- Add a `docs/iot_telemetry.md` file with architecture diagram (Mermaid) and run‑books.

---

## Verification Plan

### Automated Tests
- Unit test for Go simulator payload generation.
- Integration test: spin up Docker stack, send a few simulated messages, assert that the PostgreSQL `inventory` row is updated and the WebSocket receives the alert.
- Lint and `go vet` for new Go code, `eslint` for gateway changes, and TypeScript type‑checking for the frontend.

### Manual Verification
1. Run `docker compose up -d`.
2. Confirm Kafka, PostgreSQL, Redis, and Gateway are healthy.
3. Start the IoT simulator (`docker compose up iot-simulator` or `go run cmd/iot-simulator/main.go`).
4. Open the dashboard (`http://localhost:3000`).
5. Observe flashing alerts when a temperature spike occurs.
6. Verify the corresponding inventory row in PostgreSQL is set to `QUARANTINED`.

---

**Next Steps**
- Resolve the open questions above.
- Once approved, we will create the required directories and files, update Docker‑Compose, and implement the code.
