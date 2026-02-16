import { AlertTriangle, Bell } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle, Driver, MaintenanceOrder, License, Tire } from "@/types/fleet";

const AlertsList = () => {
  const { items: vehicles } = useStore<Vehicle>("vehicles", []);
  const { items: drivers } = useStore<Driver>("drivers", []);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", []);
  const { items: licenses } = useStore<License>("licenses", []);
  const { items: tires } = useStore<Tire>("tires", []);

  const today = new Date();
  const alerts: { title: string; desc: string; variant: "destructive" | "warning" }[] = [];

  // OS urgentes
  maintenance.filter(m => m.prioridade === "urgente" && m.status !== "concluida").forEach(m => {
    alerts.push({ title: "OS Urgente pendente", desc: `${m.veiculoPlaca} — ${m.descricao}`, variant: "destructive" });
  });

  // CNH próxima do vencimento
  drivers.forEach(d => {
    const diff = (new Date(d.vencimentoCnh).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 30 && diff > 0) alerts.push({ title: "CNH próxima do vencimento", desc: `${d.nome} — vence em ${Math.ceil(diff)} dias`, variant: "warning" });
    if (diff <= 0) alerts.push({ title: "CNH vencida", desc: `${d.nome}`, variant: "destructive" });
  });

  // Licenças vencidas
  licenses.filter(l => l.status === "vencido").forEach(l => {
    alerts.push({ title: "Licença vencida", desc: `${l.veiculoPlaca} — ${l.tipo.toUpperCase()}`, variant: "destructive" });
  });

  // Pneus com sulco crítico
  tires.filter(t => t.status === "em_uso" && t.sulco <= 4).forEach(t => {
    alerts.push({ title: "Pneu com desgaste crítico", desc: `${t.codigo} — ${t.veiculoPlaca} (${t.sulco}mm)`, variant: "destructive" });
  });

  // Veículos parados
  const parados = vehicles.filter(v => v.status === "parado").length;
  if (parados > 0) alerts.push({ title: "Veículos parados", desc: `${parados} veículo(s) sem operação`, variant: "warning" });

  const variantStyles = {
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Alertas Recentes</h3>
        {alerts.length > 0 && (
          <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-medium">{alerts.length} pendentes</span>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Bell className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum alerta</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Os alertas são gerados automaticamente com base nos seus cadastros</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.slice(0, 5).map((alert, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${variantStyles[alert.variant]} animate-slide-in`} style={{ animationDelay: `${i * 80}ms` }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsList;
