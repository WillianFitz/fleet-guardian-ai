-- Migração: adicionar tabela Receitas/Fretes
-- Execute este script em bancos D1 existentes que ainda não possuem a tabela receitas.

CREATE TABLE IF NOT EXISTS receitas (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT DEFAULT 'Frete',
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  veiculo_placa TEXT,
  cliente TEXT,
  cte_id TEXT REFERENCES ctes(id),
  cte_chave TEXT,
  cte_numero TEXT,
  nota_fiscal TEXT,
  status TEXT CHECK(status IN ('pendente','recebido','cancelado')) DEFAULT 'pendente',
  forma_pagamento TEXT,
  data_recebimento TEXT,
  observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_receitas_tenant ON receitas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receitas_cte ON receitas(tenant_id, cte_id);

-- Atualizar tabela ctes para usar receita_id ao invés de expense_id (se ainda não foi atualizada)
-- Se a coluna expense_id existir e receita_id não existir, migrar dados e renomear
-- (SQLite não suporta ALTER COLUMN diretamente, então criamos nova coluna e copiamos)

-- Verificar se receita_id já existe (se não, criar)
-- Nota: SQLite não tem IF NOT EXISTS para colunas, então execute manualmente se necessário:
-- ALTER TABLE ctes ADD COLUMN receita_id TEXT REFERENCES receitas(id);
