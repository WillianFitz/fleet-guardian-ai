// FleetCommand - Cloudflare Worker REST API
// Generic CRUD for all D1 tables with camelCase↔snake_case conversion

interface Env {
  DB: D1Database;
  AUTH_SECRET?: string;
  CTE_API_URL?: string; // URL do backend PHP SPED-CTe (ex: https://sua-api-cte.com)
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

// ===== UTILS =====
const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const objectKeysToSnake = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
};

const objectKeysToCamel = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
};

// Tentativa de parsear strings JSON em objetos/arrays antes de enviar ao frontend
function tryParseJsonStrings(obj: Record<string, any>): Record<string, any> {
  const res: Record<string, any> = { ...obj };
  for (const [k, v] of Object.entries(res)) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        try {
          res[k] = JSON.parse(v);
        } catch {
          // mantendo string caso falhe
        }
      }
    }
  }
  return res;
}

// ===== AUTH UTILS (password + token) =====

interface AuthTokenPayload {
  userId: string;
  tenantId: string;
  exp: number;
}

const TOKEN_TTL_HOURS = 24;

function getAuthSecret(env: Env): string {
  // Fallback de desenvolvimento
  return env.AUTH_SECRET || "dev-secret-change-in-production";
}

async function hashPassword(password: string, salt?: string): Promise<string> {
  const enc = new TextEncoder();
  const s = salt || crypto.randomUUID().replace(/-/g, "");
  const data = enc.encode(s + ":" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${s}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(":");
  const check = await hashPassword(password, salt);
  return check === stored;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  let str: string;
  if (typeof data === "string") {
    str = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    str = btoa(binary);
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return atob(str);
}

async function signToken(payload: AuthTokenPayload, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;

  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const encSig = base64UrlEncode(sig);
  return `${data}.${encSig}`;
}

async function verifyToken(token: string, secret: string): Promise<AuthTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const data = `${encHeader}.${encPayload}`;

  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);

  const sigBytes = Uint8Array.from(atob(encSig.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  ).buffer;
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  if (!ok) return null;

  const payloadJson = base64UrlDecode(encPayload);
  const payload = JSON.parse(payloadJson) as AuthTokenPayload;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}

// ===== RESOURCE → TABLE MAPPING =====
const RESOURCE_MAP: Record<string, { table: string; fieldOverrides?: Record<string, string> }> = {
  vehicles: { table: "vehicles", fieldOverrides: { motorista: "motorista_id" } },
  drivers: { table: "drivers" },
  maintenance: { table: "maintenance_orders" },
  tenants: { table: "tenants" },
  clients: { table: "clients" },
  fuel: { table: "fuel_entries" },
  tires: { table: "tires" },
  parts: { table: "parts" },
  expenses: { table: "expenses" },
  licenses: { table: "licenses" },
  insurances: { table: "insurances" },
  incidents: { table: "incidents" },
  garage: { table: "garage_entries" },
  ctes: { table: "ctes" },
  receitas: { table: "receitas" },
};

// Fields to exclude from INSERT/UPDATE (auto-managed)
const EXCLUDED_FIELDS = new Set([
  "created_at",
  "updated_at",
  "tenant_id",
]);

// Foreign key fields that should be NULL when empty (not empty string)
const FK_FIELDS = new Set(["motorista_id", "veiculo_id", "tank_id", "part_id", "os_id", "department_id"]);

function sanitizeValues(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (FK_FIELDS.has(key) && (value === "" || value === undefined)) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ===== CORS =====
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Tenant-Id, Accept, Origin, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ===== GET OR CREATE DEFAULT TENANT =====
async function getOrCreateTenant(db: D1Database, tenantId?: string): Promise<string> {
  if (tenantId) {
    const existing = await db.prepare("SELECT id FROM tenants WHERE id = ?").bind(tenantId).first();
    if (existing) return existing.id as string;
  }

  // Check for any existing tenant
  const first = await db.prepare("SELECT id FROM tenants LIMIT 1").first();
  if (first) return first.id as string;

  // Create default tenant
  const id = crypto.randomUUID().replace(/-/g, "");
  await db
    .prepare("INSERT INTO tenants (id, nome, cnpj) VALUES (?, ?, ?)")
    .bind(id, "Empresa Padrão", "00.000.000/0001-00")
    .run();
  return id;
}

// Resolve tenant a partir de Authorization ou header X-Tenant-Id (modo legado)
async function getTenantForRequest(request: Request, env: Env): Promise<{ tenantId: string; userId?: string }> {
  const authHeader = request.headers.get("Authorization");
  const secret = getAuthSecret(env);

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = await verifyToken(token, secret);
    if (!payload) {
      throw new Error("Invalid or expired token");
    }
    return { tenantId: payload.tenantId, userId: payload.userId };
  }

  // Fallback: comportamento antigo (modo sem login)
  const headerTenantId = request.headers.get("X-Tenant-Id") || undefined;
  const tenantId = await getOrCreateTenant(env.DB, headerTenantId);
  return { tenantId };
}

// ===== APPLY FIELD OVERRIDES =====
function applyFieldOverrides(
  data: Record<string, any>,
  overrides?: Record<string, string>,
  reverse = false
): Record<string, any> {
  if (!overrides) return data;
  const result: Record<string, any> = {};
  
  if (reverse) {
    // Quando reverse=true, estamos convertendo de snake_case (banco) para camelCase (frontend)
    // Mas os dados já foram convertidos para camelCase, então precisamos mapear corretamente
    // Exemplo: motorista_id (snake) -> motoristaId (camel) -> motorista (override)
    const reverseMap: Record<string, string> = {};
    for (const [frontendKey, dbKey] of Object.entries(overrides)) {
      // Converte a chave do banco (snake_case) para camelCase
      const dbKeyCamel = snakeToCamel(dbKey);
      // Mapeia: dbKeyCamel (ex: motoristaId) -> frontendKey (ex: motorista)
      reverseMap[dbKeyCamel] = frontendKey;
    }
    
    for (const [key, value] of Object.entries(data)) {
      // Se a chave existe no mapa reverso, usa o nome do frontend, senão mantém a chave original
      result[reverseMap[key] || key] = value;
    }
  } else {
    // Quando reverse=false, estamos convertendo de camelCase (frontend) para snake_case (banco)
    for (const [key, value] of Object.entries(data)) {
      result[overrides[key] || key] = value;
    }
  }
  
  return result;
}

 

// ===== GENERIC CRUD =====

async function handleList(
  db: D1Database,
  table: string,
  tenantId: string,
  overrides?: Record<string, string>
): Promise<Response> {
  // Para a tabela tenants, busca pelo ID do tenant diretamente
  let query: D1PreparedStatement;
  if (table === "tenants") {
    query = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(tenantId);
  } else {
    query = db.prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenantId);
  }
  
  const { results } = await query.all();

  const items = (results || []).map((row) => {
    let camel = objectKeysToCamel(row as Record<string, any>);
    camel = tryParseJsonStrings(camel);
    camel = applyFieldOverrides(camel, overrides, true);
    return camel;
  });

  return jsonResponse({ data: items });
}

// Ensure nfe_search_state has expected columns (for backwards compatibility)
async function ensureNfeSearchStateColumns(db: D1Database) {
  try {
    const info = await db.prepare("PRAGMA table_info(nfe_search_state)").all();
    const cols = (info.results || []).map((r: any) => String(r.name || r.name).trim());
    const needed: Array<{ sql: string; name: string }> = [];
    if (!cols.includes("retry_count")) needed.push({ name: "retry_count", sql: "ALTER TABLE nfe_search_state ADD COLUMN retry_count INTEGER DEFAULT 0" });
    if (!cols.includes("next_retry_at")) needed.push({ name: "next_retry_at", sql: "ALTER TABLE nfe_search_state ADD COLUMN next_retry_at TEXT" });
    for (const c of needed) {
      try {
        await db.prepare(c.sql).run();
      } catch {
        // Ignore errors (column may have been added concurrently)
      }
    }
  } catch {
    // If PRAGMA not supported or other error, ignore and allow upstream to fail gracefully
  }
}

