import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import useStore from "@/hooks/useStore";
import { FuelEntry, MaintenanceOrder, Expense } from "@/types/fleet";

const CostChart = () => {
  const { items: fuel } = useStore<FuelEntry>("fuel", []);
  const { items: maintenance } = useStore<MaintenanceOrder>("maintenance", []);
  const { items: expenses } = useStore<Expense>("expenses", []);

  const hasData = fuel.length > 0 || maintenance.length > 0 || expenses.length > 0;

  const totalComb = fuel.reduce((s, f) => s + f.valor, 0);
  const totalManut = maintenance.reduce((s, m) => s + m.custo, 0);
  const totalDesp = expenses.reduce((s, e) => s + e.valor, 0);

  const data = [
    { name: "Combustível", valor: totalComb },
    { name: "Manutenção", valor: totalManut },
    { name: "Despesas", valor: totalDesp },
  ];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Custos Operacionais</h3>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-primary" /><span className="text-muted-foreground">Combustível</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-info" /><span className="text-muted-foreground">Manutenção</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-success" /><span className="text-muted-foreground">Despesas</span></div>
        </div>
      </div>
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum custo registrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Registre abastecimentos, manutenções ou despesas para ver o gráfico</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 14%)" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: "8px", color: "hsl(210 40% 93%)", fontSize: "12px" }} formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]} />
            <Bar dataKey="valor" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default CostChart;
