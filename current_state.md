# Smart Manufacturing ERP - Current System State

This document outlines the current operational status, microservices topology, deployment configuration, and pending tasks for the Smart Manufacturing ERP & Supply Chain Intelligence platform.

---

## 🟢 Overall Operational Status: **ACTIVE & HEALTHY**

All infrastructure dependencies (databases, event brokers, caches) and backend/frontend application processes are currently compiled, running, and listening on their designated local ports. The end-to-end (E2E) integration test successfully passes, proving correct cross-service transactional communication.

---

## 🏗️ Services & Port Configuration Matrix

The entire microservices topology is distributed across the following host mappings:

| Service Name | Port | Type / Tech | Status | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | `5000` | Node.js / Express | 🟢 Running | JWT Auth, RBAC validation, request proxying, WS Alert Hub. |
| **Frontend Portal** | `3000` | Next.js 15 / React | 🟢 Running | Enterprise dark industrial UI control dashboard. |
| **Auth Service** | `8080` | Go / Fiber / GORM | 🟢 Running | Session lifecycle, token minting/revocation, user directory. |
| **Inventory Service** | `8081` | Go / Fiber / GORM | 🟢 Running | Product stock level validation, pessimistic stock lock, Outbox log. |
| **Procurement Service** | `8082` | Go / Fiber / GORM | 🟢 Running | Automated replenishment triggers, purchase orders logic. |
| **Finance Service** | `8083` | Go / Fiber / GORM | 🟢 Running | Double-entry ledger reconciliation, invoicing (PDFs to MinIO). |
| **Intelligence Service** | `8084` | Go / Fiber | 🟢 Running | Predictive demand forecasting engine. |
| **Production Service** | `8085` | Go / Fiber / GORM | 🟢 Running | BOM Recipes management, Shop floor simulation background cycles. |
| **PostgreSQL** | `5435` | Postgres 16 | 🟢 Containerized | Dedicated schema namespaces for each domain database. |
| **Redis Stack** | `6375` | Redis 7.2 | 🟢 Containerized | Sliding-window rate limiter, revoked session blacklist cache. |
| **Kafka Broker** | `9092` | Confluent CP-Kafka | 🟢 Containerized | Decoupled event transmission bus (`erp.inventory.stock-updated`, etc.). |
| **MinIO Object Store** | `9000` | MinIO | 🟢 Containerized | S3-compatible document storage (PDF invoices bucket). |
| **Jaeger Collector** | `16686` | OpenTelemetry Jaeger | 🟢 Containerized | Distributed tracing collector and UI console. |
| **Grafana / Prometheus** | `3000` / `9090` | Prometheus Stack | 🟢 Containerized | High-fidelity metrics telemetry grids and query visualization. |

---

## ⚡ E2E Production Run Verification Output

Run validation is automatically tested via `./test_e2e_production.sh`. The test validates raw cell deductions, shop floor worker execution cycles (30s delay), stock credits for final yielded goods, and automated outbox-driven PO generation.

```
=== Smart ERP Shop Floor E2E Integration Tester ===
Initial Raw Material Cells Stock: 400.00
Initial Finished Battery Packs Stock: 6.00

[Action] Dispatching production run of 1 Battery Pack...
Production Run Dispatched! ID: 7785bfe6-1760-4723-8998-ff84cdd35dae, Status: in_progress
Verifying inventory deduction...
[SUCCESS] Raw cells successfully deducted! Current: 300.00 (Expected: 300.00)

[Simulation] Waiting 37 seconds for shop floor assembly to complete...
Time remaining:  1 seconds

Production Run Final Status: completed
[SUCCESS] Finished Goods stock increased! Current: 7.00 (Expected: 7.00)

Checking Auto-Procurement Integration...
[SUCCESS] Found active replenishment PO: db904232-9641-47c8-a57b-85dc04238ee4 (Status: auto_generated)

=== E2E Test Completed ===
```

---

## 📂 Git Workspace Status (Changes Awaiting Commit)

The entire codebase for Phase 5 additions is fully functional and running locally, but not yet committed to version control. The modifications are:

### Modified Files:
* `backend/cmd/iot-simulator/Dockerfile` — Updated configurations.
* `backend/cmd/iot-worker/go.mod` — Extended worker package dependencies.
* `backend/pkg/` — Unified event-driven Kafka and outbox library integrations.
* `backend/services/auth/` — Added administrative IAM lookup route `/auth/users`.
* `backend/services/inventory/` — Extended models and schema migrations.
* `backend/services/procurement/` — Updated stock event consumer dependencies.
* `docker-compose.yml` — Consolidated simulator/worker environment parameters.
* `frontend/src/app/page.tsx` — Revamped premium role-segmented dashboard telemetry.
* `frontend/src/components/DashboardLayout.tsx` — Extended sidebar routing paths.
* `gateway/src/` — Wired routing and validation proxies for Production, IAM, and WebSocket alerts.

### Untracked Files:
* `backend/services/production/` — Complete Production & Shop Floor execution service.
* `frontend/src/app/production/` — Next.js visual shop floor control station.
* `frontend/src/app/users/` — IAM provision panel.
* `frontend/src/app/audit/` — Distributed transactional audit analyzer.
* `test_e2e_production.sh` — Local integration verification scripts.
* `backend/cmd/iot-worker/go.sum` — Worker dependency mappings.

---

## 📋 Next Recommended Actions
1. **Commit the working changes** to the local git tree:
   ```bash
   git add .
   git commit -m "feat: implement shop-floor production service, IAM console, audit logs, and E2E validation script"
   ```
2. **Push to Remote Origin** to sync development environments:
   ```bash
   git push origin main
   ```
