-- 1. Insert Merchant
INSERT INTO merchants (id, name, description, api_key_id, api_key_hash, status, created_at, updated_at) 
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Tech Corp Merchant', 
    'Test Merchant', 
    'key_test_merchant', 
    'mock_hash_value', 
    'active', 
    NOW(), 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 2. Insert Agent
INSERT INTO agents (id, name, description, hmac_key_id, hmac_secret_hash, agent_type, status, created_at)
VALUES (
    '22222222-2222-2222-2222-222222222222', 
    'Aegis Test Agent', 
    'Agentic Commerce AI', 
    'agent_key_test', 
    'mock_hash_value', 
    'autonomous', 
    'active', 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 3. Insert Product (Original)
INSERT INTO products (id, merchant_id, sku, name, description, category, price_paise, currency, content_hash, is_active, created_at, updated_at)
VALUES (
    '33333333-3333-3333-3333-333333333333', 
    '11111111-1111-1111-1111-111111111111', 
    'SKU-AI-PREMIUM', 
    'Premium AI Subscription', 
    'One month of premium AI features', 
    'software',
    50000, -- ₹500 (in paise)
    'INR', 
    '7e9cc1332ee6e26fbd765539751942b735c582aba936961ce85a5c06df817730',
    true, 
    NOW(), 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 3.1 Insert AI Developer Plan
INSERT INTO products (id, merchant_id, sku, name, description, category, price_paise, currency, content_hash, is_active, created_at, updated_at)
VALUES (
    '99999999-9999-9999-9999-999999999991', 
    '11111111-1111-1111-1111-111111111111', 
    'SKU-DEV-PLAN', 
    'AI Developer Plan', 
    'Production-ready AI development workstation environment.', 
    'software',
    50000, -- ₹500
    'INR', 
    'f34e26701f267ad963985c51001729895669189117b1f98f5d34f511b0a0161a',
    true, 
    NOW(), 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 3.2 Insert Compute Credits
INSERT INTO products (id, merchant_id, sku, name, description, category, price_paise, currency, content_hash, is_active, created_at, updated_at)
VALUES (
    '99999999-9999-9999-9999-999999999992', 
    '11111111-1111-1111-1111-111111111111', 
    'SKU-COMPUTE', 
    'Compute Credits', 
    'Inference and workload capacity.', 
    'credits',
    29900, -- ₹299
    'INR', 
    'c021a5c945dbd6bee495de960e02dfa6d4d3d0bef269bcbf8d7919de5150d356',
    true, 
    NOW(), 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 3.3 Insert Vector DB Credits
INSERT INTO products (id, merchant_id, sku, name, description, category, price_paise, currency, content_hash, is_active, created_at, updated_at)
VALUES (
    '99999999-9999-9999-9999-999999999993', 
    '11111111-1111-1111-1111-111111111111', 
    'SKU-VECTOR', 
    'Vector DB Credits', 
    'Semantic search and retrieval capacity.', 
    'credits',
    19900, -- ₹199
    'INR', 
    '0a09d37a9b0fd81b33db373eb0ca85d5302c6214bff2456be404dade63a15e46',
    true, 
    NOW(), 
    NOW()
)
ON CONFLICT DO NOTHING;

-- 4. Insert Inventory
INSERT INTO product_inventory (product_id, quantity, reserved_quantity, updated_at)
VALUES 
    ('33333333-3333-3333-3333-333333333333', 100, 0, NOW()),
    ('99999999-9999-9999-9999-999999999991', 100, 0, NOW()),
    ('99999999-9999-9999-9999-999999999992', 100, 0, NOW()),
    ('99999999-9999-9999-9999-999999999993', 100, 0, NOW())
ON CONFLICT DO NOTHING;

-- 5. Insert Authorization Grant (Limit: ₹1000)
INSERT INTO authorization_grants (id, agent_id, granted_by, merchant_id, max_amount_paise, currency, status, created_at, expires_at)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'System Admin',
    '11111111-1111-1111-1111-111111111111',
    100000, -- ₹1000 limit
    'INR',
    'active',
    NOW(),
    NOW() + INTERVAL '30 days'
)
ON CONFLICT DO NOTHING;

-- 6. Insert Grant Usage (Starting at 0 spent)
INSERT INTO grant_usage (grant_id, amount_consumed, amount_reserved, transaction_count, updated_at)
VALUES ('44444444-4444-4444-4444-444444444444', 0, 0, 0, NOW())
ON CONFLICT DO NOTHING;
