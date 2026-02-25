import { Truck, Fuel, Wrench, DollarSign, Users, TrendingUp, Activity, Clock } from "lucide-react";
import { useEffect } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import FleetStatusChart from "@/components/dashboard/FleetStatusChart";
import CostChart from "@/components/dashboard/CostChart";
import AlertsList from "@/components/dashboard/AlertsList";
import AiInsightCard from "@/components/dashboard/AiInsightCard";
import useStore from "@/hooks/useStore";
import { Vehicle, FuelEntry, MaintenanceOrder, Driver } from "@/types/fleet";
import FleetMetricsCard from "@/components/dashboard/FleetMetricsCard";

const Index = () => {
  useEffect(() => {
    // Frontend build-bump log to trigger redeploy visibility
    try {
      // eslint-disable-next-line no-console
    // build-bump trigger removed for cleaner logs
    } catch {}
  }, []);
  const { items: vehicles } = useStore<Vehicle>("vehicles", []);
  const { items: fuel } = useStore<FuelEntry>("fuel", []);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", []);
  const { items: drivers } = useStore<Driver>("drivers", []);

  const operando = vehicles.filter(v => v.status === "operando").length;
  const totalCustoComb = fuel.reduce((s, f) => s + f.valor, 0);
  const osAbertas = maintenance.filter(m => m.status === "aberta" || m.status === "em_andamento").length;
  const osUrgentes = maintenance.filter(m => m.prioridade === "urgente" && m.status !== "concluida").length;
  const avgConsumo = fuel.length > 0 ? (fuel.reduce((s, f) => s + f.consumo, 0) / fuel.length).toFixed(1) : "0";
  const disponibilidade = vehicles.length > 0 ? ((operando / vehicles.length) * 100).toFixed(1) : "0";
  const motoristasAtivos = drivers.filter(d => d.status === "ativo").length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Visão geral da frota • {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Truck} title="Veículos Ativos" value={String(operando)} subtitle={`de ${vehicles.length} cadastrados`} variant="default" />
        <KpiCard icon={Fuel} title="Custo Combustível" value={`R$ ${(totalCustoComb / 1000).toFixed(1)}k`} subtitle="este mês" variant="success" />
        <KpiCard icon={Wrench} title="OS Abertas" value={String(osAbertas)} subtitle={`${osUrgentes} urgentes`} variant="warning" />
        <KpiCard icon={DollarSign} title="Consumo Médio" value={`${avgConsumo} km/l`} subtitle="média da frota" variant="info" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} title="Motoristas" value={String(drivers.length)} subtitle={`${motoristasAtivos} em operação`} variant="default" />
        <KpiCard icon={TrendingUp} title="Disponibilidade" value={`${disponibilidade}%`} subtitle="meta: 95%" variant="success" />
        <KpiCard icon={Activity} title="Total Abastecido" value={`${fuel.reduce((s, f) => s + f.litros, 0).toLocaleString("pt-BR")} L`} subtitle="últimos registros" variant="info" />
        <KpiCard icon={Clock} title="Veículos Parados" value={String(vehicles.filter(v => v.status === "parado").length)} subtitle="sem operação" variant={vehicles.filter(v => v.status === "parado").length > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CostChart />
        <FleetStatusChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AlertsList />
        <AiInsightCard />
        <FleetMetricsCard />
      </div>
    </div>
  );
};

export default Index;
