-- Audit schema tables
CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    service VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    correlation_id VARCHAR(255),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, processed_at)
) PARTITION BY RANGE (processed_at);

-- Create initial partitions for 2026 and 2027
CREATE TABLE IF NOT EXISTS audit.audit_logs_2026_h1 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS audit.audit_logs_2026_h2 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS audit.audit_logs_2027_h1 PARTITION OF audit.audit_logs
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');

-- Fallback default partition
CREATE TABLE IF NOT EXISTS audit.audit_logs_default PARTITION OF audit.audit_logs DEFAULT;
