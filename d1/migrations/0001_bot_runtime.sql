-- Durable Telegram bot state and webhook update idempotency.
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  username TEXT DEFAULT '',
  language_code TEXT DEFAULT 'en',
  coins INTEGER NOT NULL DEFAULT 1000,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 50,
  energy INTEGER NOT NULL DEFAULT 1000,
  max_energy INTEGER NOT NULL DEFAULT 1000,
  tap_power INTEGER NOT NULL DEFAULT 2,
  streak INTEGER NOT NULL DEFAULT 0,
  last_daily_claim_at TEXT,
  referred_by TEXT,
  referrals_count INTEGER NOT NULL DEFAULT 0,
  completed_tasks TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_users_coins ON bot_users(coins DESC);
CREATE INDEX IF NOT EXISTS idx_bot_users_updated_at ON bot_users(updated_at);

CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing',
  received_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_updates_received_at ON telegram_updates(received_at);
