-- Migração: adicionar colunas de endereço (CEP) na tabela ctes
-- Execute este script em bancos D1 existentes que já possuem a tabela ctes.
--
-- Motivo: o frontend agora salva campos separados (remetente/destinatário CEP, logradouro, número, bairro).
-- Sem essas colunas, o D1 retorna: "table ctes has no column named remetente_cep".

ALTER TABLE ctes ADD COLUMN remetente_cep TEXT;
ALTER TABLE ctes ADD COLUMN remetente_logradouro TEXT;
ALTER TABLE ctes ADD COLUMN remetente_numero TEXT;
ALTER TABLE ctes ADD COLUMN remetente_bairro TEXT;

ALTER TABLE ctes ADD COLUMN destinatario_cep TEXT;
ALTER TABLE ctes ADD COLUMN destinatario_logradouro TEXT;
ALTER TABLE ctes ADD COLUMN destinatario_numero TEXT;
ALTER TABLE ctes ADD COLUMN destinatario_bairro TEXT;

