-- Inventory schema tables
CREATE TABLE IF NOT EXISTS inventory.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    capacity NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES inventory.products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reserved_qty NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reorder_point NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES inventory.products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id) ON DELETE CASCADE,
    delta NUMERIC(12, 2) NOT NULL,
    type VARCHAR(50) NOT NULL, -- incoming, outgoing, adjustment, reservation
    reference_id VARCHAR(255),
    correlation_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_outbox_published ON inventory.outbox_events(published) WHERE published = FALSE;

-- Seed initial Warehouse
INSERT INTO inventory.warehouses (name, location, capacity)
VALUES ('Main Warehouse', 'Detroit, MI', 10000.00)
ON CONFLICT DO NOTHING;
