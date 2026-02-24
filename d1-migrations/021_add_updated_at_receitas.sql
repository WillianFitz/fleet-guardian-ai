-- Migration: add updated_at to receitas (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('receitas') WHERE name='updated_at';
ALTER TABLE receitas ADD COLUMN updated_at TEXT;
UPDATE receitas SET updated_at = datetime('now') WHERE updated_at IS NULL;

