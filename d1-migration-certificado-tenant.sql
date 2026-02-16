-- Migração: adicionar campos de certificado digital na tabela tenants
-- Execute este script em bancos D1 existentes

-- Adicionar colunas de certificado
ALTER TABLE tenants ADD COLUMN certificado_pfx_base64 TEXT;
ALTER TABLE tenants ADD COLUMN certificado_password TEXT;
ALTER TABLE tenants ADD COLUMN certificado_status TEXT CHECK(certificado_status IN ('nao_configurado','configurado','valido','invalido','expirado')) DEFAULT 'nao_configurado';
ALTER TABLE tenants ADD COLUMN certificado_valido_ate TEXT;
ALTER TABLE tenants ADD COLUMN certificado_cnpj TEXT;

-- Atualizar registros existentes
UPDATE tenants SET certificado_status = 'nao_configurado' WHERE certificado_status IS NULL;
