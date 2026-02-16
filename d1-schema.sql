-- FleetCommand D1 Schema
-- Cloudflare D1 (SQLite) compatible
-- Multi-tenant ready

-- ==========================================
-- TENANTS
-- ==========================================
CREATE TABLE tenants (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  ambiente_cte TEXT CHECK(ambiente_cte IN ('producao','homologacao')) DEFAULT 'homologacao',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- USERS & AUTH
-- ==========================================
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin','gerente','operador','visualizador')) NOT NULL DEFAULT 'operador',
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- VEHICLES
-- ==========================================
CREATE TABLE vehicle_categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE vehicle_types (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  placa TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tipo TEXT,
  categoria TEXT,
  ano INTEGER,
  km INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('operando','manutencao','parado','vendido','sucateado','doado')) DEFAULT 'operando',
  motorista_id TEXT REFERENCES drivers(id),
  chassi TEXT,
  renavam TEXT,
  cor TEXT,
  combustivel TEXT DEFAULT 'Diesel S10',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, placa)
);

-- ==========================================
-- DRIVERS
-- ==========================================
CREATE TABLE drivers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  cnh TEXT,
  categoria_cnh TEXT,
  vencimento_cnh TEXT,
  telefone TEXT,
  email TEXT,
  status TEXT CHECK(status IN ('ativo','inativo','ferias','afastado')) DEFAULT 'ativo',
  data_admissao TEXT,
  vencimento_exame_medico TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- MAINTENANCE
-- ==========================================
CREATE TABLE maintenance_orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  veiculo_id TEXT REFERENCES vehicles(id),
  veiculo_placa TEXT,
  veiculo_modelo TEXT,
  tipo TEXT CHECK(tipo IN ('preventiva','corretiva')) NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT CHECK(status IN ('aberta','em_andamento','concluida','cancelada')) DEFAULT 'aberta',
  prioridade TEXT CHECK(prioridade IN ('baixa','media','alta','urgente')) DEFAULT 'media',
  data TEXT NOT NULL,
  data_conclusao TEXT,
  custo REAL DEFAULT 0,
  oficina TEXT,
  observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, numero)
);

-- ==========================================
-- FUEL
-- ==========================================
CREATE TABLE fuel_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  veiculo_placa TEXT NOT NULL,
  motorista TEXT,
  data TEXT NOT NULL,
  litros REAL NOT NULL,
  valor REAL NOT NULL,
  km_atual INTEGER,
  km_anterior INTEGER,
  consumo REAL,
  posto TEXT,
  tipo_combustivel TEXT DEFAULT 'Diesel S10',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE fuel_tanks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  capacidade REAL,
  nivel_atual REAL DEFAULT 0,
  combustivel TEXT,
  localizacao TEXT
);

CREATE TABLE fuel_pumps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tank_id TEXT REFERENCES fuel_tanks(id),
  nome TEXT NOT NULL,
  leitura_atual REAL DEFAULT 0
);

-- ==========================================
-- TIRES
-- ==========================================
CREATE TABLE tires (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  medida TEXT,
  dot TEXT,
  status TEXT CHECK(status IN ('novo','em_uso','recapado','descartado')) DEFAULT 'novo',
  posicao TEXT,
  veiculo_placa TEXT,
  km_instalacao INTEGER DEFAULT 0,
  km_atual INTEGER DEFAULT 0,
  sulco REAL DEFAULT 16,
  reformas INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, codigo)
);

-- ==========================================
-- INVENTORY / PARTS
-- ==========================================
CREATE TABLE parts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  quantidade INTEGER DEFAULT 0,
  quantidade_minima INTEGER DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  custo_unitario REAL DEFAULT 0,
  localizacao TEXT,
  fornecedor TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, codigo)
);

