-- ============================================================================
-- Cloudflare D1 SQL Schema for Hendy App Store, Admin Panel & Support Mini App
-- Database: hendy_production_db
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER UNIQUE,
    username TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    balance_hndy INTEGER DEFAULT 1000,
    balance_ton REAL DEFAULT 0.0,
    balance_usdt REAL DEFAULT 0.0,
    level INTEGER DEFAULT 1,
    role TEXT DEFAULT 'customer', -- 'customer', 'support', 'admin'
    is_blocked INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products & Digital Store Catalog (Play Store / App Store format)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'apps', 'gaming', 'ai_tools', 'subscriptions', 'collectible'
    short_description TEXT,
    full_description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    rating REAL DEFAULT 4.8,
    reviews_count INTEGER DEFAULT 120,
    price_hndy INTEGER NOT NULL,
    price_usd REAL DEFAULT 0.0,
    download_size TEXT DEFAULT '14.2 MB',
    developer TEXT NOT NULL,
    version TEXT DEFAULT '1.0.0',
    status TEXT DEFAULT 'published', -- 'draft', 'published', 'archived'
    package_r2_key TEXT, -- Cloudflare R2 key for application zip/bundle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Product Screenshots / Media (Stored in Cloudflare R2)
CREATE TABLE IF NOT EXISTS product_screenshots (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    r2_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. Order Queue
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_title TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_hndy INTEGER NOT NULL,
    currency TEXT DEFAULT 'HNDY',
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled', 'refunded'
    issued_code TEXT, -- License key or digital gift code issued
    support_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 5. Deposit Queue & Approvals
CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    currency TEXT NOT NULL, -- 'TON', 'USDT', 'FIAT_VND', 'FIAT_USD'
    amount REAL NOT NULL,
    rate_to_hndy INTEGER NOT NULL, -- Conversion rate to $HNDY
    credited_hndy INTEGER NOT NULL,
    tx_hash TEXT UNIQUE, -- Blockchain or banking transaction reference
    proof_image_r2_key TEXT, -- R2 receipt screenshot
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewer_notes TEXT,
    reviewed_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 6. Secure Cryptographic Gift Codes
CREATE TABLE IF NOT EXISTS gift_codes (
    code TEXT PRIMARY KEY,
    code_hash TEXT UNIQUE NOT NULL, -- SHA-256 for integrity verification
    batch_id TEXT,
    hndy_value INTEGER NOT NULL,
    bonus_xp INTEGER DEFAULT 100,
    max_redemptions INTEGER DEFAULT 1,
    redeemed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- 'active', 'redeemed', 'expired', 'revoked'
    expires_at TIMESTAMP,
    created_by TEXT DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Gift Code Redemptions Log
CREATE TABLE IF NOT EXISTS gift_code_redemptions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    credited_hndy INTEGER NOT NULL,
    ip_address TEXT,
    FOREIGN KEY(code) REFERENCES gift_codes(code),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 8. Customer Support Tickets & Mini App Timeline
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);


-- 9. Live Telegram Mini App menu and public UI configuration
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
