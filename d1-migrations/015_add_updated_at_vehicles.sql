-- Migration: add updated_at to vehicles (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('vehicles') WHERE name='updated_at';
ALTER TABLE vehicles ADD COLUMN updated_at TEXT;
UPDATE vehicles SET updated_at = datetime('now') WHERE updated_at IS NULL;

