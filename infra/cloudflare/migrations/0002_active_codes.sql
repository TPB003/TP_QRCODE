PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS qr_codes (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image','video','audio','file','url','contact','text')),
  draft_content_json TEXT NOT NULL,
  draft_render_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','deleted')),
  published_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_qr_codes_owner_updated ON qr_codes(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_codes_public ON qr_codes(slug, status, deleted_at);

CREATE TABLE IF NOT EXISTS qr_code_versions (
  id TEXT PRIMARY KEY NOT NULL,
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  render_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE(code_id, version)
);
CREATE INDEX IF NOT EXISTS idx_qr_code_versions_code ON qr_code_versions(code_id, version DESC);

CREATE TABLE IF NOT EXISTS qr_code_assets (
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES qr_code_versions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'content',
  PRIMARY KEY(code_id, version_id, asset_id, role)
);
CREATE INDEX IF NOT EXISTS idx_qr_code_assets_asset ON qr_code_assets(asset_id);

CREATE TABLE IF NOT EXISTS qr_access_events (
  id TEXT PRIMARY KEY NOT NULL,
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES qr_code_versions(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN ('scan','view','click','download','play')),
  idempotency_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  UNIQUE(code_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_qr_access_events_code ON qr_access_events(code_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS analytics_daily_codes (
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  scans INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  plays INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(code_id, date)
);
