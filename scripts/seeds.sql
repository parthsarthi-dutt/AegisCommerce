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

-- 3. Insert Product
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

-- 4. Insert Inventory
INSERT INTO product_inventory (product_id, quantity, reserved_quantity, updated_at)
VALUES ('33333333-3333-3333-3333-333333333333', 100, 0, NOW())
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
