-- Finance schema tables
CREATE TABLE IF NOT EXISTS finance.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- asset, liability, equity, revenue, expense
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES finance.accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    description VARCHAR(512),
    reference_id VARCHAR(255),
    correlation_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL, -- Logical ref to purchase order
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, overdue
    pdf_url VARCHAR(512),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_finance_outbox_published ON finance.outbox_events(published) WHERE published = FALSE;

-- Seed default chart of accounts
INSERT INTO finance.accounts (name, type, balance) VALUES
('Raw Materials Inventory', 'asset', 0.00),
('Accounts Payable', 'liability', 0.00),
('Cash & Cash Equivalents', 'asset', 1000000.00), -- Let's start with $1M in cash
('Cost of Goods Sold', 'expense', 0.00)
ON CONFLICT (name) DO NOTHING;
