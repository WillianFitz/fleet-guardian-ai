import { Truck, Fuel, Wrench, DollarSign, Users, TrendingUp, Activity, Clock, CircleDot, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import KpiCard from "@/components/dashboard/KpiCard";
import useStore from "@/hooks/useStore";
import { Vehicle, FuelEntry, MaintenanceOrder, Driver, Tire, Expense } from "@/types/fleet";
import { demoVehicles, demoFuelEntries, demoMaintenanceOrders, demoDrivers, demoTires, demoExpenses } from "@/data/demoData";

const Kpis = () => {
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: fuel } = useStore<FuelEntry>("fuel", demoFuelEntries);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", demoMaintenanceOrders);
  const { items: drivers } = useStore<Driver>("drivers", demoDrivers);
  const { items: tires } = useStore<Tire>("tires", demoTires);
  const { items: expenses } = useStore<Expense>("expenses", demoExpenses);

  const operando = vehicles.filter(v => v.status === "operando").length;
  const disponibilidade = vehicles.length > 0 ? ((operando / vehicles.length) * 100).toFixed(1) : "0";
  const avgConsumo = fuel.length > 0 ? (fuel.reduce((s, f) => s + f.consumo, 0) / fuel.length).toFixed(1) : "0";
  const totalKm = vehicles.reduce((s, v) => s + v.km, 0);
  const totalCustoManut = maintenance.reduce((s, m) => s + m.custo, 0);
  const totalCustoComb = fuel.reduce((s, f) => s + f.valor, 0);
  const totalDespesas = expenses.reduce((s, e) => s + e.valor, 0);
  const custoTotal = totalCustoManut + totalCustoComb + totalDespesas;
  const custoKm = totalKm > 0 ? (custoTotal / (totalKm / 1000)).toFixed(2) : "0";

  const custoData = [
    { name: "Combustível", value: totalCustoComb, color: "hsl(38 92% 50%)" },
    { name: "Manutenção", value: totalCustoManut, color: "hsl(199 89% 48%)" },
    { name: "Despesas", value: totalDespesas, color: "hsl(142 71% 45%)" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">KPIs da Frota</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Indicadores-chave de desempenho</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Truck} title="Veículos Ativos" value={`${operando}/${vehicles.length}`} variant="default" />
        <KpiCard icon={TrendingUp} title="Disponibilidade" value={`${disponibilidade}%`} variant="success" />
        <KpiCard icon={Activity} title="Consumo Médio" value={`${avgConsumo} km/l`} variant="info" />
        <KpiCard icon={DollarSign} title="Custo/km" value={`R$ ${custoKm}`} variant="warning" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} title="Motoristas Ativos" value={String(drivers.filter(d => d.status === "ativo").length)} variant="default" />
        <KpiCard icon={Wrench} title="OS Abertas" value={String(maintenance.filter(m => m.status !== "concluida" && m.status !== "cancelada").length)} variant="warning" />
        <KpiCard icon={CircleDot} title="Pneus em Uso" value={String(tires.filter(t => t.status === "em_uso").length)} variant="info" />
        <KpiCard icon={AlertTriangle} title="Alertas" value={String(maintenance.filter(m => m.prioridade === "urgente").length)} variant="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4">Distribuição de Custos</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="w-32 h-32 sm:w-40 sm:h-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={custoData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {custoData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold font-mono text-foreground">R$ {(custoTotal/1000).toFixed(0)}k</span>
                <span className="text-[10px] text-muted-foreground">total</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {custoData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-xs text-muted-foreground">{item.name}</span></div>
                  <span className="text-sm font-mono font-medium text-foreground">R$ {(item.value/1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-4">Resumo Operacional</h3>
          <div className="space-y-3">
            {[
              { label: "KM Total da Frota", value: `${(totalKm/1000).toFixed(0)}k km` },
              { label: "Litros Abastecidos", value: `${fuel.reduce((s, f) => s + f.litros, 0).toLocaleString("pt-BR")} L` },
              { label: "OS Concluídas", value: String(maintenance.filter(m => m.status === "concluida").length) },
              { label: "Pneus em Estoque", value: String(tires.filter(t => t.status === "novo" || t.status === "recapado").length) },
              { label: "Motoristas em Operação", value: String(drivers.filter(d => d.status === "ativo").length) },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-mono font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kpis;
