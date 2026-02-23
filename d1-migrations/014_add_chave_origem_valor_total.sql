-- Migration: adiciona colunas chave_origem e valor_total na tabela ctes
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

ALTER TABLE ctes ADD COLUMN chave_origem TEXT;
ALTER TABLE ctes ADD COLUMN valor_total REAL DEFAULT 0;

COMMIT;
PRAGMA foreign_keys=on;

