import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Truck } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Vehicle } from "@/types/fleet";

const FleetStatusChart = () => {
  const { items: vehicles } = useStore<Vehicle>("vehicles", []);

  const statusData = [
    { name: "Operando", value: vehicles.filter(v => v.status === "operando").length, color: "hsl(142 71% 45%)" },
    { name: "Manutenção", value: vehicles.filter(v => v.status === "manutencao").length, color: "hsl(38 92% 50%)" },
    { name: "Parados", value: vehicles.filter(v => v.status === "parado").length, color: "hsl(0 72% 51%)" },
    { name: "Vendidos", value: vehicles.filter(v => v.status === "vendido").length, color: "hsl(215 20% 55%)" },
  ].filter(d => d.value > 0);

  const total = vehicles.length;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Status da Frota</h3>
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Truck className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Cadastre veículos para ver o gráfico de status</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="w-40 h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {statusData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: "8px", color: "hsl(210 40% 93%)", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono text-foreground">{total}</span>
              <span className="text-[10px] text-muted-foreground">veículos</span>
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-xs text-muted-foreground">{item.name}</span></div>
                <span className="text-sm font-mono font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetStatusChart;
