SELECT 'drivers' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM drivers;
SELECT 'vehicles' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM vehicles;
SELECT 'maintenance_orders' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM maintenance_orders;
SELECT 'users' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM users;
SELECT 'licenses' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM licenses;
SELECT 'insurances' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM insurances;
SELECT 'ctes' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM ctes;
SELECT 'receitas' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM receitas;
SELECT 'parts' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM parts;
SELECT 'expenses' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM expenses;
SELECT 'fuel_entries' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM fuel_entries;
SELECT 'tires' AS table_name, COUNT(*) AS total, SUM(CASE WHEN updated_at IS NOT NULL THEN 1 ELSE 0 END) AS has_updated_at FROM tires;

