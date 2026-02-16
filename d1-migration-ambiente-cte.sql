-- Migração: adicionar campo ambiente_cte na tabela tenants
-- Execute este script em bancos D1 existentes que ainda não possuem o campo ambiente_cte.

-- Adicionar coluna ambiente_cte (padrão: homologacao)
ALTER TABLE tenants ADD COLUMN ambiente_cte TEXT CHECK(ambiente_cte IN ('producao','homologacao')) DEFAULT 'homologacao';

-- Atualizar registros existentes para homologacao (se necessário)
UPDATE tenants SET ambiente_cte = 'homologacao' WHERE ambiente_cte IS NULL;