async function handleGet(
  db: D1Database,
  table: string,
  id: string,
  tenantId: string,
  overrides?: Record<string, string>
): Promise<Response> {
  // Para a tabela tenants, busca apenas pelo ID
  let query: D1PreparedStatement;
  if (table === "tenants") {
    query = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id);
  } else {
    query = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`).bind(id, tenantId);
  }
  
  const row = await query.first();

  if (!row) return errorResponse("Not found", 404);

  let camel = objectKeysToCamel(row as Record<string, any>);
  camel = tryParseJsonStrings(camel);
  camel = applyFieldOverrides(camel, overrides, true);
  return jsonResponse({ data: camel });
}

async function handleCreate(
  db: D1Database,
  table: string,
  body: Record<string, any>,
  tenantId: string,
  overrides?: Record<string, string>
): Promise<Response> {
  // Remove id if provided (we generate it), and apply overrides
  const { id: _, ...rest } = body;
  let snakeData = objectKeysToSnake(rest);
  snakeData = applyFieldOverrides(snakeData, overrides);

  // Remove excluded fields
  for (const f of EXCLUDED_FIELDS) {
    delete snakeData[f];
  }

  snakeData = sanitizeValues(snakeData);

  const newId = crypto.randomUUID().replace(/-/g, "");
  snakeData.id = newId;
  
  // Para tenants, não adiciona tenant_id (já é o próprio tenant)
  if (table !== "tenants") {
    snakeData.tenant_id = tenantId;
  }

  // Debug log: when creating drivers, log payload to help debug missing fields
  try {
    if (table === "drivers") {
      console.log("[API] handleCreate drivers payload:", JSON.stringify(snakeData));
    }
  } catch {}

  // Serializar objetos/arrays em JSON para armazenamento em colunas TEXT
  for (const [k, v] of Object.entries(snakeData)) {
    if (v !== null && typeof v === "object") {
      snakeData[k] = JSON.stringify(v);
    }
  }

  const columns = Object.keys(snakeData);
  const placeholders = columns.map(() => "?").join(", ");
  const values = Object.values(snakeData);

  await db
    .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  // Return the created item
  const created = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(newId).first();
  let camel = objectKeysToCamel((created || { id: newId }) as Record<string, any>);
  camel = applyFieldOverrides(camel, overrides, true);
  return jsonResponse({ data: camel }, 201);
}

async function handleUpdate(
  db: D1Database,
  table: string,
  id: string,
  body: Record<string, any>,
  tenantId: string,
  overrides?: Record<string, string>
): Promise<Response> {
  const { id: _, ...rest } = body;
  let snakeData = objectKeysToSnake(rest);
  snakeData = applyFieldOverrides(snakeData, overrides);

  // Remove excluded fields
  for (const f of EXCLUDED_FIELDS) {
    delete snakeData[f];
  }
  snakeData = sanitizeValues(snakeData);
  // Add updated_at only if the target table actually has that column (some deployments may lack it)
  try {
    const pragma = await db.prepare(`PRAGMA table_info(${table})`).all();
    const cols = (pragma.results || []).map((r: any) => String(r.name || r.name).trim());
    if (cols.includes("updated_at")) {
      snakeData.updated_at = new Date().toISOString();
    }
  } catch {
    // If PRAGMA fails for any reason, skip adding updated_at to avoid SQL errors
  }

  // Debug log: when updating drivers, log payload to help debug missing fields
  try {
    if (table === "drivers") {
      console.log("[API] handleUpdate drivers id:", id, "payload:", JSON.stringify(snakeData));
    }
  } catch {}

  // Serializar objetos/arrays em JSON para armazenamento em colunas TEXT
  for (const [k, v] of Object.entries(snakeData)) {
    if (v !== null && typeof v === "object") {
      snakeData[k] = JSON.stringify(v);
    }
  }

  const sets = Object.keys(snakeData)
    .map((k) => `${k} = ?`)
    .join(", ");
  
  // Para tenants, não filtra por tenant_id no WHERE
  if (table === "tenants") {
    const values = [...Object.values(snakeData), id];
    await db
      .prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`)
      .bind(...values)
      .run();
  } else {
    const values = [...Object.values(snakeData), id, tenantId];
    await db
      .prepare(`UPDATE ${table} SET ${sets} WHERE id = ? AND tenant_id = ?`)
      .bind(...values)
      .run();
  }

  const updated = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  let camel = objectKeysToCamel((updated || { id }) as Record<string, any>);
  camel = applyFieldOverrides(camel, overrides, true);
  return jsonResponse({ data: camel });
}

async function handleDelete(
  db: D1Database,
  table: string,
  id: string,
  tenantId: string
): Promise<Response> {
  await db
    .prepare(`DELETE FROM ${table} WHERE id = ? AND tenant_id = ?`)
    .bind(id, tenantId)
    .run();
  return jsonResponse({ success: true });
}

