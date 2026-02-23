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

// A API CTe agora é acessada via Worker (proxy) - não precisa mais de VITE_CTE_API_URL no frontend
// O Worker precisa ter CTE_API_URL configurada nas variáveis de ambiente

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

/** API CTe via Worker (proxy para backend PHP SPED-CTe). O Worker precisa ter CTE_API_URL configurada. */
export const cteApi = {
  async emitir(dados: Record<string, unknown>, ambiente?: "producao" | "homologacao"): Promise<{ chave?: string; protocolo?: string; xml?: string; error?: string }> {
    const payload = { ...dados, ambiente: ambiente || "homologacao" };
    const res = await fetch(`${API_URL}/api/cte/emitir`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.message || `Falha ao emitir CTe: ${res.status}`);
    }
    return json;
  },
  async fromNfe(chave: string, ambiente?: "producao" | "homologacao") {
    const res = await fetch(`${API_URL}/api/ctes/from-nfe`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ chave, ambiente: ambiente || "homologacao" }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.message || `Falha ao criar rascunho de CTe a partir da NF-e: ${res.status}`);
    }
    return json;
  },
  async consultar(chave: string, ambiente?: "producao" | "homologacao"): Promise<{ status: string; protocolo?: string; xml?: string; error?: string }> {
    const url = new URL(`${API_URL}/api/cte/consultar`);
    url.searchParams.set("chave", chave);
    if (ambiente) {
      url.searchParams.set("ambiente", ambiente);
    }
    const res = await fetch(url.toString(), {
      headers: await getHeaders(),
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const message = json.error || json.message || json.raw || `Falha ao consultar CTe: ${res.status}`;
      const err = new Error(message);
      // attach debug info
      (err as any).status = res.status;
      (err as any).body = json;
      throw err;
    }
    return json;
  },
  async buscaNFeSefaz(
    ambiente?: "producao" | "homologacao",
    ultNSU?: number,
  ): Promise<{
    nfe: Array<{ chave: string; nfe: string; dhEmi: string; xNomeEmit: string; xNomeDest: string; vNF: number }>;
    ultNSU: number;
    maxNSU: number;
    cStat?: string;
    xMotivo?: string;
  }> {
    const res = await fetch(`${API_URL}/api/nfe/busca-sefaz`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ ambiente: ambiente || "homologacao", ultNSU: ultNSU ?? 0 }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.message || `Falha ao buscar NF-e na SEFAZ: ${res.status}`);
    }
    return json;
  },
};
