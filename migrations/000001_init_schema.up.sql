-- 1. Merchants
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    api_key_id VARCHAR(255) NOT NULL UNIQUE,
    api_key_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    contact_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Products (Contradiction #3 Resolved: Standardized on is_active BOOLEAN)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    price_paise BIGINT NOT NULL, -- Contradiction #2 Resolved: Explicit paise naming
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    image_url TEXT,
    content_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(merchant_id, sku)
);

-- 3. Product Inventory (Separated for high-write concurrency)
CREATE TABLE product_inventory (
    product_id UUID PRIMARY KEY REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Agents
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hmac_key_id VARCHAR(255) NOT NULL UNIQUE,
    hmac_secret_hash VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Authorization Grants
CREATE TABLE authorization_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    granted_by VARCHAR(255) NOT NULL,
    merchant_id UUID REFERENCES merchants(id), -- Null means global
    max_amount_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    allowed_categories TEXT[] NOT NULL DEFAULT '{}',
    denied_categories TEXT[] NOT NULL DEFAULT '{}',
    max_single_transaction BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- 6. Grant Usage (Contradiction #1 Resolved: amount_reserved added)
CREATE TABLE grant_usage (
    grant_id UUID PRIMARY KEY REFERENCES authorization_grants(id),
    amount_consumed BIGINT NOT NULL DEFAULT 0,
    amount_reserved BIGINT NOT NULL DEFAULT 0, -- CRITICAL for the Reservation Saga
    transaction_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. Transactions (Contradiction #5 Resolved: gateway_order_id lives here)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    grant_id UUID NOT NULL REFERENCES authorization_grants(id),
    session_id UUID,
    idempotency_key VARCHAR(255) NOT NULL,
    catalog_version_id UUID,
    status VARCHAR(50) NOT NULL,
    total_amount_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    gateway_order_id VARCHAR(255), -- Maps to Razorpay order_id
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. Idempotency Keys (Contradiction #4 Resolved: Dedicated scoped table)
CREATE TABLE idempotency_keys (
    key VARCHAR(255) NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id),
    scope VARCHAR(50) NOT NULL, -- e.g., 'proposal', 'payment'
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, key, scope)
);

-- 9. Audit Events
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    event_type VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 10. Security Events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id), -- Can be null for unknown attackers
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 11. Policy Decisions
CREATE TABLE policy_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    decision VARCHAR(50) NOT NULL,
    amount_paise BIGINT NOT NULL,
    reasoning TEXT NOT NULL,
    spending_check BOOLEAN NOT NULL,
    time_check BOOLEAN NOT NULL,
    active_check BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_products_merchant ON products(merchant_id) WHERE is_active = true;
CREATE INDEX idx_transactions_merchant ON transactions(merchant_id, created_at DESC);
CREATE INDEX idx_transactions_agent ON transactions(agent_id, created_at DESC);
