-- Migration: add updated_at to expenses (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('expenses') WHERE name='updated_at';
ALTER TABLE expenses ADD COLUMN updated_at TEXT;
UPDATE expenses SET updated_at = datetime('now') WHERE updated_at IS NULL;

