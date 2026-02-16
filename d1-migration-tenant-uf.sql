-- Adicionar campo UF na tabela tenants
ALTER TABLE tenants ADD COLUMN uf TEXT DEFAULT 'SP';
