-- Script seguro para remover tenant e dados relacionados
-- Tenant ID: b0a54a0806924e989954aa6501a6ebf2
-- IMPORTANTE: faça backup antes de executar.

-- 1) Backup do tenant (copia para tabela tenants_backup)
CREATE TABLE IF NOT EXISTS tenants_backup AS SELECT * FROM tenants WHERE 1=0;
INSERT INTO tenants_backup SELECT *, datetime('now') AS backup_at FROM tenants WHERE id = 'b0a54a0806924e989954aa6501a6ebf2';

-- 2) Verificar contagens (revise antes de executar deletes)
SELECT 'users' AS table_name, COUNT(*) AS cnt FROM users WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
SELECT 'vehicles' AS table_name, COUNT(*) AS cnt FROM vehicles WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
SELECT 'ctes' AS table_name, COUNT(*) AS cnt FROM ctes WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
SELECT 'receitas' AS table_name, COUNT(*) AS cnt FROM receitas WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
SELECT 'nfe_search_state' AS table_name, COUNT(*) AS cnt FROM nfe_search_state WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
-- Adicione aqui outras tabelas que existirem no seu schema, se necessário.

-- 3) Deletar dados dependentes (ordem: filhos -> pai)
BEGIN TRANSACTION;

DELETE FROM users WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM vehicles WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM drivers WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM maintenance_orders WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM fuel_entries WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM tires WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM parts WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM expenses WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM licenses WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM insurances WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM incidents WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM garage_entries WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM ctes WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';
DELETE FROM receitas WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';

-- remover estado de busca / bloqueios e retries
DELETE FROM nfe_search_state WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';

-- por fim, remover o tenant
DELETE FROM tenants WHERE id = 'b0a54a0806924e989954aa6501a6ebf2';

COMMIT;

-- 4) Verificação final (deve retornar zero linhas)
SELECT id, nome, cnpj FROM tenants WHERE id = 'b0a54a0806924e989954aa6501a6ebf2';
SELECT tenant_id FROM nfe_search_state WHERE tenant_id = 'b0a54a0806924e989954aa6501a6ebf2';

-- FIM
