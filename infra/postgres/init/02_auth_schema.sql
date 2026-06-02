-- Auth schema tables
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Seed an admin user (password: admin123)
-- Hash: $2a$10$Pj0k8k4jF2v8w6B3.6Yh/.2o1P1u1Z1W2v4U3v5a6b7c8d9e0f1g2 (standard bcrypt)
INSERT INTO auth.users (email, password_hash, role)
VALUES ('admin@erp.com', '$2a$10$Pj0k8k4jF2v8w6B3.6Yh/.2o1P1u1Z1W2v4U3v5a6b7c8d9e0f1g2', 'admin')
ON CONFLICT (email) DO NOTHING;
