PRAGMA foreign_keys = OFF;

-- The original active-code migration scoped idempotency to (code, key). A
-- browser may legitimately reuse a request id for a scan and a subsequent
-- view event, so the event type is part of the identity as well.
CREATE TABLE IF NOT EXISTS qr_access_events_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  version_id TEXT REFERENCES qr_code_versions(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN ('scan','view','click','download','play')),
  idempotency_key TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  UNIQUE(code_id, event, idempotency_key)
);

INSERT OR IGNORE INTO qr_access_events_v2 (id, code_id, version_id, event, idempotency_key, metadata_json, occurred_at)
SELECT id, code_id, version_id, event, idempotency_key, metadata_json, occurred_at
FROM qr_access_events;

DROP INDEX IF EXISTS idx_qr_access_events_code;
DROP TABLE qr_access_events;
ALTER TABLE qr_access_events_v2 RENAME TO qr_access_events;
CREATE INDEX IF NOT EXISTS idx_qr_access_events_code ON qr_access_events(code_id, occurred_at DESC);

PRAGMA foreign_keys = ON;
