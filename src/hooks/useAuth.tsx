import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_URL, setAuthSession } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  tenantId: string | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    companyName: string;
    cnpj: string;
    email: string;
    password: string;
    nome?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("fleet_auth_token");
    const storedTenant = localStorage.getItem("fleet_tenant_id");
    const storedUser = localStorage.getItem("fleet_user");

    if (storedToken && storedTenant && storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as AuthUser;
        setUser(parsed);
        setTenantId(storedTenant);
        setToken(storedToken);
        setAuthSession(storedToken, storedTenant);
      } catch {
        // Se der erro, limpa sessão
        setAuthSession(null, null);
        localStorage.removeItem("fleet_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Falha ao entrar");
    }

    const { token: t, tenantId: tid, user: u } = json;
    setUser(u);
    setTenantId(tid);
    setToken(t);
    setAuthSession(t, tid);
    localStorage.setItem("fleet_user", JSON.stringify(u));
  };

  const register = async (data: {
    companyName: string;
    cnpj: string;
    email: string;
    password: string;
    nome?: string;
  }) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Falha ao criar conta");
    }

    const { token: t, tenantId: tid, user: u } = json;
    setUser(u);
    setTenantId(tid);
    setToken(t);
    setAuthSession(t, tid);
    localStorage.setItem("fleet_user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    setTenantId(null);
    setToken(null);
    setAuthSession(null, null);
    localStorage.removeItem("fleet_user");
  };

  const value: AuthContextValue = {
    user,
    tenantId,
    token,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}

