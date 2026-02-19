-- Migration: adicionar colunas retry_count e next_retry_at na tabela nfe_search_state
ALTER TABLE nfe_search_state ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE nfe_search_state ADD COLUMN next_retry_at TEXT;

