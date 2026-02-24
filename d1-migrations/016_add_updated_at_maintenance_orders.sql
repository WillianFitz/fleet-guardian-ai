-- Migration: add updated_at to maintenance_orders (run only if column missing)
-- Check before running:
-- SELECT name FROM pragma_table_info('maintenance_orders') WHERE name='updated_at';
ALTER TABLE maintenance_orders ADD COLUMN updated_at TEXT;
UPDATE maintenance_orders SET updated_at = datetime('now') WHERE updated_at IS NULL;

