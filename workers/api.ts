// FleetCommand - Cloudflare Worker REST API
// Generic CRUD for all D1 tables with camelCase↔snake_case conversion

interface Env {
  DB: D1Database;
  AUTH_SECRET?: string;
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
  fuel: { table: "fuel_entries" },
  tires: { table: "tires" },
  parts: { table: "parts" },
  expenses: { table: "expenses" },
  licenses: { table: "licenses" },
  insurances: { table: "insurances" },
  incidents: { table: "incidents" },
  garage: { table: "garage_entries" },
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
  const map = reverse
    ? Object.fromEntries(Object.entries(overrides).map(([k, v]) => [v, k]))
    : overrides;

  for (const [key, value] of Object.entries(data)) {
    result[map[key] || key] = value;
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
  const { results } = await db
    .prepare(`SELECT * FROM ${table} WHERE tenant_id = ? ORDER BY created_at DESC`)
    .bind(tenantId)
    .all();

  const items = (results || []).map((row) => {
    let camel = objectKeysToCamel(row as Record<string, any>);
    camel = applyFieldOverrides(camel, overrides, true);
    return camel;
  });

  return jsonResponse({ data: items });
}

async function handleGet(
  db: D1Database,
  table: string,
  id: string,
  tenantId: string,
  overrides?: Record<string, string>
): Promise<Response> {
  const row = await db
    .prepare(`SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`)
    .bind(id, tenantId)
    .first();

  if (!row) return errorResponse("Not found", 404);

  let camel = objectKeysToCamel(row as Record<string, any>);
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
  snakeData.tenant_id = tenantId;

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
  // Add updated_at
  snakeData.updated_at = new Date().toISOString();

  const sets = Object.keys(snakeData)
    .map((k) => `${k} = ?`)
    .join(", ");
  const values = [...Object.values(snakeData), id, tenantId];

  await db
    .prepare(`UPDATE ${table} SET ${sets} WHERE id = ? AND tenant_id = ?`)
    .bind(...values)
    .run();

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

      // Setup default tenant (modo legado - pode ser removido depois)
      if (path === "/api/setup" && request.method === "POST") {
        const tenantId = await getOrCreateTenant(env.DB);
        return jsonResponse({ tenantId });
      }

      // ===== AUTH ROUTES =====
      if (path === "/api/auth/register" && request.method === "POST") {
        const body = (await request.json()) as {
          companyName?: string;
          cnpj?: string;
          email?: string;
          password?: string;
          nome?: string;
        };

        const companyName = body.companyName || body.nome || "Empresa";
        const cnpj = body.cnpj?.trim();
        const email = body.email?.trim().toLowerCase();
        const password = body.password;

        if (!companyName || !cnpj || !email || !password) {
          return errorResponse("companyName, cnpj, email e password são obrigatórios", 400);
        }

        // Verifica se já existe tenant com esse CNPJ
        let tenant = await env.DB.prepare("SELECT id FROM tenants WHERE cnpj = ?").bind(cnpj).first();
        if (!tenant) {
          const tenantId = crypto.randomUUID().replace(/-/g, "");
          await env.DB
            .prepare("INSERT INTO tenants (id, nome, cnpj, email) VALUES (?, ?, ?, ?)")
            .bind(tenantId, companyName, cnpj, email)
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
      // ALWAYS return CORS headers even on crash
      return errorResponse(err.message || "Internal server error", 500);
    }
  },
};
