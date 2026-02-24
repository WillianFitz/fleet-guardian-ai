import { Brain, Sparkles, TrendingDown, Zap, BarChart3, AlertTriangle } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle } from "@/types/fleet";
import { FuelEntry } from "@/types/fleet";
import { MaintenanceOrder } from "@/types/fleet";
import { demoVehicles } from "@/data/demoData";
import { demoFuelEntries } from "@/data/demoData";
import { demoMaintenanceOrders } from "@/data/demoData";
import { useCallback, useState } from "react";

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

  const send = useCallback(
    async (prompt?: string) => {
      const text = (prompt ?? input).trim();
      if (!text) return;
      const userMsg = { role: "user" as const, text };
      setChatMessages((s) => [...s, userMsg]);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, includeData: true }),
        });
        const j = await res.json();
        const assistant = j?.data?.assistant || j?.assistant || (j?.raw?.choices?.[0]?.message?.content ?? "Desculpe, sem resposta.");
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

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">IA & Insights</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Análise inteligente automática da frota</p>
      </div>

      <div className="glass-card p-4 sm:p-5 glow-amber">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Resumo Inteligente</h2>
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

    <div className="glass-card p-4 sm:p-5 mt-4">
      <h2 className="text-sm font-semibold mb-2">Converse com o agente</h2>
      <div className="border rounded-md p-3 max-h-60 overflow-auto bg-background/50 mb-3">
        {chatMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground">Peça algo como "Me mostre custos por veículo nos últimos 3 meses" ou "Onde posso reduzir gastos?"</p>
        ) : (
          chatMessages.map((m, idx) => (
            <div key={idx} className={`mb-2 ${m.role === "user" ? "text-right" : "text-left"}`}>
              <div className={`inline-block px-3 py-2 rounded-md ${m.role === "user" ? "bg-primary/10 text-foreground" : "bg-muted-foreground/5 text-foreground"}`}>
                <div className="whitespace-pre-wrap text-sm">{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          className="flex-1 input w-full"
          placeholder="Pergunte algo sobre custos, manutenção ou economia..."
        />
        <button className="btn" onClick={() => send()} disabled={loading}>{loading ? "..." : "Enviar"}</button>
      </div>
    </div>

    </div>
  );
};

export default AiInsights;
