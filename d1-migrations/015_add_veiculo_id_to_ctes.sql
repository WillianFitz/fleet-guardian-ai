-- Migration: adiciona coluna veiculo_id na tabela ctes para vincular ao veículo cadastrado
ALTER TABLE ctes ADD COLUMN veiculo_id TEXT;

