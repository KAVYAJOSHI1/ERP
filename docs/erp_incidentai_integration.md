# ERP ↔ IncidentAI integration

One synchronized flow: an ERP operational failure becomes an IncidentAI incident,
and the incident's resolution/rollback flows back into the ERP — with **one
authoritative correlation id** and a relationship that lives in PostgreSQL, never
in browser state.

```
Browser ──▶ ERP Gateway ──▶ Go service ──▶ failed transaction (production_runs, status='failed')
   POST /api/production/runs   │  X-Correlation-ID (generated once, echoed in the response header)
                               ▼
                        audit.incident_links  (correlation_id UNIQUE — idempotency key)
                               │
                               ▼  POST INCIDENTAI_INGEST_URL   erp_context.correlation_id = <same id>
                        IncidentAI ticket   ticket.correlation_id == ticket.erp_context.correlation_id == <same id>
                               │
        developer diagnoses / remediates / verifies / rolls back in IncidentAI
                               │
                               ▼  POST /api/incident-callback/status   (X-Incident-Secret)
                        incident.UpdateStatus → audit.incident_links.incident_status
                               │
                               ▼  GET /production/runs  (polled by the ERP UI every 4s)
                        ERP shows  TKT-XXXX  ● RESOLVED / ● ROLLED BACK
```

## 1. ERP → IncidentAI (automatic escalation)

Triggered by the **backend** on a genuine operational failure — never from React:

| Module | Failure | Escalated as |
|---|---|---|
| Production | insufficient raw material for a run | `production_run.create` |
| Inventory  | stock adjustment would go negative (direct user call only) | `stock.adjust` |
| Procurement| purchase-order transaction failure | `purchase_order.create` |

The Go service:
1. persists the failed transaction (e.g. a `production_runs` row, `status='failed'`),
2. `INSERT … audit.incident_links … ON CONFLICT (correlation_id) DO NOTHING`,
3. if the row has no incident yet, `POST` to `INCIDENTAI_INGEST_URL`
   (`http://localhost:4000/api/incidents/ingest` by default) — the **existing**
   IncidentAI ingest contract, unchanged:

```json
{
  "text": "[AUTOMATED] Production operation \"production_run.create\" was rejected …",
  "reporter": "Smart Manufacturing ERP (automated)",
  "erp_context": {
    "erp": "Smart Manufacturing ERP",
    "module": "Production",
    "operation": "production_run.create",
    "correlation_id": "<gateway X-Correlation-ID>",   ← authoritative
    "transaction_id": "<production_runs.id>",
    "record_id": "<production_runs.id>",
    "product_id": "<uuid>",
    "sku": "PROD-LITH-001",
    "route": "/production",
    "error_message": "<real backend error>",
    "source": "erp-backend-auto",
    "timestamp": "<RFC3339>"
  }
}
```

IncidentAI stores `erp_context.correlation_id` as the ticket's authoritative
`correlation_id`. The ERP records the returned `ticket.id` / `ticket.ticket_number`
on the link row (`incident_status` starts `OPEN`).

If IncidentAI is unreachable the failure is still persisted (link row,
`incident_id` empty, `escalated=false`) and is retryable — the ERP transaction is
**not** rolled back because of it. The UI shows *"IncidentAI escalation pending"*.

Idempotency: the same correlation id submitted twice hits IncidentAI **once** and
yields **one** link row.

## 2. IncidentAI → ERP (status callback)

`POST /api/incident-callback/status` on the gateway. Guarded by a shared secret
(`INCIDENT_CALLBACK_SECRET`, header `X-Incident-Secret`), **not** JWT/RBAC —
IncidentAI holds no ERP user token. Forwarded to the production service, which
writes `audit.incident_links.incident_status`.

Accepted bodies (either shape):

```jsonc
// flat
{ "correlation_id": "<uuid>", "incident_id": "INC-…", "status": "RESOLVED" }

// ticket-shaped (an IncidentAI ticket object / webhook body)
{ "event": "ticket.updated",
  "ticket": { "id": "INC-…", "ticket_number": "TKT-9001",
              "correlation_id": "<uuid>", "status": "VERIFIED" } }
```

`status` is IncidentAI's own vocabulary. The **single** mapper
`incident.NormalizeStatus` (`backend/pkg/incident/incident.go`) collapses every
`INCIDENT_STATUSES` value onto the four ERP states:

