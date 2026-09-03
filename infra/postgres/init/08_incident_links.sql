-- ============================================================================
-- ERP <-> IncidentAI link table
-- ----------------------------------------------------------------------------
-- One row per ERP operational failure that was (or is being) escalated to
-- IncidentAI. This is the durable relationship the ERP keeps after the toast /
-- modal disappears:
--
--   ERP transaction (transaction_id)
--        -> correlation_id  (the gateway's X-Correlation-ID, authoritative)
--        -> IncidentAI incident_id / incident_number
--        -> IncidentAI resolution status (incident_status)
--
-- Lives in the cross-cutting `audit` schema. Written by the Go services via the
-- shared `backend/pkg/incident` package; status is updated by IncidentAI through
-- the gateway callback endpoint  POST /api/incident-callback/status.
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.incident_links (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Idempotency key: the ERP gateway correlation id for the failing operation.
    -- One failed operation == one correlation id == at most one incident.
    correlation_id     VARCHAR(255) NOT NULL UNIQUE,
    -- The ERP domain row this failure belongs to (e.g. production_runs.id).
    transaction_id     VARCHAR(255),
    module             VARCHAR(100) NOT NULL,   -- Production | Inventory | Procurement
    operation          VARCHAR(120) NOT NULL,   -- e.g. production_run.create
    product_id         VARCHAR(255),
    sku                VARCHAR(100),
    route              VARCHAR(255),            -- ERP UI route for the return link
    error_message      TEXT NOT NULL,           -- the real backend error
    -- IncidentAI side, filled in once ingest returns.
    incident_id        VARCHAR(255),
    incident_number    VARCHAR(255),
    -- ERP-side lifecycle. OPEN on creation; advanced by the IncidentAI callback.
    incident_status    VARCHAR(50) NOT NULL DEFAULT 'OPEN',  -- OPEN | IN_PROGRESS | RESOLVED | ROLLED_BACK
    -- Raw status string reported by IncidentAI, kept for reference/debugging.
    incident_ai_status VARCHAR(120),
    reporter           VARCHAR(255),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_links_txn      ON audit.incident_links(transaction_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_incident ON audit.incident_links(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_status   ON audit.incident_links(incident_status);
