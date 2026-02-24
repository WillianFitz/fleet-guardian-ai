-- Migration: add updated_at to fuel_entries (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('fuel_entries') WHERE name='updated_at';
ALTER TABLE fuel_entries ADD COLUMN updated_at TEXT;
UPDATE fuel_entries SET updated_at = datetime('now') WHERE updated_at IS NULL;

