import { Brain, Sparkles } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle, FuelEntry, MaintenanceOrder } from "@/types/fleet";

const AiInsightCard = () => {
  const { items: vehicles } = useStore<Vehicle>("vehicles", []);
  const { items: fuel } = useStore<FuelEntry>("fuel", []);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", []);

  const hasData = vehicles.length > 0 || fuel.length > 0 || maintenance.length > 0;

  return (
    <div className="glass-card p-5 glow-amber">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Insights da IA</h3>
          <p className="text-[10px] text-muted-foreground">Análise automática dos dados cadastrados</p>
        </div>
      </div>
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum dado cadastrado ainda</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Cadastre veículos, abastecimentos e manutenções para gerar insights automáticos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Status da frota</p>
                <p className="text-xs text-muted-foreground mt-0.5">{vehicles.filter(v => v.status === "operando").length} de {vehicles.length} veículos operando. {vehicles.filter(v => v.status === "parado").length > 0 ? `${vehicles.filter(v => v.status === "parado").length} parado(s) — avaliar remanejamento.` : "Todos ativos."}</p>
              </div>
            </div>
          )}
          {fuel.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Consumo de combustível</p>
                <p className="text-xs text-muted-foreground mt-0.5">Consumo médio: {(fuel.reduce((s, f) => s + f.consumo, 0) / fuel.length).toFixed(1)} km/l em {fuel.length} abastecimento(s).</p>
              </div>
            </div>
          )}
          {maintenance.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Manutenção</p>
                <p className="text-xs text-muted-foreground mt-0.5">{maintenance.filter(m => m.status !== "concluida").length} OS pendente(s). Custo total: R$ {maintenance.reduce((s, m) => s + m.custo, 0).toLocaleString("pt-BR")}.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiInsightCard;
