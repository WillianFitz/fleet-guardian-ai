import { useState, useEffect } from "react";
import { api, isApiConfigured, API_URL } from "@/lib/api";
import { useAuth } from "./useAuth";

export interface Tenant {
  id: string;
  nome: string;
  cnpj: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useTenant() {
  const { tenantId } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    if (!isApiConfigured()) {
      // Modo offline: busca do localStorage
      try {
        const stored = localStorage.getItem("fleet_tenant_data");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.id === tenantId) {
            setTenant(parsed);
          }
        }
      } catch (err) {
        console.error("[useTenant] Failed to load from localStorage:", err);
      }
      setLoading(false);
      return;
    }

    // Busca o tenant atual da API
    const fetchTenant = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const token = localStorage.getItem("fleet_auth_token");
        const cachedTenantId = localStorage.getItem("fleet_tenant_id");
        
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        } else if (cachedTenantId) {
          headers["X-Tenant-Id"] = cachedTenantId;
        }

        const res = await fetch(`${API_URL}/api/tenants/${tenantId}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch tenant: ${res.status}`);
        
        const json = await res.json();
        if (json.data) {
          setTenant(json.data);
          localStorage.setItem("fleet_tenant_data", JSON.stringify(json.data));
        }
      } catch (err) {
        console.error("[useTenant] Failed to fetch tenant:", err);
        // Tenta usar dados do localStorage em caso de erro
        try {
          const stored = localStorage.getItem("fleet_tenant_data");
          if (stored) {
            setTenant(JSON.parse(stored));
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantId]);

  const updateTenant = async (data: Partial<Tenant>): Promise<Tenant> => {
    if (!tenantId || !tenant) {
      throw new Error("Tenant não encontrado");
    }

    if (!isApiConfigured()) {
      // Modo offline: salva apenas no localStorage
      const updated = { ...tenant, ...data };
      localStorage.setItem("fleet_tenant_data", JSON.stringify(updated));
      setTenant(updated);
      return updated as Tenant;
    }

    const updated = await api.update<Tenant>("tenants", tenantId, data);
    setTenant(updated);
    localStorage.setItem("fleet_tenant_data", JSON.stringify(updated));
    return updated;
  };

  return { tenant, loading, updateTenant };
}
