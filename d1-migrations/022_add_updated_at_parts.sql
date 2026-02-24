-- Migration: add updated_at to parts (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('parts') WHERE name='updated_at';
ALTER TABLE parts ADD COLUMN updated_at TEXT;
UPDATE parts SET updated_at = datetime('now') WHERE updated_at IS NULL;

