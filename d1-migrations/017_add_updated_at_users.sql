-- Migration: add updated_at to users (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('users') WHERE name='updated_at';
ALTER TABLE users ADD COLUMN updated_at TEXT;
UPDATE users SET updated_at = datetime('now') WHERE updated_at IS NULL;

