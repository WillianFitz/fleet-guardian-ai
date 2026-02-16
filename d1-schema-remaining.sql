-- Tables missing from fleetcommand D1
-- (tenants, users, drivers, vehicles, audit_logs already exist)

-- VEHICLE CATEGORIES & TYPES
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

-- MAINTENANCE
CREATE TABLE IF NOT EXISTS maintenance_orders (
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

-- FUEL
CREATE TABLE IF NOT EXISTS fuel_entries (
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

CREATE TABLE IF NOT EXISTS fuel_tanks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  capacidade REAL,
  nivel_atual REAL DEFAULT 0,
  combustivel TEXT,
  localizacao TEXT
);

CREATE TABLE IF NOT EXISTS fuel_pumps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tank_id TEXT REFERENCES fuel_tanks(id),
  nome TEXT NOT NULL,
  leitura_atual REAL DEFAULT 0
);

-- TIRES
CREATE TABLE IF NOT EXISTS tires (
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

-- PARTS / INVENTORY
CREATE TABLE IF NOT EXISTS parts (
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

CREATE TABLE IF NOT EXISTS parts_movements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  part_id TEXT REFERENCES parts(id),
  tipo TEXT CHECK(tipo IN ('entrada','saida','ajuste')) NOT NULL,
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  os_id TEXT REFERENCES maintenance_orders(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
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

-- LICENSES
CREATE TABLE IF NOT EXISTS licenses (
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

-- INSURANCE
CREATE TABLE IF NOT EXISTS insurers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS insurances (
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

-- INCIDENTS
CREATE TABLE IF NOT EXISTS incidents (
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

-- GARAGE
CREATE TABLE IF NOT EXISTS garage_entries (
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

-- DEPARTMENTS & COST CENTERS
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  responsavel TEXT
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  UNIQUE(tenant_id, codigo)
);

-- COMPONENTS
CREATE TABLE IF NOT EXISTS components (
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_drivers_tenant ON drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant ON maintenance_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fuel_tenant ON fuel_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tires_tenant ON tires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parts_tenant ON parts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insurances_tenant ON insurances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_garage_tenant ON garage_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(tenant_id, entity, entity_id);
