import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import KpiCard from "@/components/dashboard/KpiCard";

interface Metrics {
  totalExpenses?: number;
  totalFuel?: number;
  totalMaint?: number;
  totalVehicles?: number;
  totalDrivers?: number;
  byVehicle?: Array<any>;
  monthly?: any;
}

const FleetMetricsCard = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const headers: Record<string,string> = { "Content-Type": "application/json" };
        const token = localStorage.getItem("fleet_auth_token");
        const tenantId = localStorage.getItem("fleet_tenant_id");
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (!token && tenantId) headers["X-Tenant-Id"] = tenantId;

        const res = await fetch(`${API_URL}/api/insights`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "metrics", period_days: 30 }),
        });
        const j = await res.json();
        if (j?.data?.metrics) {
          setMetrics(j.data.metrics);
        } else {
          setMetrics(null);
        }
      } catch (e) {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!metrics) {
    return (
      <div className="glass-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-2">Métricas Rápidas (30 dias)</h3>
        <div className="text-sm text-muted-foreground">{loading ? "Carregando..." : "Sem dados disponíveis"}</div>
      </div>
    );
  }

  const totalLitros = metrics.totalFuel ?? 0;
  const totalValor = metrics.totalExpenses ?? 0;
  const precoMedio = totalLitros > 0 ? totalValor / totalLitros : 0;
  const totalKm = (() => {
    try {
      const monthly = (metrics && metrics.monthly) ? metrics.monthly : null;
      const expenses = monthly?.expenses || [];
      return (expenses || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
    } catch {
      return 0;
    }
  })();

  return (
    <div className="glass-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-3">Métricas Rápidas (30 dias)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3 bg-card/10 rounded-md">
          <div className="text-xs text-muted-foreground">Total Abastecido</div>
          <div className="text-lg font-semibold">{(metrics.byVehicle || []).reduce((s:number, v:any) => s + (v.litros||0), 0).toLocaleString("pt-BR")} L</div>
        </div>
        <div className="p-3 bg-card/10 rounded-md">
          <div className="text-xs text-muted-foreground">Custo Combustível</div>
          <div className="text-lg font-semibold">R$ {(metrics.totalFuel ? metrics.totalFuel/1000 : (metrics.totalExpenses||0)/1000).toFixed(1)}k</div>
        </div>
        <div className="p-3 bg-card/10 rounded-md">
          <div className="text-xs text-muted-foreground">Preço médio (R$/L)</div>
          <div className="text-lg font-semibold">R$ {precoMedio ? precoMedio.toFixed(2) : "—"}</div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Top veículos por custo</h4>
        <div className="space-y-2">
          {(metrics.byVehicle || []).slice(0,5).map((v:any, idx:number) => (
            <div key={idx} className="flex justify-between text-sm">
              <div>{v.plate || v.veiculo_placa}</div>
              <div>R$ {(v.totalCost || (v.valor||0)).toLocaleString("pt-BR")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FleetMetricsCard;

