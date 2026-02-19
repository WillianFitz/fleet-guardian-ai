-- Migration: adicionar tabela nfe_search_state para controlar buscas NFe por tenant
CREATE TABLE IF NOT EXISTS nfe_search_state (
  tenant_id TEXT PRIMARY KEY,
  last_ult_nsu INTEGER DEFAULT 0,
  last_search_at TEXT,
  in_progress INTEGER DEFAULT 0,
  blocked_until TEXT
);

