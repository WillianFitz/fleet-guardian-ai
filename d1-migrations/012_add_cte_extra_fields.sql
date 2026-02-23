-- Migration: adiciona campos extras na tabela ctes para suporte a infCarga, informacoes adicionais e flags
ALTER TABLE ctes ADD COLUMN inf_carga TEXT;
ALTER TABLE ctes ADD COLUMN informacoes_adicionais TEXT;
ALTER TABLE ctes ADD COLUMN tomador TEXT;
ALTER TABLE ctes ADD COLUMN numero_nota TEXT;
ALTER TABLE ctes ADD COLUMN has_expedidor INTEGER DEFAULT 0;
ALTER TABLE ctes ADD COLUMN has_recebedor INTEGER DEFAULT 0;
ALTER TABLE ctes ADD COLUMN cfop TEXT;
ALTER TABLE ctes ADD COLUMN emitir_retroativo INTEGER DEFAULT 0;
ALTER TABLE ctes ADD COLUMN texto_nota TEXT;

