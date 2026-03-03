import { Brain, Sparkles, TrendingDown, Zap, BarChart3, AlertTriangle } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle } from "@/types/fleet";
import { FuelEntry } from "@/types/fleet";
import { MaintenanceOrder } from "@/types/fleet";
import { demoVehicles } from "@/data/demoData";
import { demoFuelEntries } from "@/data/demoData";
import { demoMaintenanceOrders } from "@/data/demoData";
import { useCallback, useState } from "react";
import { API_URL } from "@/lib/api";

const AiInsights = () => {
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: fuel } = useStore<FuelEntry>("fuel", demoFuelEntries);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", demoMaintenanceOrders);

  const avgConsumo = fuel.length > 0 ? (fuel.reduce((s, f) => s + f.consumo, 0) / fuel.length).toFixed(1) : "0";
  const totalCustoManut = maintenance.reduce((s, m) => s + m.custo, 0);
  const parados = vehicles.filter(v => v.status === "parado").length;
  const osUrgentes = maintenance.filter(m => m.prioridade === "urgente" && m.status !== "concluida").length;

  const insights = [
    { icon: TrendingDown, title: "Oportunidade de economia", desc: `Consumo médio da frota: ${avgConsumo} km/l. Veículos abaixo de 3.5 km/l devem ser investigados para possíveis problemas mecânicos ou de condução.`, impact: "Economia potencial de 8-15%", color: "text-primary" },
    { icon: Zap, title: "Manutenção preditiva", desc: `${osUrgentes} OS urgente(s) pendente(s). Veículos com alta quilometragem devem priorizar revisões preventivas para evitar paradas não programadas.`, impact: `Evitar custos de até R$ ${(totalCustoManut * 0.3 / 1000).toFixed(0)}k`, color: "text-primary" },
    { icon: Sparkles, title: "Otimização de frota", desc: `${parados} veículo(s) parado(s). Avaliar remanejamento, venda ou locação para reduzir custos fixos de manutenção e seguro.`, impact: `~R$ ${(parados * 2500 / 1000).toFixed(1)}k/mês em economia`, color: "text-primary" },
    { icon: BarChart3, title: "Análise de custos", desc: `Custo total em manutenção: R$ ${totalCustoManut.toLocaleString("pt-BR")}. Manutenções corretivas representam a maior fatia. Investir em preventivas reduz custos a longo prazo.`, impact: "Redução de 20-30% em corretivas", color: "text-primary" },
    { icon: AlertTriangle, title: "Alertas operacionais", desc: `Monitoramento contínuo de ${vehicles.length} veículos. Sistema detecta automaticamente anomalias de consumo, atrasos de manutenção e vencimentos.`, impact: "Prevenção de falhas", color: "text-primary" },
  ];

  // Chat / Agent state
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const send = useCallback(
    async (prompt?: string) => {
      const text = (prompt ?? input).trim();
      if (!text) return;
      const userMsg = { role: "user" as const, text };
      setChatMessages((s) => [...s, userMsg]);
      setInput("");
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
          body: JSON.stringify({ prompt: text, includeData: true }),
        });
        const j = await res.json();
        const assistant = j?.data?.assistant || j?.assistant || (j?.raw?.choices?.[0]?.message?.content ?? "Desculpe, sem resposta.");
        if (j?.data?.metrics) setMetrics(j.data.metrics);
        const assistantMsg = { role: "assistant" as const, text: String(assistant) };
        setChatMessages((s) => [...s, assistantMsg]);
      } catch (e) {
        setChatMessages((s) => [...s, { role: "assistant", text: "Erro ao consultar o serviço de Insights." }]);
      } finally {
        setLoading(false);
      }
    },
    [input]
  );

  const runAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditReport(null);
    try {
      const headers: Record<string,string> = { "Content-Type": "application/json" };
      const token = localStorage.getItem("fleet_auth_token");
      const tenantId = localStorage.getItem("fleet_tenant_id");
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (!token && tenantId) headers["X-Tenant-Id"] = tenantId;

      const res = await fetch(`${API_URL}/api/insights`, {
        method: "POST",
        headers,
        body: JSON.stringify({ audit: true }),
      });
      const j = await res.json();
      if (j?.data?.auditReport) {
        setAuditReport(j.data.auditReport);
        // also set metrics if present
        if (j.data.metrics) setMetrics(j.data.metrics);
      } else {
        setAuditReport({ error: "Relatório de auditoria não disponível" });
      }
    } catch (e) {
      setAuditReport({ error: String(e) });
    } finally {
      setAuditLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">IA & Insights</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Análise inteligente automática da frota</p>
      </div>

      <div className="glass-card p-4 sm:p-5 glow-amber">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Resumo Inteligente</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={runAudit}
            disabled={auditLoading}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {auditLoading ? "Executando..." : "Revisar tudo"}
          </button>
          <button
            onClick={() => send("Me mostre custos por veículo nos últimos 90 dias")}
            className="px-3 py-1.5 rounded-lg border border-border text-xs sm:text-sm text-foreground hover:bg-muted transition-colors"
          >Custos 90 dias</button>
          <button
            onClick={() => send("Onde posso reduzir gastos?")}
            className="px-3 py-1.5 rounded-lg border border-border text-xs sm:text-sm text-foreground hover:bg-muted transition-colors"
          >Onde reduzir gastos</button>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Sua frota possui <span className="text-foreground font-medium">{vehicles.length} veículos</span>, dos quais <span className="text-success font-medium">{vehicles.filter(v => v.status === "operando").length} em operação</span>, <span className="text-warning font-medium">{vehicles.filter(v => v.status === "manutencao").length} em manutenção</span> e <span className="text-destructive font-medium">{parados} parado(s)</span>. O consumo médio é de <span className="text-foreground font-medium">{avgConsumo} km/l</span> com custo total em manutenção de <span className="text-foreground font-medium">R$ {totalCustoManut.toLocaleString("pt-BR")}</span>.
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {insights.map((insight, i) => (
          <div key={i} className="glass-card p-4 sm:p-5 hover:border-primary/20 transition-all animate-slide-in" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <insight.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-1">{insight.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{insight.desc}</p>
                <span className="inline-block mt-2 text-xs font-mono font-medium text-primary bg-primary/10 px-2 sm:px-3 py-1 rounded-full">{insight.impact}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {metrics && (
        <div className="glass-card p-4 sm:p-5 mt-4">
          <h2 className="text-sm font-semibold mb-2">Resumo de Métricas (agregado)</h2>
          <div className="text-sm text-muted-foreground mb-2">
            <div>Período: últimos {metrics?.monthly?.expenses?.length ? metrics?.monthly?.expenses[0]?.ym : "últimos 90 dias"}</div>
            <div>Total despesas: R$ {Number(metrics.totalExpenses || 0).toLocaleString("pt-BR")}</div>
            <div>Total combustível: R$ {Number(metrics.totalFuel || 0).toLocaleString("pt-BR")}</div>
            <div>Total manutenção: R$ {Number(metrics.totalMaint || 0).toLocaleString("pt-BR")}</div>
            <div>Veículos cadastrados: <span className="font-medium">{metrics.totalVehicles ?? 0}</span></div>
            <div>Motoristas cadastrados: <span className="font-medium">{metrics.totalDrivers ?? 0}</span></div>
          </div>
          <h3 className="text-xs font-medium mb-2">Top veículos por custo</h3>
          <div className="space-y-2">
            {(metrics.byVehicle || []).slice(0, 5).map((v: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <div>{v.plate}</div>
                <div>R$ {Number(v.totalCost || 0).toLocaleString("pt-BR")}{v.costPerKm ? ` • R$/km ${v.costPerKm.toFixed(2)}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    {auditReport && (
      <div className="glass-card p-4 sm:p-5 mt-4">
        <h3 className="text-sm font-semibold mb-2">Relatório de Auditoria</h3>
        {auditReport.error ? (
          <div className="text-sm text-destructive">{auditReport.error}</div>
        ) : (
          <>
            <div className="text-sm mb-2">
              <div>Registros: fuel_entries={auditReport.counts?.fuel_entries ?? 0} • expenses={auditReport.counts?.expenses ?? 0} • maintenance={auditReport.counts?.maintenance_orders ?? 0} • receitas={auditReport.counts?.receitas ?? 0}</div>
              <div>Veículos cadastrados: {auditReport.totalVehicles ?? 0} • Motoristas cadastrados: {auditReport.totalDrivers ?? 0}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium mb-1">Amostra de Veículos</h4>
                <div className="text-xs">
                  {(auditReport.samples?.vehicles || []).map((v: any) => (
                    <div key={v.id} className="py-1 border-b border-border">
                      <div className="font-medium">{v.placa} — {v.modelo}</div>
                      <div className="text-muted-foreground">{v.status}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium mb-1">Amostra de Motoristas</h4>
                <div className="text-xs">
                  {(auditReport.samples?.drivers || []).map((d: any) => (
                    <div key={d.id} className="py-1 border-b border-border">
                      <div className="font-medium">{d.nome}</div>
                      <div className="text-muted-foreground">{d.cpf} • {d.telefone || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )}

    <div className="glass-card p-4 sm:p-5 mt-4">
      <h2 className="text-sm font-semibold mb-3 text-foreground">Converse com o agente</h2>
      <div className="border border-border rounded-lg p-3 max-h-60 overflow-auto bg-background/50 mb-3">
        {chatMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground">Peça algo como "Me mostre custos por veículo nos últimos 3 meses" ou "Onde posso reduzir gastos?"</p>
        ) : (
          chatMessages.map((m, idx) => (
            <div key={idx} className={`mb-2 ${m.role === "user" ? "text-right" : "text-left"}`}>
              <div className={`inline-block px-3 py-2 rounded-lg text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 items-end">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          placeholder="Pergunte algo sobre custos, manutenção ou economia..."
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
        >{loading ? "..." : "Enviar"}</button>
      </div>
    </div>

    </div>
  );
};

export default AiInsights;
