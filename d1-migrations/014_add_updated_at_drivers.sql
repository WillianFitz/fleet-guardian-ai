-- Add updated_at column to drivers (no constant default allowed in ALTER TABLE)
ALTER TABLE drivers ADD COLUMN updated_at TEXT;

-- Populate existing rows with current timestamp where null
UPDATE drivers SET updated_at = datetime('now') WHERE updated_at IS NULL;

