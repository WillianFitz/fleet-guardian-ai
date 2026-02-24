-- Migration: add updated_at to ctes (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('ctes') WHERE name='updated_at';
ALTER TABLE ctes ADD COLUMN updated_at TEXT;
UPDATE ctes SET updated_at = datetime('now') WHERE updated_at IS NULL;

