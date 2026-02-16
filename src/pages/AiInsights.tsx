import { Brain, Sparkles, TrendingDown, Zap, BarChart3, AlertTriangle } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle } from "@/types/fleet";
import { FuelEntry } from "@/types/fleet";
import { MaintenanceOrder } from "@/types/fleet";
import { demoVehicles } from "@/data/demoData";
import { demoFuelEntries } from "@/data/demoData";
import { demoMaintenanceOrders } from "@/data/demoData";

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
    </div>
  );
};

export default AiInsights;
