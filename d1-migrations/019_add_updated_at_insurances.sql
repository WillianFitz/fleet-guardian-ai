-- Migration: add updated_at to insurances (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('insurances') WHERE name='updated_at';
ALTER TABLE insurances ADD COLUMN updated_at TEXT;
UPDATE insurances SET updated_at = datetime('now') WHERE updated_at IS NULL;

