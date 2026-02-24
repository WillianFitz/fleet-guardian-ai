-- Migration: add updated_at to licenses (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('licenses') WHERE name='updated_at';
ALTER TABLE licenses ADD COLUMN updated_at TEXT;
UPDATE licenses SET updated_at = datetime('now') WHERE updated_at IS NULL;

