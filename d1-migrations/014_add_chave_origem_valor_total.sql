-- Migration: adiciona colunas chave_origem e valor_total na tabela ctes
-- Observação: Cloudflare D1 (Wrangler) rejeita BEGIN/COMMIT em execuções remotas.
-- Aqui usamos apenas os ALTER TABLE independentes.
ALTER TABLE ctes ADD COLUMN chave_origem TEXT;
ALTER TABLE ctes ADD COLUMN valor_total REAL DEFAULT 0;

