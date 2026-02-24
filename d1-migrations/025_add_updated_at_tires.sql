-- Migration: add updated_at to tires (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('tires') WHERE name='updated_at';
ALTER TABLE tires ADD COLUMN updated_at TEXT;
UPDATE tires SET updated_at = datetime('now') WHERE updated_at IS NULL;

