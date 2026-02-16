-- Migração: adicionar tabela CTes (Conhecimento de Transporte Eletrônico)
-- Execute este script em bancos D1 existentes que ainda não possuem a tabela ctes.

CREATE TABLE IF NOT EXISTS ctes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chave TEXT,
  numero TEXT NOT NULL,
  serie TEXT DEFAULT '1',
  veiculo_placa TEXT,
  veiculo_modelo TEXT,
  data_emissao TEXT NOT NULL,
  data_inicio_viagem TEXT,
  valor_prestacao REAL DEFAULT 0,
  valor_frete REAL,
  remetente_nome TEXT,
  remetente_cnpj_cpf TEXT,
  remetente_municipio TEXT,
  remetente_uf TEXT,
  destinatario_nome TEXT,
  destinatario_cnpj_cpf TEXT,
  destinatario_municipio TEXT,
  destinatario_uf TEXT,
  municipio_origem TEXT,
  uf_origem TEXT,
  municipio_destino TEXT,
  uf_destino TEXT,
  status TEXT CHECK(status IN ('rascunho','autorizado','rejeitado','cancelado','erro')) DEFAULT 'rascunho',
  protocolo TEXT,
  motivo_rejeicao TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  expense_id TEXT REFERENCES expenses(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ctes_tenant ON ctes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ctes_status ON ctes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ctes_veiculo ON ctes(tenant_id, veiculo_placa);