CREATE TABLE parts_movements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  part_id TEXT REFERENCES parts(id),
  tipo TEXT CHECK(tipo IN ('entrada','saida','ajuste')) NOT NULL,
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  os_id TEXT REFERENCES maintenance_orders(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- EXPENSES
-- ==========================================
CREATE TABLE expenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  veiculo_placa TEXT,
  fornecedor TEXT,
  nota_fiscal TEXT,
  status TEXT CHECK(status IN ('pendente','pago','cancelado')) DEFAULT 'pendente',
  centro_custo TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- RECEITAS/FRETES
-- ==========================================
CREATE TABLE receitas (
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

-- ==========================================
-- LICENSES (IPVA, Licensing)
-- ==========================================
CREATE TABLE licenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  veiculo_placa TEXT NOT NULL,
  veiculo_modelo TEXT,
  tipo TEXT CHECK(tipo IN ('ipva','licenciamento','seguro_obrigatorio')) NOT NULL,
  ano_referencia TEXT,
  valor REAL NOT NULL,
  data_vencimento TEXT NOT NULL,
  status TEXT CHECK(status IN ('pago','pendente','vencido','parcelado')) DEFAULT 'pendente',
  parcelas INTEGER DEFAULT 1,
  parcelas_pagas INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- INSURANCE
-- ==========================================
CREATE TABLE insurers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  email TEXT
);

CREATE TABLE insurances (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  apolice TEXT NOT NULL,
  seguradora TEXT,
  veiculo_placa TEXT,
  veiculo_modelo TEXT,
  tipo TEXT,
  valor_premio REAL DEFAULT 0,
  valor_franquia REAL DEFAULT 0,
  vigencia_inicio TEXT,
  vigencia_fim TEXT,
  status TEXT CHECK(status IN ('ativa','vencida','cancelada')) DEFAULT 'ativa',
  abrangencia TEXT DEFAULT 'Nacional',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, apolice)
);

-- ==========================================
-- INCIDENTS
-- ==========================================
CREATE TABLE incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT CHECK(tipo IN ('multa','acidente','avaria','sinistro')) NOT NULL,
  data TEXT NOT NULL,
  veiculo_placa TEXT,
  motorista TEXT,
  descricao TEXT,
  valor REAL DEFAULT 0,
  status TEXT CHECK(status IN ('aberto','em_recurso','pago','resolvido')) DEFAULT 'aberto',
  local TEXT,
  pontos_cnh INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- GARAGE
-- ==========================================
CREATE TABLE garage_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  veiculo_placa TEXT NOT NULL,
  veiculo_modelo TEXT,
  motorista TEXT,
  tipo TEXT CHECK(tipo IN ('entrada','saida')) NOT NULL,
  data TEXT NOT NULL,
  hora TEXT,
  km INTEGER DEFAULT 0,
  destino TEXT,
  observacoes TEXT,
  status TEXT CHECK(status IN ('aprovado','pendente','negado')) DEFAULT 'pendente',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- COST CENTERS & DEPARTMENTS
-- ==========================================
CREATE TABLE departments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  responsavel TEXT
);

CREATE TABLE cost_centers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  UNIQUE(tenant_id, codigo)
);

-- ==========================================
-- CTes (Conhecimento de Transporte Eletrônico)
-- ==========================================
CREATE TABLE ctes (
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
  receita_id TEXT REFERENCES receitas(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- COMPONENTS (Engines, Differentials)
-- ==========================================
CREATE TABLE components (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT CHECK(tipo IN ('motor','diferencial','transmissao','outro')) NOT NULL,
  numero_serie TEXT,
  marca TEXT,
  modelo TEXT,
  veiculo_id TEXT REFERENCES vehicles(id),
  status TEXT CHECK(status IN ('ativo','inativo','reforma')) DEFAULT 'ativo',
  km_instalacao INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- AUDIT LOG
-- ==========================================
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX idx_vehicles_status ON vehicles(tenant_id, status);
CREATE INDEX idx_drivers_tenant ON drivers(tenant_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_orders(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_orders(tenant_id, status);
CREATE INDEX idx_fuel_tenant ON fuel_entries(tenant_id);
CREATE INDEX idx_tires_tenant ON tires(tenant_id);
CREATE INDEX idx_parts_tenant ON parts(tenant_id);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX idx_receitas_tenant ON receitas(tenant_id);
CREATE INDEX idx_receitas_cte ON receitas(tenant_id, cte_id);
CREATE INDEX idx_licenses_tenant ON licenses(tenant_id);
CREATE INDEX idx_insurances_tenant ON insurances(tenant_id);
CREATE INDEX idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX idx_garage_tenant ON garage_entries(tenant_id);
CREATE INDEX idx_ctes_tenant ON ctes(tenant_id);
CREATE INDEX idx_ctes_status ON ctes(tenant_id, status);
CREATE INDEX idx_ctes_veiculo ON ctes(tenant_id, veiculo_placa);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity, entity_id);
