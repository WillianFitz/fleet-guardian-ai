// FleetCommand API Client
// Connects frontend to Cloudflare Workers REST API

export const API_URL =
  import.meta.env.VITE_API_URL || "https://fleet-guardian-ai.willian-fitzbr.workers.dev";

let cachedTenantId: string | null = localStorage.getItem("fleet_tenant_id");
let authToken: string | null = localStorage.getItem("fleet_auth_token");
let tenantPromise: Promise<void> | null = null;

export function setAuthSession(token: string | null, tenantId: string | null) {
  authToken = token;
  cachedTenantId = tenantId;

  if (token) {
    localStorage.setItem("fleet_auth_token", token);
  } else {
    localStorage.removeItem("fleet_auth_token");
  }

  if (tenantId) {
    localStorage.setItem("fleet_tenant_id", tenantId);
  } else {
    localStorage.removeItem("fleet_tenant_id");
  }
}

export function isApiConfigured(): boolean {
  return API_URL.length > 0;
}

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cachedTenantId) {
    headers["X-Tenant-Id"] = cachedTenantId;
  }
   if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

async function ensureTenant(): Promise<void> {
  // Em modo de produção com login, o tenant é definido pelo backend via auth.
  // Mantemos apenas como fallback legado.
  if (cachedTenantId || !isApiConfigured()) return;
  // Deduplicate concurrent calls — only one setup request at a time
  if (!tenantPromise) {
    tenantPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (json.tenantId) {
          cachedTenantId = json.tenantId;
          localStorage.setItem("fleet_tenant_id", json.tenantId);
        }
      } catch (err) {
        console.warn("Failed to setup tenant:", err);
      } finally {
        tenantPromise = null;
      }
    })();
  }
  return tenantPromise;
}

export const api = {
  async list<T>(resource: string): Promise<T[]> {
    if (!isApiConfigured()) return [];
    await ensureTenant();
    const res = await fetch(`${API_URL}/api/${resource}`, {
      headers: await getHeaders(),
    });
    if (!res.ok) throw new Error(`GET /${resource} failed: ${res.status}`);
    const json = await res.json();
    return json.data || [];
  },

  async create<T>(resource: string, data: Omit<T, "id">): Promise<T> {
    if (!isApiConfigured()) throw new Error("API not configured");
    await ensureTenant();
    const res = await fetch(`${API_URL}/api/${resource}`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `POST /${resource} failed: ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  },

  async update<T>(resource: string, id: string, data: Partial<T>): Promise<T> {
    if (!isApiConfigured()) throw new Error("API not configured");
    await ensureTenant();
    const res = await fetch(`${API_URL}/api/${resource}/${id}`, {
      method: "PUT",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `PUT /${resource}/${id} failed: ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  },

  async remove(resource: string, id: string): Promise<void> {
    if (!isApiConfigured()) throw new Error("API not configured");
    await ensureTenant();
    const res = await fetch(`${API_URL}/api/${resource}/${id}`, {
      method: "DELETE",
      headers: await getHeaders(),
    });
    if (!res.ok) throw new Error(`DELETE /${resource}/${id} failed: ${res.status}`);
  },
};
