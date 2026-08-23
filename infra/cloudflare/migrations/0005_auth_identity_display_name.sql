PRAGMA foreign_keys = OFF;

ALTER TABLE auth_identities ADD COLUMN display_name TEXT;

PRAGMA foreign_keys = ON;
