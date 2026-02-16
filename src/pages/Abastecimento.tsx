import { useState } from "react";
import { Fuel, TrendingDown, TrendingUp, BarChart3, Plus, Edit, Trash2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import KpiCard from "@/components/dashboard/KpiCard";
import useStore from "@/hooks/useStore";
import { FuelEntry, Vehicle, Driver } from "@/types/fleet";
import { demoFuelEntries, demoVehicles, demoDrivers } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";

const emptyForm: Omit<FuelEntry, "id"> = {
  veiculoPlaca: "", motorista: "", data: new Date().toISOString().split("T")[0], litros: 0, valor: 0, kmAtual: 0, kmAnterior: 0, consumo: 0, posto: "", tipoCombustivel: "Diesel S10",
};

const Abastecimento = () => {
  const { items, add, update, remove } = useStore<FuelEntry>("fuel", demoFuelEntries);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: drivers } = useStore<Driver>("drivers", demoDrivers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FuelEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalLitros = items.reduce((s, e) => s + e.litros, 0);
  const totalValor = items.reduce((s, e) => s + e.valor, 0);
  const mediaConsumo = items.length > 0 ? (items.reduce((s, e) => s + e.consumo, 0) / items.length).toFixed(1) : "0";
  const precoMedio = totalLitros > 0 ? (totalValor / totalLitros).toFixed(2) : "0";

  const chartData = items.map(e => ({ dia: e.data.slice(8, 10), consumo: e.consumo })).reverse();

  const handleSave = () => {
    if (!form.veiculoPlaca) { toast({ title: "Preencha a placa", variant: "destructive" }); return; }
    const consumoCalc = form.kmAtual > form.kmAnterior && form.litros > 0 ? Number(((form.kmAtual - form.kmAnterior) / form.litros).toFixed(1)) : form.consumo;
    const data = { ...form, consumo: consumoCalc };
    if (editing) { update(editing.id, data); toast({ title: "Abastecimento atualizado!" }); }
    else { add(data); toast({ title: "Abastecimento registrado!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (e: FuelEntry) => { setEditing(e); setForm(e); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Registro removido!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        veiculoPlaca: vehicle.placa,
        motorista: vehicle.motorista ? drivers.find(d => d.id === vehicle.motorista)?.nome || "" : "",
        tipoCombustivel: vehicle.combustivel || prev.tipoCombustivel,
        kmAtual: vehicle.km || prev.kmAtual,
      }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Abastecimento</h1><p className="text-sm text-muted-foreground mt-1">Controle de combustível e consumo</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><Plus className="w-4 h-4" />Novo Abastecimento</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Fuel} title="Total Abastecido" value={`${totalLitros.toLocaleString("pt-BR")} L`} variant="default" />
        <KpiCard icon={TrendingDown} title="Custo Total" value={`R$ ${(totalValor/1000).toFixed(1)}k`} variant="warning" />
        <KpiCard icon={TrendingUp} title="Consumo Médio" value={`${mediaConsumo} km/l`} variant="success" />
        <KpiCard icon={BarChart3} title="Preço Médio/L" value={`R$ ${precoMedio}`} variant="info" />
      </div>

      {chartData.length > 1 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Consumo (km/l)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 14%)" vertical={false} />
              <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222 47% 10%)", border: "1px solid hsl(217 33% 17%)", borderRadius: "8px", color: "hsl(210 40% 93%)", fontSize: "12px" }} />
              <Area type="monotone" dataKey="consumo" stroke="hsl(38 92% 50%)" fill="url(#cg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Registros de Abastecimento</h3></div>
        <table className="w-full">
          <thead><tr className="border-b border-border">{["Veículo", "Motorista", "Litros", "Valor", "km/l", "Posto", "Data", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 text-sm font-mono text-foreground">{a.veiculoPlaca}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{a.motorista}</td>
                <td className="px-5 py-3 text-sm font-mono text-foreground">{a.litros}L</td>
                <td className="px-5 py-3 text-sm font-mono text-foreground">R$ {a.valor.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3"><span className={`text-sm font-mono font-medium ${a.consumo >= 4.0 ? "text-success" : a.consumo >= 3.7 ? "text-foreground" : "text-warning"}`}>{a.consumo}</span></td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{a.posto}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{a.data}</td>
                <td className="px-5 py-3"><div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(a)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(a.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Nenhum registro</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Editar" : "Novo Abastecimento"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selecionar Veículo</label>
              <select value="" onChange={(e) => e.target.value && handleVehicleSelect(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">Selecione um veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                ))}
              </select>
            </div>
            {[
              { label: "Placa", key: "veiculoPlaca", placeholder: "ABC-1234" },
              { label: "Motorista", key: "motorista", placeholder: "Nome" },
              { label: "Litros", key: "litros", type: "number" },
              { label: "Valor (R$)", key: "valor", type: "number" },
              { label: "KM Atual", key: "kmAtual", type: "number" },
              { label: "KM Anterior", key: "kmAnterior", type: "number" },
              { label: "Posto", key: "posto", placeholder: "Nome do posto" },
              { label: "Tipo Combustível", key: "tipoCombustivel", placeholder: "Diesel S10" },
              { label: "Data", key: "data", type: "date" },
            ].map(f => (
              <div key={f.key}><label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={e => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir este registro de abastecimento?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Abastecimento;