// ===== ROUTER =====

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Wrap EVERYTHING in try-catch to always return CORS headers
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Health check
      if (path === "/api/health") {
        return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
      }

      // ===== AI & INSIGHTS - proxy to OpenAI (ChatGPT) =====
      if (path === "/api/insights" && request.method === "POST") {
        try {
          const body = (await (async () => {
            const ct = request.headers.get("content-type") || "";
            if (ct.includes("application/json")) return await request.json();
            const txt = await request.text();
            try {
              return JSON.parse(txt || "{}");
            } catch {
              return { prompt: txt };
            }
          })()) as any;

          const { tenantId } = await getTenantForRequest(request, env);

          // Build optional data summary and metrics from DB when requested (best-effort; ignore failures)
          let dataSummary = "";
          let metrics: Record<string, any> = {};
          // Build metrics when explicitly requested (includeData) or when actions that need them are called
          if (body?.includeData || body?.action === "metrics" || body?.action === "metrics_only" || body?.audit === true) {
            try {
              // Aggregate totals
              const expRow = await env.DB.prepare("SELECT SUM(CAST(valor as REAL)) as total FROM expenses WHERE tenant_id = ?").bind(tenantId).first();
              const fuelRow = await env.DB.prepare("SELECT SUM(CAST(valor as REAL)) as total FROM fuel_entries WHERE tenant_id = ?").bind(tenantId).first();
              const manRow = await env.DB.prepare("SELECT SUM(CAST(custo as REAL)) as total FROM maintenance_orders WHERE tenant_id = ?").bind(tenantId).first();
              const totalExpenses = Number(expRow?.total || 0);
              const totalFuel = Number(fuelRow?.total || 0);
              const totalMaint = Number(manRow?.total || 0);

              // Per-vehicle breakdowns
              const fuelRowsRes = await env.DB
                .prepare(
                  "SELECT veiculo_placa, SUM(valor) AS total_fuel, SUM(litros) AS total_litros, AVG(consumo) AS avg_consumo, SUM(COALESCE(km_atual,0) - COALESCE(km_anterior,0)) AS km_driven FROM fuel_entries WHERE tenant_id = ? GROUP BY veiculo_placa"
                )
                .bind(tenantId)
                .all();
              const fuelRows = fuelRowsRes.results || [];

              const expRowsRes = await env.DB
                .prepare("SELECT veiculo_placa, SUM(valor) AS total_expenses FROM expenses WHERE tenant_id = ? GROUP BY veiculo_placa")
                .bind(tenantId)
                .all();
              const expRows = expRowsRes.results || [];

              const manRowsRes = await env.DB
                .prepare("SELECT veiculo_placa, SUM(custo) AS total_maint FROM maintenance_orders WHERE tenant_id = ? GROUP BY veiculo_placa")
                .bind(tenantId)
                .all();
              const manRows = manRowsRes.results || [];

              // Merge by plate
              const byPlate: Record<string, any> = {};
              for (const r of fuelRows) {
                const plate = String(r.veiculo_placa || "UNASSIGNED");
                byPlate[plate] = byPlate[plate] || { plate, total_fuel: 0, total_litros: 0, avg_consumo: null, km_driven: 0, total_expenses: 0, total_maint: 0 };
                byPlate[plate].total_fuel = Number(r.total_fuel || 0);
                byPlate[plate].total_litros = Number(r.total_litros || 0);
                byPlate[plate].avg_consumo = r.avg_consumo !== null ? Number(r.avg_consumo) : null;
                byPlate[plate].km_driven = Number(r.km_driven || 0);
              }
              for (const r of expRows) {
                const plate = String(r.veiculo_placa || "UNASSIGNED");
                byPlate[plate] = byPlate[plate] || { plate, total_fuel: 0, total_litros: 0, avg_consumo: null, km_driven: 0, total_expenses: 0, total_maint: 0 };
                byPlate[plate].total_expenses = Number(r.total_expenses || 0);
              }
              for (const r of manRows) {
                const plate = String(r.veiculo_placa || "UNASSIGNED");
                byPlate[plate] = byPlate[plate] || { plate, total_fuel: 0, total_litros: 0, avg_consumo: null, km_driven: 0, total_expenses: 0, total_maint: 0 };
                byPlate[plate].total_maint = Number(r.total_maint || 0);
              }

              // Compute totals per vehicle and cost/km when possible
              const byVehicle = Object.values(byPlate).map((v: any) => {
                const totalCost = Number(v.total_fuel || 0) + Number(v.total_expenses || 0) + Number(v.total_maint || 0);
                const costPerKm = v.km_driven > 0 ? totalCost / v.km_driven : null;
                return { ...v, totalCost, costPerKm };
              });

              // Monthly aggregates for a period (default 90 days)
              const days = Number(body?.period_days || 90);
              const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

              const monthlyExpensesRes = await env.DB
                .prepare("SELECT substr(data,1,7) as ym, SUM(valor) as total FROM expenses WHERE tenant_id = ? AND date(data) >= date(?) GROUP BY ym ORDER BY ym DESC")
                .bind(tenantId, since)
                .all();
              const monthlyFuelRes = await env.DB
                .prepare("SELECT substr(data,1,7) as ym, SUM(valor) as total FROM fuel_entries WHERE tenant_id = ? AND date(data) >= date(?) GROUP BY ym ORDER BY ym DESC")
                .bind(tenantId, since)
                .all();
              const monthlyMaintRes = await env.DB
                .prepare("SELECT substr(data,1,7) as ym, SUM(custo) as total FROM maintenance_orders WHERE tenant_id = ? AND date(data) >= date(?) GROUP BY ym ORDER BY ym DESC")
                .bind(tenantId, since)
                .all();

              const monthlyExpenses = (monthlyExpensesRes.results || []).map((r: any) => ({ ym: r.ym, total: Number(r.total || 0) }));
              const monthlyFuel = (monthlyFuelRes.results || []).map((r: any) => ({ ym: r.ym, total: Number(r.total || 0) }));
              const monthlyMaint = (monthlyMaintRes.results || []).map((r: any) => ({ ym: r.ym, total: Number(r.total || 0) }));

              // Also fetch registered vehicles (active) from vehicles table to reflect actual fleet
              let activeVehicles: any[] = [];
              try {
                const vehiclesRes = await env.DB
                  .prepare("SELECT id, placa, modelo, status FROM vehicles WHERE tenant_id = ?")
                  .bind(tenantId)
                  .all();
                activeVehicles = vehiclesRes.results || [];
              } catch (e) {
                // ignore vehicles query errors
                activeVehicles = [];
              }

              // Fetch drivers info (registered drivers)
              let driversList: any[] = [];
              try {
                const driversRes = await env.DB
                  .prepare("SELECT id, nome, cpf, telefone, status FROM drivers WHERE tenant_id = ?")
                  .bind(tenantId)
                  .all();
                driversList = driversRes.results || [];
              } catch (e) {
                driversList = [];
              }

              // Counts for activity tables to help debugging "detected vs registered"
              let counts: Record<string, number> = {};
              try {
                const cntFuel = await env.DB.prepare("SELECT COUNT(1) as c FROM fuel_entries WHERE tenant_id = ?").bind(tenantId).first();
                const cntExp = await env.DB.prepare("SELECT COUNT(1) as c FROM expenses WHERE tenant_id = ?").bind(tenantId).first();
                const cntMan = await env.DB.prepare("SELECT COUNT(1) as c FROM maintenance_orders WHERE tenant_id = ?").bind(tenantId).first();
                const cntRec = await env.DB.prepare("SELECT COUNT(1) as c FROM receitas WHERE tenant_id = ?").bind(tenantId).first();
                counts = {
                  fuel_entries: Number(cntFuel?.c || 0),
                  expenses: Number(cntExp?.c || 0),
                  maintenance_orders: Number(cntMan?.c || 0),
                  receitas: Number(cntRec?.c || 0),
                };
              } catch (e) {
                counts = { fuel_entries: 0, expenses: 0, maintenance_orders: 0, receitas: 0 };
              }

              metrics = {
                totalExpenses,
                totalFuel,
                totalMaint,
                totalVehicles: activeVehicles.length,
                activeVehicles: activeVehicles.map((v: any) => ({ id: v.id, plate: v.placa, model: v.modelo, status: v.status })),
                totalDrivers: driversList.length,
                drivers: driversList.map((d: any) => ({ id: d.id, nome: d.nome, cpf: d.cpf, telefone: d.telefone, status: d.status })),
                detectedVehicles: byVehicle,
                byVehicle,
                counts,
                monthly: {
                  expenses: monthlyExpenses,
                  fuel: monthlyFuel,
                  maintenance: monthlyMaint,
                },
              };

              dataSummary = `Resumo (valores agregados do tenant):
 - Período: últimos ${days} dias
 - Despesas totais: R$ ${totalExpenses.toFixed(2)}
 - Abastecimento (fuel_entries): R$ ${totalFuel.toFixed(2)}
 - Manutenção (maintenance_orders): R$ ${totalMaint.toFixed(2)}
 - Veículos cadastrados: ${activeVehicles.length}
 - Motoristas cadastrados: ${driversList.length}
 - Veículos com dados detectados (abastecimento/despesas/manutenção): ${byVehicle.length}
 `;
            } catch (e) {
              console.warn("Insights: failed to build data summary/metrics:", e);
            }
          }

          // Assemble messages for OpenAI
          let messages: Array<{ role: string; content: string }> = [];
          if (body?.messages && Array.isArray(body.messages)) {
            messages = body.messages;
          } else {
            const systemPrompt = "Você é um assistente especializado em gestão de frotas. Responda em Português e seja conciso.";
            const userPrompt = body?.prompt || "Analise os custos e despesas da frota e gere insights acionáveis.";
            messages.push({ role: "system", content: systemPrompt + (dataSummary ? `\n\nContexto do sistema:\n${dataSummary}` : "") });
            messages.push({ role: "user", content: userPrompt });
          }

          const openaiKey = env.OPENAI_API_KEY;
          if (!openaiKey) return errorResponse("OPENAI_API_KEY não configurada no Worker.", 503);

          const model = env.OPENAI_MODEL || "gpt-4o-mini";
          
          // If caller requested a full audit, return auditReport + metrics/dataSummary without calling OpenAI
          if (body?.audit === true) {
            try {
              // build audit samples
              const sampleVehicles = await env.DB.prepare("SELECT id, placa, modelo, status FROM vehicles WHERE tenant_id = ? LIMIT 10").bind(tenantId).all();
              const sampleDrivers = await env.DB.prepare("SELECT id, nome, cpf, telefone, status FROM drivers WHERE tenant_id = ? LIMIT 10").bind(tenantId).all();
              const sampleFuel = await env.DB.prepare("SELECT id, veiculo_placa, litros, valor, data FROM fuel_entries WHERE tenant_id = ? ORDER BY data DESC LIMIT 10").bind(tenantId).all();
              const sampleExpenses = await env.DB.prepare("SELECT id, descricao, valor, data, veiculo_placa FROM expenses WHERE tenant_id = ? ORDER BY data DESC LIMIT 10").bind(tenantId).all();
              const sampleMaint = await env.DB.prepare("SELECT id, numero, veiculo_placa, custo, data FROM maintenance_orders WHERE tenant_id = ? ORDER BY data DESC LIMIT 10").bind(tenantId).all();

              const auditReport = {
                counts,
                totalVehicles: metrics.totalVehicles,
                totalDrivers: metrics.totalDrivers,
                samples: {
                  vehicles: sampleVehicles.results || [],
                  drivers: sampleDrivers.results || [],
                  fuel_entries: sampleFuel.results || [],
                  expenses: sampleExpenses.results || [],
                  maintenance_orders: sampleMaint.results || [],
                },
              };

              return jsonResponse({ data: { auditReport, metrics, dataSummary } });
            } catch (e: any) {
              // fallthrough to normal flow if audit fails
              console.warn("Audit generation failed:", e);
            }
          }
          // If caller requested transactions/expenses filtering, handle here
          if (body?.action === "expenses" || body?.action === "transactions") {
            try {
              const plateRaw = String(body?.plate || "").trim();
              const category = String(body?.category || "all").toLowerCase(); // fuel | expenses | maintenance | all
              const limit = Number(body?.limit || 200);
              const days = body?.days ? Number(body.days) : body?.period_days ? Number(body.period_days) : null;
              const from = body?.from || (days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : body?.from);
              const to = body?.to || new Date().toISOString().split("T")[0];

              const normalize = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
              const plateNorm = normalize(plateRaw);

              const results: any[] = [];
              let totalValue = 0;
              // Helper to fetch and filter by plate in JS (robust to formatting)
              const fetchAndFilter = async (sql: string, params: any[]) => {
                const res = await env.DB.prepare(sql).bind(...params).all();
                const rows = res.results || [];
                for (const r of rows) {
                  if (plateNorm) {
                    const rPlate = normalize(String(r.veiculo_placa || r.plate || ""));
                    if (!rPlate.includes(plateNorm)) continue;
                  }
                  results.push(r);
                  // sum value fields if present
                  const v = Number(r.valor ?? r.total ?? r.custo ?? 0);
                  totalValue += Number(v || 0);
                  if (results.length >= limit) break;
                }
              };

              // Choose which tables to query
              const dateFrom = from;
              const dateTo = to;
              if (category === "fuel" || category === "all") {
                await fetchAndFilter(
                  "SELECT id, veiculo_placa, motorista, litros, valor, km_atual, km_anterior, posto, data FROM fuel_entries WHERE tenant_id = ? AND date(data) BETWEEN date(?) AND date(?) ORDER BY data DESC LIMIT 1000",
                  [tenantId, dateFrom, dateTo]
                );
              }
              if ((category === "expenses" || category === "all") && results.length < limit) {
                await fetchAndFilter(
                  "SELECT id, veiculo_placa, descricao, valor, data, fornecedor, nota_fiscal FROM expenses WHERE tenant_id = ? AND date(data) BETWEEN date(?) AND date(?) ORDER BY data DESC LIMIT 1000",
                  [tenantId, dateFrom, dateTo]
                );
              }
              if ((category === "maintenance" || category === "all") && results.length < limit) {
                await fetchAndFilter(
                  "SELECT id, numero, veiculo_placa, custo AS valor, data, tipo, status FROM maintenance_orders WHERE tenant_id = ? AND date(data) BETWEEN date(?) AND date(?) ORDER BY data DESC LIMIT 1000",
                  [tenantId, dateFrom, dateTo]
                );
              }

              return jsonResponse({
                data: {
                  params: { plate: plateRaw || null, plateNorm, category, from: dateFrom, to: dateTo, limit },
                  totals: { count: results.length, totalValue },
                  records: results.slice(0, limit),
                },
              });
            } catch (e: any) {
              return errorResponse(`Erro ao buscar transações: ${e?.message || String(e)}`, 500);
            }
          }

          // If caller requested raw metrics only (for frontend cards), return metrics directly
          if (body?.action === "metrics" || body?.action === "metrics_only") {
            return jsonResponse({ data: { metrics, dataSummary } });
          }

          const oaResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              max_tokens: body?.max_tokens || 800,
              temperature: typeof body?.temperature === "number" ? body.temperature : 0.2,
            }),
          });

          const oaJson = await oaResp.json();
          if (!oaResp.ok) {
            return jsonResponse({ error: "OpenAI error", details: oaJson }, oaResp.status);
          }

          const choice = oaJson.choices && oaJson.choices[0];
          const assistantMessage = choice?.message?.content || oaJson?.result || "";
          return jsonResponse({ data: { assistant: assistantMessage, raw: oaJson, dataSummary, metrics } });
        } catch (e: any) {
          return errorResponse(`Erro ao processar insights: ${e?.message || String(e)}`, 500);
        }
      }

      // Setup default tenant (modo legado - pode ser removido depois)
      if (path === "/api/setup" && request.method === "POST") {
        const tenantId = await getOrCreateTenant(env.DB);
        return jsonResponse({ tenantId });
      }

      // Validação de certificado (proxy para API PHP)
      if (path === "/api/tenants/validar-certificado" && request.method === "POST") {
        if (!env.CTE_API_URL) {
          return errorResponse("CTE_API_URL não configurada. Configure a variável de ambiente.", 503);
        }
        try {
          const body = await request.json();
          const phpResponse = await fetch(`${env.CTE_API_URL}/validar-certificado`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const phpData = await phpResponse.json();
          if (!phpResponse.ok) {
            return jsonResponse({ error: phpData.error || "Erro ao validar certificado" }, phpResponse.status);
          }
          return jsonResponse(phpData);
        } catch (e: any) {
          return errorResponse(`Erro ao validar certificado: ${e.message}`, 500);
        }
      }

      // ===== CTe API PROXY (para backend PHP SPED-CTe) =====
      // NOTA: Workers não podem assinar XML diretamente, então fazemos proxy para API PHP
      // A API PHP deve ter o certificado digital e usar nfephp-org/sped-cte
      if (path === "/api/cte/emitir" && request.method === "POST") {
        if (!env.CTE_API_URL) {
          return errorResponse(
            "CTE_API_URL não configurada no Worker. " +
            "Configure com: npx wrangler secret put CTE_API_URL\n" +
            "Digite a URL da sua API PHP que usa nfephp-org/sped-cte",
            503
          );
        }
        try {
          const body = await request.json();
          const ambiente = body.ambiente || "homologacao"; // padrão homologação
          // Remove ambiente do body antes de enviar para PHP (se necessário)
          const { ambiente: _, ...phpBody } = body;
          
          // Adiciona ambiente como query param ou header (ajuste conforme sua API PHP)
          const phpUrl = new URL(`${env.CTE_API_URL}/emitir`);
          phpUrl.searchParams.set("ambiente", ambiente);
          
          // Buscar certificado e dados da empresa do tenant
          const { tenantId } = await getTenantForRequest(request, env);
          const tenant = await env.DB.prepare("SELECT certificado_pfx_base64, certificado_password, certificado_status, cnpj, nome, uf FROM tenants WHERE id = ?")
            .bind(tenantId)
            .first<{ certificado_pfx_base64?: string; certificado_password?: string; certificado_status?: string; cnpj?: string; nome?: string; uf?: string }>();

          // Preparar body com certificado e dados da empresa
          let phpBodyWithCert = { ...phpBody };
          
          if (tenant?.certificado_pfx_base64 && tenant?.certificado_password) {
            phpBodyWithCert.certificado = {
              pfxBase64: tenant.certificado_pfx_base64,
              password: tenant.certificado_password
            };
          }
          
          // Adicionar dados da empresa (necessário para sped-cte)
          // OBRIGATÓRIO: CNPJ e nome devem estar cadastrados no sistema
          if (!tenant?.cnpj || !tenant?.nome) {
            return errorResponse(
              "Dados da empresa incompletos. Cadastre CNPJ e Nome da empresa nas Configurações.",
              400
            );
          }
          
          phpBodyWithCert.empresa = {
            cnpj: tenant.cnpj,
            razaoSocial: tenant.nome,
            siglaUF: tenant.uf || 'SP' // Usa UF do banco ou padrão SP
          };

          const phpResponse = await fetch(phpUrl.toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(request.headers.get("Authorization") ? { Authorization: request.headers.get("Authorization")! } : {}),
            },
            body: JSON.stringify(phpBodyWithCert),
          });
          const phpText = await phpResponse.text();
          let phpData: any;
          try {
            phpData = phpText ? JSON.parse(phpText) : {};
          } catch {
            return errorResponse(
              `Resposta inválida da API CTe (não-JSON). Verifique logs do Railway. ` +
                `HTTP ${phpResponse.status}. Início: ${phpText.slice(0, 200)}`,
              502,
            );
          }
          if (!phpResponse.ok) {
            return jsonResponse({ error: phpData.message || phpData.error || "Erro ao emitir CTe" }, phpResponse.status);
          }
          return jsonResponse(phpData);
        } catch (e: any) {
          return errorResponse(`Erro ao comunicar com API CTe: ${e.message}`, 500);
        }
      }

      // POST /api/ctes/import-xml - cria um rascunho de CTe a partir de um XML fornecido (raw XML string)
      if (path === "/api/ctes/import-xml" && request.method === "POST") {
        try {
          const contentType = request.headers.get("content-type") || "";
          let bodyJson: any = {};
          if (contentType.includes("application/json")) {
            bodyJson = await request.json();
          } else {
            const txt = await request.text();
            bodyJson = { xml: txt };
          }

          const xml = String(bodyJson.xml || "").trim();
          if (!xml) return errorResponse("Parâmetro 'xml' é obrigatório no body (string contendo o XML)", 400);

          const { tenantId } = await getTenantForRequest(request, env);

          const extractTag = (tag: string) => {
            const re = new RegExp(`<(?:(?:[^>]*:)?${tag})(?:[^>]*)>([\\s\\S]*?)<\\/(?:[^>]*:)?${tag}>`, "i");
            const m = xml.match(re);
            return m ? m[1].trim() : "";
          };
          const extractFromParent = (parent: string, tag: string) => {
            const re = new RegExp(`<${parent}[^>]*>[\\s\\S]*?<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>[\\s\\S]*?<\\/${parent}>`, "i");
            const m = xml.match(re);
            return m ? m[1].trim() : "";
          };

          const ch = extractTag("chNFe") || extractFromParent("infNFe", "Id") || "";
          const nnum = extractTag("nNF") || (ch ? ch.substr(25, 9) : "");
          const xNomeMatches = Array.from(xml.matchAll(/<(?:[^>]*:)?xNome[^>]*>([\s\S]*?)<\/(?:[^>]*:)?xNome>/gi)).map((m) => (m[1] || "").trim());
          const xNomeEmit = xNomeMatches[0] || extractTag("xNomeEmit") || "";
          const xNomeDest = xNomeMatches[1] || extractTag("xNomeDest") || "";
          const vNFVal = extractTag("vNF") || extractTag("vProd") || "0";
          const vNF = Number(String(vNFVal).replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
          const dhEmi = extractTag("dhEmi") || extractTag("dEmi") || "";
          const placa = extractTag("placa") || "";
          const emitCnpj = extractFromParent("emit", "CNPJ") || extractFromParent("emit", "CPF") || extractTag("CNPJ") || "";
          const destMatch = xml.match(/<dest[^\>]*>[\s\S]*?<(?:[^>]*:)?CNPJ[^>]*>([\s\S]*?)<\/(?:[^>]*:)?CNPJ>/i);
          const destCnpj = destMatch ? destMatch[1].trim() : extractTag("CNPJ") || "";

          const remetenteCep = extractFromParent("enderEmit", "CEP") || extractTag("CEP") || "";
          const remetenteLogradouro = extractFromParent("enderEmit", "xLgr") || extractTag("xLgr") || "";
          const remetenteNumero = extractFromParent("enderEmit", "nro") || extractTag("nro") || "";
          const remetenteBairro = extractFromParent("enderEmit", "xBairro") || extractTag("xBairro") || "";
          const remetenteMunicipio = extractFromParent("enderEmit", "xMun") || extractTag("xMun") || "";
          const remetenteUf = extractFromParent("enderEmit", "UF") || extractTag("UF") || "";
          const destinatarioCep = extractFromParent("enderDest", "CEP") || "";
          const destinatarioLogradouro = extractFromParent("enderDest", "xLgr") || "";
          const destinatarioNumero = extractFromParent("enderDest", "nro") || "";
          const destinatarioBairro = extractFromParent("enderDest", "xBairro") || "";
          const destinatarioMunicipio = extractFromParent("enderDest", "xMun") || "";
          const destinatarioUf = extractFromParent("enderDest", "UF") || "";

          let nfe: any = {
            chave: ch,
            nfe: nnum,
            xNomeEmit,
            xNomeDest,
            vNF,
            dhEmi,
            placa,
            emitCnpj,
            destCnpj,
            remetenteCep,
            remetenteLogradouro,
            remetenteNumero,
            remetenteBairro,
            remetenteMunicipio,
            remetenteUf,
            destinatarioCep,
            destinatarioLogradouro,
            destinatarioNumero,
            destinatarioBairro,
            destinatarioMunicipio,
            destinatarioUf
          };

          try {
            const placaNormRaw = String(placa || "").trim();
            const normalizePlaca = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            const placaNorm = normalizePlaca(placaNormRaw);
            if (placaNorm) {
              const rowsRes = await env.DB.prepare("SELECT id, placa, modelo FROM vehicles WHERE tenant_id = ?").bind(tenantId).all();
              const rows = rowsRes.results || [];
              let found: any = null;
              for (const r of rows) {
                const dbPlacaNorm = normalizePlaca(String(r.placa || ""));
                if (dbPlacaNorm === placaNorm) {
                  found = r;
                  break;
                }
              }
              if (!found && placaNorm.length >= 4) {
                const tail = placaNorm.slice(-4);
                for (const r of rows) {
                  const dbPlacaNorm = normalizePlaca(String(r.placa || ""));
                  if (dbPlacaNorm.endsWith(tail)) {
                    found = r;
                    break;
                  }
                }
              }
              if (found) {
                nfe.veiculoId = found.id;
                nfe.veiculoModelo = found.modelo || null;
              }
            }
          } catch (err) {
            // ignore lookup errors
          }

          const ctePayload: Record<string, any> = {
            numero: nfe.nfe || "",
            numero_nota: nfe.nfe || "",
            chave: nfe.chave || "",
            chave_origem: nfe.chave || "",
            remetente_nome: nfe.xNomeEmit || "",
            destinatario_nome: nfe.xNomeDest || "",
            remetenteCnpjCpf: nfe.emitCnpj || nfe.emitCnpj || "",
            destinatarioCnpjCpf: nfe.destCnpj || nfe.destCnpj || "",
            remetenteCep: nfe.remetenteCep || null,
            remetenteLogradouro: nfe.remetenteLogradouro || null,
            remetenteNumero: nfe.remetenteNumero || null,
            remetenteBairro: nfe.remetenteBairro || null,
            remetenteMunicipio: nfe.remetenteMunicipio || null,
            remetenteUf: nfe.remetenteUf || null,
            destinatarioCep: nfe.destinatarioCep || null,
            destinatarioLogradouro: nfe.destinatarioLogradouro || null,
            destinatarioNumero: nfe.destinatarioNumero || null,
            destinatarioBairro: nfe.destinatarioBairro || null,
            destinatarioMunicipio: nfe.destinatarioMunicipio || null,
            destinatarioUf: nfe.destinatarioUf || null,
            veiculoPlaca: (nfe.placa || nfe.veiculoPlaca || null) ? String(nfe.placa || nfe.veiculoPlaca).toUpperCase().replace(/[^A-Z0-9]/g, "") : null,
            veiculoId: nfe.veiculoId || null,
            municipioOrigem: nfe.remetenteMunicipio || null,
            ufOrigem: nfe.remetenteUf || null,
            municipioDestino: nfe.destinatarioMunicipio || null,
            ufDestino: nfe.destinatarioUf || null,
            valor_prestacao: nfe.vNF || 0,
            valor_total: nfe.vNF || 0,
            data_emissao: (nfe.dhEmi ? (String(nfe.dhEmi).split('T')[0]) : (new Date().toISOString().split('T')[0])),
            inf_carga: [
              {
                numero: nfe.nfe || "",
                produto: "Mercadoria",
                valor: nfe.vNF || 0,
                peso: 0,
                chave: nfe.chave || ""
              }
            ],
            informacoes_adicionais: [],
            tomador: "",
            cfop: "",
            valor_frete: 0,
            has_expedidor: 0,
            has_recebedor: 0,
            emitir_retroativo: 0,
            texto_nota: `Referente à NF-e ${nfe.nfe || ''} - CHAVE ${nfe.chave || ''}`,
            status: "rascunho"
          };

          const previewFlag =
            url.searchParams.get("preview") === "true" ||
            (typeof (bodyJson?.preview) !== "undefined" && bodyJson.preview === true);

          const matchedVehicle = nfe.veiculoId ? { id: nfe.veiculoId, placa: ctePayload.veiculoPlaca, modelo: nfe.veiculoModelo || null } : null;
          if (previewFlag) {
            return jsonResponse({ preview: ctePayload, matchedVehicle });
          }

          const config = RESOURCE_MAP["ctes"];
          if (matchedVehicle) {
            ctePayload.veiculoId = matchedVehicle.id;
            ctePayload.veiculoModelo = matchedVehicle.modelo;
          }
          const createdRes = await handleCreate(env.DB, config.table, ctePayload, tenantId, config.fieldOverrides);
          const createdJsonText = await createdRes.text();
          let createdJson: any = {};
          try {
            createdJson = createdJsonText ? JSON.parse(createdJsonText) : {};
          } catch {}
          return jsonResponse(createdJson, 201);
        } catch (e: any) {
          return errorResponse(`Erro ao importar XML: ${e.message}`, 500);
        }
      }

      // ===== ADMIN: limpar bloqueio NFe (protegido) =====
      if (path === "/api/admin/clear-nfe-block" && request.method === "POST") {
        // Header de administração: X-Admin-Secret ou Authorization: Bearer <secret>
        const adminHeader = request.headers.get("X-Admin-Secret") || (request.headers.get("Authorization")?.startsWith("Bearer ") ? request.headers.get("Authorization")!.slice("Bearer ".length) : null);
        const secret = getAuthSecret(env);
        if (!adminHeader || adminHeader !== secret) {
          return errorResponse("Unauthorized", 401);
        }
        try {
          const body = await request.json() as { tenantId?: string; all?: boolean };
          if (body?.all) {
            await env.DB.prepare("UPDATE nfe_search_state SET blocked_until = NULL, in_progress = 0").run();
            return jsonResponse({ success: true, message: "Cleared blocked_until for all tenants" });
          }
          if (!body?.tenantId) {
            return errorResponse("tenantId is required unless all=true", 400);
          }
          await env.DB.prepare("UPDATE nfe_search_state SET blocked_until = NULL, in_progress = 0 WHERE tenant_id = ?").bind(body.tenantId).run();
          return jsonResponse({ success: true, tenantId: body.tenantId });
        } catch (e: any) {
          return errorResponse(`Error clearing block: ${e.message}`, 500);
        }
      }

      // ===== ADMIN: consultar estado de busca NFe (protegido) =====
      if (path === "/api/admin/nfe-state" && request.method === "GET") {
        const adminHeader = request.headers.get("X-Admin-Secret") || (request.headers.get("Authorization")?.startsWith("Bearer ") ? request.headers.get("Authorization")!.slice("Bearer ".length) : null);
        const secret = getAuthSecret(env);
        if (!adminHeader || adminHeader !== secret) {
          return errorResponse("Unauthorized", 401);
        }
        try {
          const urlParams = new URL(request.url).searchParams;
          const tenantId = urlParams.get("tenantId");
          if (!tenantId) {
            const res = await env.DB.prepare("SELECT tenant_id, last_ult_nsu, last_search_at, in_progress, blocked_until FROM nfe_search_state").all();
            return jsonResponse({ data: res.results || [] });
          }
          const row = await env.DB.prepare("SELECT tenant_id, last_ult_nsu, last_search_at, in_progress, blocked_until FROM nfe_search_state WHERE tenant_id = ?").bind(tenantId).first();
          return jsonResponse({ data: row || null });
        } catch (e: any) {
          return errorResponse(`Error reading state: ${e.message}`, 500);
        }
      }

      if (path.startsWith("/api/cte/consultar") && (request.method === "GET" || request.method === "POST")) {
        if (!env.CTE_API_URL) {
          return errorResponse("CTE_API_URL não configurada no Worker. Configure a variável de ambiente.", 503);
        }
        const chave = url.searchParams.get("chave");
        const ambiente = url.searchParams.get("ambiente") || "homologacao";
        if (!chave) {
          return errorResponse("Parâmetro 'chave' é obrigatório", 400);
        }
        try {
          const phpUrl = new URL(`${env.CTE_API_URL}/consultar`);
          phpUrl.searchParams.set("chave", chave);
          phpUrl.searchParams.set("ambiente", ambiente);

          // Buscar certificado e dados da empresa do tenant para consulta
          const { tenantId } = await getTenantForRequest(request, env);
          const tenant = await env.DB.prepare("SELECT certificado_pfx_base64, certificado_password, cnpj, nome, uf FROM tenants WHERE id = ?")
            .bind(tenantId)
            .first<{ certificado_pfx_base64?: string; certificado_password?: string; cnpj?: string; nome?: string; uf?: string }>();

          const headers: Record<string, string> = {
            ...(request.headers.get("Authorization") ? { Authorization: request.headers.get("Authorization")! } : {}),
          };

          // Preparar body com certificado e dados da empresa (e fundir body do cliente se for POST)
          let bodyData: any = {};
          if (request.method === "POST") {
            try {
              const clientBody = await request.json();
              if (clientBody && typeof clientBody === "object") {
                bodyData = { ...bodyData, ...clientBody };
              }
            } catch {
              // ignore parse
            }
          }

          if (tenant?.certificado_pfx_base64 && tenant?.certificado_password) {
            bodyData.certificado = bodyData.certificado || {
              pfxBase64: tenant.certificado_pfx_base64,
              password: tenant.certificado_password
            };
          }

          // Adicionar dados da empresa (obrigatório)
          if (!tenant?.cnpj || !tenant?.nome) {
            return errorResponse(
              "Dados da empresa incompletos. Cadastre CNPJ e Nome da empresa nas Configurações.",
              400
            );
          }

          bodyData.empresa = bodyData.empresa || {
            cnpj: tenant.cnpj,
            razaoSocial: tenant.nome,
            siglaUF: tenant.uf || 'SP'
          };

          let body: string | undefined;
          if (Object.keys(bodyData).length > 0) {
            body = JSON.stringify(bodyData);
            headers["Content-Type"] = "application/json";
          }

          const phpResponse = await fetch(phpUrl.toString(), {
            method: body ? "POST" : "GET",
            headers,
            ...(body ? { body } : {}),
          });
          const phpText = await phpResponse.text();
          let phpData: any;
          try {
            phpData = phpText ? JSON.parse(phpText) : {};
          } catch {
            return errorResponse(
              `Resposta inválida da API CTe (não-JSON). Verifique logs do Railway. ` +
                `HTTP ${phpResponse.status}. Início: ${phpText.slice(0, 200)}`,
              502,
            );
          }
          if (!phpResponse.ok) {
            return jsonResponse({ error: phpData.message || phpData.error || "Erro ao consultar CTe" }, phpResponse.status);
          }
          return jsonResponse(phpData);
        } catch (e: any) {
          return errorResponse(`Erro ao comunicar com API CTe: ${e.message}`, 500);
        }
      }

      // POST /api/ctes/from-nfe - cria um rascunho de CTe baseado em uma NF-e (chave)
      if (path === "/api/ctes/from-nfe" && request.method === "POST") {
        if (!env.CTE_API_URL) {
          return errorResponse("CTE_API_URL não configurada no Worker. Configure a variável de ambiente.", 503);
        }
        try {
          const body = await request.json();
          const chave = body?.chave;
          const ambiente = body?.ambiente || "homologacao";
          if (!chave) return errorResponse("Parâmetro 'chave' (chave NF-e) é obrigatório", 400);

          const { tenantId } = await getTenantForRequest(request, env);
          const tenant = await env.DB.prepare("SELECT certificado_pfx_base64, certificado_password, cnpj, nome, uf FROM tenants WHERE id = ?")
            .bind(tenantId)
            .first<{ certificado_pfx_base64?: string; certificado_password?: string; cnpj?: string; nome?: string; uf?: string }>();

          if (!tenant?.cnpj || !tenant?.nome) {
            return errorResponse("Dados da empresa incompletos. Cadastre CNPJ e Nome nas Configurações.", 400);
          }
          if (!tenant?.certificado_pfx_base64 || !tenant?.certificado_password) {
            return errorResponse("Certificado digital não configurado. Faça upload nas Configurações.", 400);
          }

          const phpBody = {
            certificado: { pfxBase64: tenant.certificado_pfx_base64, password: tenant.certificado_password },
            empresa: { cnpj: tenant.cnpj, razaoSocial: tenant.nome, siglaUF: tenant.uf || "SP" },
            chave,
            ambiente
          };

          const phpResponse = await fetch(`${env.CTE_API_URL}/nfe/consultar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(phpBody),
          });
          const phpText = await phpResponse.text();
          let phpData: any;
          try {
            phpData = phpText ? JSON.parse(phpText) : {};
          } catch {
            return errorResponse(`Resposta inválida da API CTe (não-JSON). HTTP ${phpResponse.status}`, 502);
          }
          if (!phpResponse.ok) {
            return jsonResponse({ error: phpData.error || "Erro ao consultar NF-e" }, phpResponse.status);
          }

          let nfe = phpData.nfe;
          // prepare address/aux vars with safe defaults
          let remetenteCep = "";
          let remetenteLogradouro = "";
          let remetenteNumero = "";
          let remetenteBairro = "";
          let remetenteMunicipio = "";
          let remetenteUf = "";
          let destinatarioCep = "";
          let destinatarioLogradouro = "";
          let destinatarioNumero = "";
          let destinatarioBairro = "";
          let destinatarioMunicipio = "";
          let destinatarioUf = "";
          // If PHP returned node-mde structure: phpData.data.docZip or phpData.docZip
          const docZipArr = (phpData.data && phpData.data.docZip) || phpData.docZip || phpData.data?.docZip;
          if (!nfe && Array.isArray(docZipArr) && docZipArr.length > 0) {
            // find first procNFe / nfeProc entry
            const pick = docZipArr.find((d: any) => {
              const schema = String(d.schema || "").toLowerCase();
              return schema.includes("procnfe") || (d.xml && String(d.xml).toLowerCase().includes("<nfeprom"));
            }) || docZipArr[0];
            const xml = pick.xml || pick.xml || "";
            // If node-mde provided parsed JSON, prefer that for structured fields
            const pickJson = pick.json || pick.jsonProc || (pick.json && pick.json.nfeProc) || null;
            if (pickJson && typeof pickJson === "object") {
              try {
                const nfeProc = pickJson.nfeProc || pickJson;
                const infNFe = nfeProc.NFe?.infNFe || nfeProc.infNFe || null;
                if (infNFe) {
                  // extract enderEmit/enderDest structured values
                  const emit = infNFe.emit || {};
                  const dest = infNFe.dest || {};
                  const enderEmit = emit.enderEmit || emit.endereco || {};
                  const enderDest = dest.enderDest || dest.endereco || {};
                  // override variables
                  remetenteMunicipio = enderEmit.xMun || enderEmit.xNome || remetenteMunicipio;
                  remetenteUf = enderEmit.UF || remetenteUf;
                  remetenteCep = enderEmit.CEP || remetenteCep;
                  remetenteLogradouro = enderEmit.xLgr || remetenteLogradouro;
                  remetenteNumero = enderEmit.nro || remetenteNumero;
                  remetenteBairro = enderEmit.xBairro || remetenteBairro;
                  destinatarioMunicipio = enderDest.xMun || destinatarioMunicipio;
                  destinatarioUf = enderDest.UF || destinatarioUf;
                  destinatarioCep = enderDest.CEP || destinatarioCep;
                  destinatarioLogradouro = enderDest.xLgr || destinatarioLogradouro;
                  destinatarioNumero = enderDest.nro || destinatarioNumero;
                  destinatarioBairro = enderDest.xBairro || destinatarioBairro;
                }
              } catch {
                // ignore parsing errors and fallback to xml regex extraction
              }
            }
            // try to extract useful fields from xml quickly
            const extract = (tag: string) => {
              const re = new RegExp(`<(?:[^>]*:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^>]*:)?${tag}>`, "i");
              const m = String(xml).match(re);
              return m ? m[1].trim() : "";
            };
            // helper to extract a tag inside a parent node (e.g., enderEmit -> CEP)
            const extractFromParent = (parent: string, tag: string) => {
              const re = new RegExp(`<${parent}[^>]*>[\\s\\S]*?<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>[\\s\\S]*?<\\/${parent}>`, "i");
              const m = String(xml).match(re);
              return m ? m[1].trim() : "";
            };
            const ch = extract("chNFe") || extract("Id") || "";
            const nnum = extract("nNF") || (ch ? ch.substr(25, 9) : "");
            const xNomeEmit = extract("xNome") || extract("xNomeEmit") || "";
            // find second xNome for dest if possible
            const xNomeMatches = Array.from(String(xml).matchAll(/<(?:[^>]*:)?xNome[^>]*>([\s\S]*?)<\/(?:[^>]*:)?xNome>/gi)).map((m) => m[1].trim());
            const xNomeDest = xNomeMatches[1] || extract("xNomeDest") || "";
            const vNFVal = extract("vNF") || extract("vProd") || "0";
            const vNF = Number(String(vNFVal).replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
            const dhEmi = extract("dhEmi") || extract("dEmi") || "";
            const placa = extract("placa") || extract("placa") || "";
            // cnpj/cpf emit/dest
            // Prefer explicit parent extraction to avoid grabbing the wrong CNPJ (emit vs dest)
            const emitCnpj = extractFromParent("emit", "CNPJ") || extractFromParent("emit", "CPF") || extract("CNPJ") || extract("CPF") || "";
            const destCnpj = extractFromParent("dest", "CNPJ") || extractFromParent("dest", "CPF") || (() => {
              const destMatch = xml.match(/<dest[^\>]*>[\s\S]*?<(?:[^>]*:)?CNPJ[^>]*>([\s\S]*?)<\/(?:[^>]*:)?CNPJ>/i);
              return destMatch ? destMatch[1].trim() : "";
            })();
            remetenteCep = extractFromParent("enderEmit", "CEP") || extract("CEP") || "";
            remetenteLogradouro = extractFromParent("enderEmit", "xLgr") || extract("xLgr") || "";
            remetenteNumero = extractFromParent("enderEmit", "nro") || extract("nro") || "";
            remetenteBairro = extractFromParent("enderEmit", "xBairro") || extract("xBairro") || "";
            remetenteMunicipio = extractFromParent("enderEmit", "xMun") || extract("xMun") || "";
            remetenteUf = extractFromParent("enderEmit", "UF") || extract("UF") || "";
            destinatarioCep = extractFromParent("enderDest", "CEP") || "";
            destinatarioLogradouro = extractFromParent("enderDest", "xLgr") || "";
            destinatarioNumero = extractFromParent("enderDest", "nro") || "";
            destinatarioBairro = extractFromParent("enderDest", "xBairro") || "";
            destinatarioMunicipio = extractFromParent("enderDest", "xMun") || "";
            destinatarioUf = extractFromParent("enderDest", "UF") || "";
            nfe = {
              chave: ch,
              nfe: nnum,
              xNomeEmit,
              xNomeDest,
              vNF,
              dhEmi,
              placa,
              emitCnpj,
              destCnpj
            };
            // attempt to find vehicle by placa in DB and add veiculoId to nfe object
            try {
              const placaNormRaw = String(placa || "").trim();
              const normalizePlaca = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
              const placaNorm = normalizePlaca(placaNormRaw);
              if (placaNorm) {
                // fetch candidate vehicles for tenant and match by normalized plate
                const rowsRes = await env.DB.prepare("SELECT id, placa, modelo FROM vehicles WHERE tenant_id = ?").bind(tenantId).all();
                const rows = rowsRes.results || [];
                for (const r of rows) {
                  const dbPlacaNorm = normalizePlaca(String(r.placa || ""));
                  if (dbPlacaNorm === placaNorm) {
                    (nfe as any).veiculoId = r.id;
                    (nfe as any).veiculoModelo = r.modelo || null;
                    break;
                  }
                }
              }
            } catch {
              // ignore db lookup errors
            }
          }
          // Fallback: se PHP retornou raw XML (SOAP), tentar extrair informações úteis
          if (!nfe && phpData.raw) {
            const xml = String(phpData.raw);
            const extractTag = (tag: string) => {
              const re = new RegExp(`<(?:(?:[^>]*:)?${tag})(?:[^>]*)>([\\s\\S]*?)<\\/(?:[^>]*:)?${tag}>`, "i");
              const m = xml.match(re);
              return m ? m[1].trim() : "";
            };
            const extractFromParent = (parent: string, tag: string) => {
              const re = new RegExp(`<${parent}[^>]*>[\\s\\S]*?<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>[\\s\\S]*?<\\/${parent}>`, "i");
              const m = String(xml).match(re);
              return m ? m[1].trim() : "";
            };
            const ch = extractTag("chNFe") || "";
            const nnum = extractTag("nNF") || (ch ? ch.substr(25, 9) : "");
            const xNomeMatches = Array.from(xml.matchAll(/<(?:[^>]*:)?xNome[^>]*>([\s\S]*?)<\/(?:[^>]*:)?xNome>/gi)).map((m) => (m[1] || "").trim());
            const xNomeEmit = xNomeMatches[0] || extractTag("xNomeEmit") || "";
            const xNomeDest = xNomeMatches[1] || extractTag("xNomeDest") || "";
            const vNFVal = extractTag("vNF") || extractTag("vProd") || "0";
            const vNF = Number(String(vNFVal).replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
            const dhEmi = extractTag("dhEmi") || extractTag("dEmi") || "";
            const placa = extractTag("placa") || "";
            const emitCnpj = extractTag("CNPJ") || extractTag("CPF") || "";
            const destMatch = xml.match(/<dest[^\>]*>[\s\S]*?<(?:[^>]*:)?CNPJ[^>]*>([\s\S]*?)<\/(?:[^>]*:)?CNPJ>/i);
            const destCnpj = destMatch ? destMatch[1].trim() : extractTag("CNPJ") || "";

            // addresses
            remetenteCep = extractFromParent("enderEmit", "CEP") || extractTag("CEP") || "";
            remetenteLogradouro = extractFromParent("enderEmit", "xLgr") || extractTag("xLgr") || "";
            remetenteNumero = extractFromParent("enderEmit", "nro") || extractTag("nro") || "";
            remetenteBairro = extractFromParent("enderEmit", "xBairro") || extractTag("xBairro") || "";
            remetenteMunicipio = extractFromParent("enderEmit", "xMun") || extractTag("xMun") || "";
            remetenteUf = extractFromParent("enderEmit", "UF") || extractTag("UF") || "";
            destinatarioCep = extractFromParent("enderDest", "CEP") || "";
            destinatarioLogradouro = extractFromParent("enderDest", "xLgr") || "";
            destinatarioNumero = extractFromParent("enderDest", "nro") || "";
            destinatarioBairro = extractFromParent("enderDest", "xBairro") || "";
            destinatarioMunicipio = extractFromParent("enderDest", "xMun") || "";
            destinatarioUf = extractFromParent("enderDest", "UF") || "";

            nfe = {
              chave: ch,
              nfe: nnum,
              xNomeEmit,
              xNomeDest,
              vNF,
              dhEmi,
              placa,
              emitCnpj,
              destCnpj,
              remetenteCep,
              remetenteLogradouro,
              remetenteNumero,
              remetenteBairro,
              remetenteMunicipio,
              remetenteUf,
              destinatarioCep,
              destinatarioLogradouro,
              destinatarioNumero,
              destinatarioBairro,
              destinatarioMunicipio,
              destinatarioUf
            };
            // Lookup vehicle by placa for both parsed JSON and raw XML branches
            try {
              const placaNormRaw = String((nfe as any).placa || (nfe as any).veiculoPlaca || "").trim();
              const normalizePlaca = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
              const placaNorm = normalizePlaca(placaNormRaw);
              if (placaNorm) {
                const rowsRes = await env.DB.prepare("SELECT id, placa, modelo FROM vehicles WHERE tenant_id = ?").bind(tenantId).all();
                const rows = rowsRes.results || [];
                let found: any = null;
                for (const r of rows) {
                  const dbPlacaNorm = normalizePlaca(String(r.placa || ""));
                  if (dbPlacaNorm === placaNorm) {
                    found = r;
                    break;
                  }
                }
                if (!found && placaNorm.length >= 4) {
                  const tail = placaNorm.slice(-4);
                  for (const r of rows) {
                    const dbPlacaNorm = normalizePlaca(String(r.placa || ""));
                    if (dbPlacaNorm.endsWith(tail)) {
                      found = r;
                      break;
                    }
                  }
                }
                if (found) {
                  (nfe as any).veiculoId = found.id;
                  (nfe as any).veiculoModelo = found.modelo || null;
                } else {
                  console.log("No vehicle match for placa:", placaNorm);
                }
              } else {
                console.log("No placa found in NFe payload");
              }
            } catch (err) {
              console.error("Vehicle lookup error:", err);
            }
          }
          if (!nfe) return errorResponse("NF-e não encontrada ou resposta inválida", 404);

          // Montar payload mínimo para rascunho de CTe baseado na NF-e
          const ctePayload: Record<string, any> = {
            // Campos básicos e mapeamento entre NF-e e CTe
            // `numero` é obrigatório no banco (NOT NULL) — preencher com número da NF-e
            numero: nfe.nfe || "",
            numero_nota: nfe.nfe || "",
            chave: nfe.chave || "",
            chave_origem: nfe.chave || "",
            remetente_nome: nfe.xNomeEmit || "",
            destinatario_nome: nfe.xNomeDest || "",
            // CNPJs/CPFs e endereços extraídos do XML (quando disponíveis)
            remetenteCnpjCpf: nfe.emitCnpj || nfe.emitCnpj || "",
            destinatarioCnpjCpf: nfe.destCnpj || nfe.destCnpj || "",
            remetenteCep: nfe.remetenteCep || remetenteCep || null,
            remetenteLogradouro: nfe.remetenteLogradouro || remetenteLogradouro || null,
            remetenteNumero: nfe.remetenteNumero || remetenteNumero || null,
            remetenteBairro: nfe.remetenteBairro || remetenteBairro || null,
            remetenteMunicipio: nfe.remetenteMunicipio || remetenteMunicipio || null,
            remetenteUf: nfe.remetenteUf || remetenteUf || null,
            destinatarioCep: nfe.destinatarioCep || destinatarioCep || null,
            destinatarioLogradouro: nfe.destinatarioLogradouro || destinatarioLogradouro || null,
            destinatarioNumero: nfe.destinatarioNumero || destinatarioNumero || null,
            destinatarioBairro: nfe.destinatarioBairro || destinatarioBairro || null,
            destinatarioMunicipio: nfe.destinatarioMunicipio || destinatarioMunicipio || null,
            destinatarioUf: nfe.destinatarioUf || destinatarioUf || null,
            veiculoPlaca: (nfe.placa || nfe.veiculoPlaca || null) ? String(nfe.placa || nfe.veiculoPlaca).toUpperCase().replace(/[^A-Z0-9]/g, "") : null,
            veiculoId: (nfe as any).veiculoId || null,
            // origem/destino (município/UF) - prefer explicit extracted values
            municipioOrigem: nfe.remetenteMunicipio || remetenteMunicipio || null,
            ufOrigem: nfe.remetenteUf || remetenteUf || null,
            municipioDestino: nfe.destinatarioMunicipio || destinatarioMunicipio || null,
            ufDestino: nfe.destinatarioUf || destinatarioUf || null,
            // preencher valor_prestacao/valor_total para consistência com frontend e schema
            valor_prestacao: nfe.vNF || 0,
            valor_total: nfe.vNF || 0,
            // data_emissao é NOT NULL no schema D1 — usar dhEmi da NF-e se disponível, senão hoje
            data_emissao: (nfe.dhEmi ? (String(nfe.dhEmi).split('T')[0]) : (new Date().toISOString().split('T')[0])),
            inf_carga: [
              {
                numero: nfe.nfe || "",
                produto: "Mercadoria",
                valor: nfe.vNF || 0,
                peso: 0,
                chave: nfe.chave || ""
              }
            ],
            informacoes_adicionais: [],
            tomador: "",
            cfop: "",
            valor_frete: 0,
            has_expedidor: 0,
            has_recebedor: 0,
            emitir_retroativo: 0,
            texto_nota: `Referente à NF-e ${nfe.nfe || ''} - CHAVE ${nfe.chave || ''}`,
            status: "rascunho"
          };

          // Antes de persistir, suportar modo "preview" para retornar o payload ao frontend
          // sem salvar — útil para mostrar dados (veículo, origem/destino) antes da confirmação.
          const previewFlag =
            url.searchParams.get("preview") === "true" ||
            (typeof (body?.preview) !== "undefined" && body.preview === true);

          // Incluir dados do veículo (se o lookup encontrou) no payload de preview
          const matchedVehicle =
            (nfe as any).veiculoId
              ? { id: (nfe as any).veiculoId, placa: ctePayload.veiculoPlaca, modelo: (nfe as any).veiculoModelo || null }
              : null;

          if (previewFlag) {
            // Retornar o payload sem persistir
            return jsonResponse({ preview: ctePayload, matchedVehicle });
          }

          // Usar handleCreate para persistir na tabela ctes (aplica conversões e overrides)
          const config = RESOURCE_MAP["ctes"];
          // Garantir que veiculoId seja incluído no payload se encontrado
          if (matchedVehicle) {
            ctePayload.veiculoId = matchedVehicle.id;
            ctePayload.veiculoModelo = matchedVehicle.modelo;
          }
          return await handleCreate(env.DB, config.table, ctePayload, tenantId, config.fieldOverrides);
        } catch (e: any) {
          return errorResponse(`Erro ao criar rascunho CTe a partir da NF-e: ${e.message}`, 500);
        }
      }

      // POST /api/nfe/busca-sefaz — Busca NF-e na SEFAZ (Distribuição DFe)
      if (path === "/api/nfe/busca-sefaz" && request.method === "POST") {
        if (!env.CTE_API_URL) {
          return errorResponse("CTE_API_URL não configurada no Worker. Configure a variável de ambiente.", 503);
        }
        try {
          const body = await request.json() as Record<string, unknown>;
          const ambiente = (body.ambiente as string) || "homologacao";
          const { tenantId } = await getTenantForRequest(request, env);
          const tenant = await env.DB.prepare("SELECT certificado_pfx_base64, certificado_password, cnpj, nome, uf FROM tenants WHERE id = ?")
            .bind(tenantId)
            .first<{ certificado_pfx_base64?: string; certificado_password?: string; cnpj?: string; nome?: string; uf?: string }>();

          if (!tenant?.cnpj || !tenant?.nome) {
            return errorResponse("Dados da empresa incompletos. Cadastre CNPJ e Nome nas Configurações.", 400);
          }
          if (!tenant?.certificado_pfx_base64 || !tenant?.certificado_password) {
            return errorResponse("Certificado digital não configurado. Faça upload nas Configurações.", 400);
          }
 
          // Verificar estado de buscas NFe para este tenant (evita re-tentativas que causem bloqueio)
          const now = new Date().toISOString();
          // Ensure migration-added columns exist (backwards compatibility)
          await ensureNfeSearchStateColumns(env.DB);
          const state = await env.DB.prepare("SELECT tenant_id, last_ult_nsu, last_search_at, in_progress, blocked_until, retry_count, next_retry_at FROM nfe_search_state WHERE tenant_id = ?")
            .bind(tenantId)
            .first();

          if (state && state.blocked_until) {
            const blockedUntil = new Date(state.blocked_until);
            if (blockedUntil > new Date()) {
              return jsonResponse({ error: `Busca temporariamente bloqueada pela SEFAZ até ${state.blocked_until} (SEFAZ cStat 656)` }, 429);
            }
          }
          if (state && state.next_retry_at) {
            const nextRetry = new Date(state.next_retry_at);
            if (nextRetry > new Date()) {
              return jsonResponse({ error: `Busca com retry agendado para ${state.next_retry_at}` }, 429);
            }
          }

          if (state && state.in_progress) {
            return jsonResponse({ error: "Busca já em andamento para este tenant. Tente novamente mais tarde." }, 409);
          }

          // Marcar busca em andamento
          if (state) {
            await env.DB.prepare("UPDATE nfe_search_state SET in_progress = 1, last_search_at = ? WHERE tenant_id = ?").bind(now, tenantId).run();
          } else {
            await env.DB.prepare("INSERT INTO nfe_search_state (tenant_id, last_ult_nsu, last_search_at, in_progress) VALUES (?, ?, ?, ?)").bind(tenantId, 0, now, 1).run();
          }

          // Allow fullScan only for admin callers
          const adminHeader = request.headers.get("X-Admin-Secret") || (request.headers.get("Authorization")?.startsWith("Bearer ") ? request.headers.get("Authorization")!.slice("Bearer ".length) : null);
          const secret = getAuthSecret(env);

          const phpBody: any = {
            certificado: { pfxBase64: tenant.certificado_pfx_base64, password: tenant.certificado_password },
            empresa: { cnpj: tenant.cnpj, razaoSocial: tenant.nome, siglaUF: tenant.uf || "SP" },
            ambiente,
            ultNSU: state?.last_ult_nsu ?? (body.ultNSU ?? 0),
          };
          // If caller explicitly asked for fullScan and is admin, allow it
          if ((body.fullScan === true || body.fullScan === "true") && adminHeader && adminHeader === secret) {
            phpBody.fullScan = true;
          }

          let phpData: any;
          try {
            const phpResponse = await fetch(`${env.CTE_API_URL}/nfe-busca-sefaz`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(phpBody),
            });
            const phpText = await phpResponse.text();
            try {
              phpData = phpText ? JSON.parse(phpText) : {};
            } catch {
              // Garantir que in_progress seja removido
              await env.DB.prepare("UPDATE nfe_search_state SET in_progress = 0 WHERE tenant_id = ?").bind(tenantId).run();
              return errorResponse(`Resposta inválida da API: HTTP ${phpResponse.status}`, 502);
            }
            if (!phpResponse.ok) {
              // Atualizar in_progress = 0
              await env.DB.prepare("UPDATE nfe_search_state SET in_progress = 0 WHERE tenant_id = ?").bind(tenantId).run();
              return jsonResponse({ error: phpData.error || "Erro ao buscar NF-e na SEFAZ" }, phpResponse.status);
            }

            // Se SEFAZ indicou bloqueio (cStat 656) ou outro status, aplicar backoff/exponential retry
            const cStat = String(phpData.cStat || phpData.cstat || "");
            const ultNSUReturned = phpData.ultNSU ?? phpData.ultNsu ?? null;
            let blockedUntil: string | null = null;
            let retryCount = state?.retry_count ?? 0;
            let nextRetryAt: string | null = null;

            if (cStat === "656") {
              // set blocked until 1 hour as required by SEFAZ
              blockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
              // increment retry_count and schedule exponential backoff (minutes)
              retryCount = Math.min((retryCount || 0) + 1, 6);
              const delayMinutes = Math.pow(2, retryCount - 1); // 1,2,4,8,...
              nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
            } else {
              // success or neutral: reset retry counters
              retryCount = 0;
              nextRetryAt = null;
            }

            // Atualizar estado
            const newUlt = ultNSUReturned !== null ? Number(ultNSUReturned) : state?.last_ult_nsu ?? 0;
            await env.DB.prepare("UPDATE nfe_search_state SET in_progress = 0, last_ult_nsu = ?, last_search_at = ?, blocked_until = ?, retry_count = ?, next_retry_at = ? WHERE tenant_id = ?")
              .bind(newUlt, new Date().toISOString(), blockedUntil, retryCount, nextRetryAt, tenantId)
              .run();

            return jsonResponse(phpData);
          } catch (e: any) {
            // Garantir que in_progress seja removido em caso de erro
            await env.DB.prepare("UPDATE nfe_search_state SET in_progress = 0 WHERE tenant_id = ?").bind(tenantId).run();
            return errorResponse(`Erro ao buscar NF-e na SEFAZ: ${e.message}`, 500);
          }
        } catch (e: any) {
          return errorResponse(`Erro ao buscar NF-e na SEFAZ: ${e.message}`, 500);
        }
      }

      // ===== AUTH ROUTES =====
      if (path === "/api/auth/register" && request.method === "POST") {
        const body = (await request.json()) as {
          companyName?: string;
          cnpj?: string;
          email?: string;
          password?: string;
          nome?: string;
          telefone?: string;
          endereco?: string;
          uf?: string;
        };

        const companyName = body.companyName || body.nome || "Empresa";
        const cnpj = (body.cnpj || "").replace(/\D/g, "").trim();
        const email = body.email?.trim().toLowerCase();
        const password = body.password;
        const telefone = body.telefone?.trim() || null;
        const endereco = body.endereco?.trim() || null;
        const uf = body.uf?.trim() || null;

        if (!companyName || !cnpj || !email || !password) {
          return errorResponse("companyName, cnpj, email e password são obrigatórios", 400);
        }

        // Verifica se já existe tenant com esse CNPJ
        let tenant = await env.DB.prepare("SELECT id FROM tenants WHERE cnpj = ?").bind(cnpj).first();
        if (!tenant) {
          const tenantId = crypto.randomUUID().replace(/-/g, "");
          await env.DB
            .prepare(
              "INSERT INTO tenants (id, nome, cnpj, email, telefone, endereco, uf) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(tenantId, companyName, cnpj, email, telefone, endereco, uf)
            .run();
          tenant = { id: tenantId };
        }

        const tenantId = (tenant as any).id as string;

        // Verifica se já existe usuário com esse email
        const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existingUser) {
          return errorResponse("Já existe um usuário com este e-mail", 400);
        }

        const passwordHash = await hashPassword(password);
        const userId = crypto.randomUUID().replace(/-/g, "");
        const nome = body.nome || companyName;

        await env.DB
          .prepare(
            "INSERT INTO users (id, tenant_id, email, nome, password_hash, role, ativo) VALUES (?, ?, ?, ?, ?, 'admin', 1)",
          )
          .bind(userId, tenantId, email, nome, passwordHash)
          .run();

        const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_HOURS * 3600;
        const token = await signToken({ userId, tenantId, exp }, getAuthSecret(env));

        return jsonResponse({
          token,
          tenantId,
          user: { id: userId, email, nome, role: "admin" },
        }, 201);
      }

      if (path === "/api/auth/login" && request.method === "POST") {
        const body = (await request.json()) as { email?: string; password?: string };
        const email = body.email?.trim().toLowerCase();
        const password = body.password;
        if (!email || !password) {
          return errorResponse("email e password são obrigatórios", 400);
        }

        const row = await env.DB
          .prepare("SELECT id, tenant_id, nome, role, password_hash, ativo FROM users WHERE email = ?")
          .bind(email)
          .first();

        if (!row) {
          return errorResponse("Credenciais inválidas", 401);
        }

        const user = row as any;
        if (!user.ativo) {
          return errorResponse("Usuário inativo", 403);
        }

        const ok = await verifyPassword(password, user.password_hash as string);
        if (!ok) {
          return errorResponse("Credenciais inválidas", 401);
        }

        const tenantId = user.tenant_id as string;
        const userId = user.id as string;
        const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_HOURS * 3600;
        const token = await signToken({ userId, tenantId, exp }, getAuthSecret(env));

        return jsonResponse({
          token,
          tenantId,
          user: { id: userId, email, nome: user.nome, role: user.role },
        });
      }

      // Match /api/:resource or /api/:resource/:id
      const match = path.match(/^\/api\/([a-z]+)(?:\/([a-zA-Z0-9-]+))?$/);
      if (!match) return errorResponse("Not found", 404);

      const [, resource, itemId] = match;
      const config = RESOURCE_MAP[resource];
      if (!config) return errorResponse(`Unknown resource: ${resource}`, 404);

      // Get tenant ID (via token ou header legado)
      // Para tenants, não filtra por tenant_id (é a própria tabela de tenants)
      const { tenantId } = await getTenantForRequest(request, env);

      switch (request.method) {
        case "GET":
          if (itemId) {
            return handleGet(env.DB, config.table, itemId, tenantId, config.fieldOverrides);
          }
          return handleList(env.DB, config.table, tenantId, config.fieldOverrides);

        case "POST": {
          const body = await request.json();
          return handleCreate(env.DB, config.table, body as Record<string, any>, tenantId, config.fieldOverrides);
        }

        case "PUT": {
          if (!itemId) return errorResponse("ID required for update");
          const body = await request.json();
          return handleUpdate(env.DB, config.table, itemId, body as Record<string, any>, tenantId, config.fieldOverrides);
        }

        case "DELETE":
          if (!itemId) return errorResponse("ID required for delete");
          return handleDelete(env.DB, config.table, itemId, tenantId);

        default:
          return errorResponse("Method not allowed", 405);
      }
    } catch (err: any) {
      console.error("API Error:", err);
      // ALWAYS return CORS headers even on crash. Include stack/details for debugging.
      const message = err?.message || String(err) || "Internal server error";
      const details = err?.stack || err;
      return new Response(JSON.stringify({ error: message, details }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
