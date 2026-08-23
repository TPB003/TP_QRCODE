PRAGMA foreign_keys = OFF;

ALTER TABLE qr_codes ADD COLUMN last_published_revision INTEGER;

PRAGMA foreign_keys = ON;
