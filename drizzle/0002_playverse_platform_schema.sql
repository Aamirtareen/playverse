DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2563eb',
  icon TEXT NOT NULL DEFAULT '🎮',
  target_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  thumbnail_blob_key TEXT,
  game_url TEXT,
  embed_url TEXT,
  provider_id INTEGER,
  game_type TEXT NOT NULL DEFAULT 'iframe',
  builtin_key TEXT,
  controls TEXT NOT NULL DEFAULT '{}',
  license_info TEXT NOT NULL DEFAULT '{}',
  featured INTEGER NOT NULL DEFAULT 0,
  trending INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);
--> statement-breakpoint
CREATE INDEX games_status_idx ON games (status);
--> statement-breakpoint
CREATE INDEX games_provider_idx ON games (provider_id);
--> statement-breakpoint
CREATE INDEX games_featured_idx ON games (featured);
--> statement-breakpoint
CREATE INDEX games_trending_idx ON games (trending);
--> statement-breakpoint
CREATE INDEX games_published_idx ON games (published_at);
--> statement-breakpoint
CREATE TABLE game_categories (
  game_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX game_categories_pair ON game_categories (game_id, category_id);
--> statement-breakpoint
CREATE INDEX game_categories_category_idx ON game_categories (category_id);
--> statement-breakpoint
CREATE TABLE game_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'not_connected',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE provider_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL UNIQUE,
  environment TEXT NOT NULL DEFAULT 'production',
  config TEXT NOT NULL DEFAULT '{}',
  api_key_set INTEGER NOT NULL DEFAULT 0,
  allowlist_domains TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE provider_import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  imported INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  game_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX favorites_pair ON favorites (visitor_id, game_id);
--> statement-breakpoint
CREATE TABLE game_plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  visitor_id TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  referrer TEXT NOT NULL DEFAULT 'direct',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX game_plays_game_idx ON game_plays (game_id);
--> statement-breakpoint
CREATE TABLE page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE website_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE seo_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE ad_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  placement_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'none',
  enabled INTEGER NOT NULL DEFAULT 0,
  publisher_id TEXT NOT NULL DEFAULT '',
  network_code TEXT NOT NULL DEFAULT '',
  ad_unit_path TEXT NOT NULL DEFAULT '',
  sizes TEXT NOT NULL DEFAULT 'responsive',
  show_desktop INTEGER NOT NULL DEFAULT 1,
  show_mobile INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE static_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE redirect_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  created_at INTEGER NOT NULL
);