| IncidentAI `ticket.status` | ERP `incident_status` |
|---|---|
| `NEW`, `OPEN` | `OPEN` |
| `TRIAGED`, `ASSIGNED`, `IN_PROGRESS`, `REMEDIATION_PENDING`, `APPROVED`, `VERIFICATION`, `VERIFICATION_FAILED`, `ROLLBACK_REQUIRED`, `ESCALATED`, `BLOCKED`, `REOPENED` | `IN_PROGRESS` |
| `RESOLVED`, `VERIFIED`, `KNOWLEDGE_CAPTURED`, `SELF_SERVICE_RESOLVED`, `RESOLVED_DUPLICATE_MERGED`, `CLOSED` | `RESOLVED` |
| `ROLLED_BACK` | `ROLLED_BACK` |

Typical transitions IncidentAI would post:

| Developer action in IncidentAI | `status` sent | ERP shows |
|---|---|---|
| picks up the ticket | `TRIAGED` / `ASSIGNED` | `● IN PROGRESS` |
| verification passes / patch applied | `VERIFIED` / `RESOLVED` | `● RESOLVED` |
| fix reverted | `ROLLED_BACK` | `● ROLLED BACK` |

## 3. How IncidentAI actually calls back

IncidentAI has **no outbound webhook** today and cannot be modified in this pass.
Two ways to drive the callback, both using only existing public APIs:

- **`scripts/incidentai-status-bridge.mjs`** (recommended for the demo) — a small
  sidecar that logs into IncidentAI (`developer@incidentai.demo` / `demopass123`),
  polls `GET /api/tickets`, and forwards the status of every ERP-originated
  ticket to the ERP callback. This *is* the webhook, implemented as a sidecar.
  Run it alongside the demo: `node scripts/incidentai-status-bridge.mjs`.
- **`scripts/incident_status_push.sh <corr|incident id> <STATUS>`** — a one-shot
  manual push (testing / fallback).

The moment IncidentAI adds a real webhook, point it at
`POST http://<gateway>/api/incident-callback/status` with the shared-secret
header — no ERP change required.

## 4. The relationship (persisted)

`audit.incident_links` (one row per escalated failure):

| column | meaning |
|---|---|
| `correlation_id` (UNIQUE) | gateway `X-Correlation-ID` — the idempotency key and the join to `production_runs.correlation_id` |
| `transaction_id` | ERP domain row id (`production_runs.id`, …) |
| `module`, `operation`, `product_id`, `sku`, `route`, `error_message` | failure context |
| `incident_id`, `incident_number` | IncidentAI ticket identity |
| `incident_status` | `OPEN` → `IN_PROGRESS` → `RESOLVED` / `ROLLED_BACK` |
| `incident_ai_status` | raw IncidentAI status, for reference |

`GET /production/runs` left-joins this table onto each run, so the ERP UI's
IncidentAI column is always DB-backed. Survives browser refresh and service
restart.

## 5. Config

| var | default | used by |
|---|---|---|
| `INCIDENTAI_INGEST_URL` | `http://localhost:4000/api/incidents/ingest` | inventory / production / procurement services |
| `INCIDENT_CALLBACK_SECRET` | `erp-incident-callback-dev-secret` | gateway callback route, bridge, push script |
| `PRODUCTION_WAREHOUSE_NAME` | `Main Warehouse` | production warehouse resolution |
| `NEXT_PUBLIC_INCIDENTAI_URL` | `http://localhost:3000` | ERP "Open in IncidentAI" link |
| `NEXT_PUBLIC_INCIDENTAI_INGEST_URL` | `http://localhost:4000/api/incidents/ingest` | manual "Report Issue" modal |

## 6. Deep link

IncidentAI's SPA has no client-side router and reads no URL parameter — it
auto-selects the newest ticket (`tickets[0]`, queue ordered `created_at DESC`).
An auto-escalated ERP failure *is* the newest ticket when the operator clicks
through, so `http://localhost:3000/?incident=<id>&ticket=<number>` opens exactly
that incident. The query string is deterministic and forward-compatible: if
IncidentAI later adds `?incident=` handling, the link deep-selects with no ERP
change.

## 7. Verification

| script | proves |
|---|---|
| `scripts/verify_golden_path.sh` | clean seed, warehouse resolution, failure → auto-incident, correlation chain, transaction link, duplicate protection, callback (flat + ticket-shaped, IncidentAI vocabulary), **restart persistence**, **rollback**, clean success path |
| `scripts/verify_gateway_e2e.sh` | the same through the real gateway (gateway-issued correlation id == incident id) |
| `scripts/verify_full_loop.sh` | end-to-end against the **real IncidentAI**: real failure → real ticket → developer `PATCH` in IncidentAI → **bridge** → ERP status, RESOLVED and ROLLED_BACK |
