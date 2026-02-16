import { useState } from "react";
import { CircleDot, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Tire, Vehicle } from "@/types/fleet";
import { demoTires, demoVehicles } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import KpiCard from "@/components/dashboard/KpiCard";

const statusConfig: Record<string, { label: string; className: string }> = {
  novo: { label: "Novo", className: "text-success bg-success/10" },
  em_uso: { label: "Em Uso", className: "text-info bg-info/10" },
  recapado: { label: "Recapado", className: "text-warning bg-warning/10" },
  descartado: { label: "Descartado", className: "text-muted-foreground bg-muted" },
};

const emptyForm: Omit<Tire, "id"> = {
  codigo: "", marca: "", modelo: "", medida: "295/80R22.5", dot: "", status: "novo", posicao: "—", veiculoPlaca: "—", kmInstalacao: 0, kmAtual: 0, sulco: 16, reformas: 0,
};

const Pneus = () => {
  const { items, add, update, remove } = useStore<Tire>("tires", demoTires);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tire | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = items.filter(t => t.codigo.toLowerCase().includes(search.toLowerCase()) || t.marca.toLowerCase().includes(search.toLowerCase()) || t.veiculoPlaca.toLowerCase().includes(search.toLowerCase()));
  const emUso = items.filter(t => t.status === "em_uso").length;
  const estoque = items.filter(t => t.status === "novo" || t.status === "recapado").length;
  const mediaSulco = items.filter(t => t.status === "em_uso").length > 0 ? (items.filter(t => t.status === "em_uso").reduce((s, t) => s + t.sulco, 0) / items.filter(t => t.status === "em_uso").length).toFixed(1) : "0";

  const handleSave = () => {
    if (!form.codigo || !form.marca) { toast({ title: "Preencha código e marca", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Pneu atualizado!" }); }
    else { add(form); toast({ title: "Pneu cadastrado!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (t: Tire) => { setEditing(t); setForm(t); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Pneu removido!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        veiculoPlaca: vehicle.placa,
      }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Pneus</h1><p className="text-sm text-muted-foreground mt-1">{items.length} pneus cadastrados</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><Plus className="w-4 h-4" />Novo Pneu</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={CircleDot} title="Em Uso" value={String(emUso)} variant="info" />
        <KpiCard icon={CircleDot} title="Em Estoque" value={String(estoque)} variant="success" />
        <KpiCard icon={CircleDot} title="Sulco Médio" value={`${mediaSulco} mm`} variant="warning" />
      </div>

      <input type="text" placeholder="Buscar pneu..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm w-full bg-muted/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border">{["Código", "Marca/Modelo", "Medida", "Status", "Veículo", "Posição", "Sulco", "Reformas", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((t, i) => {
              // Garante status válido mesmo com dados antigos/da API
              const safeStatus = t.status && statusConfig[t.status] ? t.status : "novo";
              const sc = statusConfig[safeStatus];
              return (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-primary">{t.codigo}</td>
                  <td className="px-5 py-3.5"><p className="text-sm text-foreground">{t.marca}</p><p className="text-xs text-muted-foreground">{t.modelo}</p></td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{t.medida}</td>
                  <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.className}`}>{sc.label}</span></td>
                  <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{t.veiculoPlaca}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{t.posicao}</td>
                  <td className="px-5 py-3.5"><span className={`text-sm font-mono font-medium ${t.sulco <= 4 ? "text-destructive" : t.sulco <= 8 ? "text-warning" : "text-success"}`}>{t.sulco}mm</span></td>
                  <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{t.reformas}</td>
                  <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(t)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">Nenhum pneu</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Editar Pneu" : "Novo Pneu"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selecionar Veículo</label>
              <select value={vehicles.find(v => v.placa === form.veiculoPlaca)?.id || ""} onChange={(e) => e.target.value && handleVehicleSelect(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">Selecione um veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                ))}
              </select>
            </div>
            {[
              { label: "Código", key: "codigo", placeholder: "PN-001" },
              { label: "Marca", key: "marca", placeholder: "Bridgestone" },
              { label: "Modelo", key: "modelo", placeholder: "R268" },
              { label: "Medida", key: "medida", placeholder: "295/80R22.5" },
              { label: "DOT", key: "dot", placeholder: "2024" },
              { label: "Posição", key: "posicao", placeholder: "DE-1" },
              { label: "Veículo", key: "veiculoPlaca", placeholder: "ABC-1234" },
              { label: "Sulco (mm)", key: "sulco", type: "number" },
              { label: "Reformas", key: "reformas", type: "number" },
              { label: "KM Instalação", key: "kmInstalacao", type: "number" },
            ].map(f => (
              <div key={f.key}><label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={e => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            ))}
            <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="novo">Novo</option><option value="em_uso">Em Uso</option><option value="recapado">Recapado</option><option value="descartado">Descartado</option>
              </select></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm"><DialogHeader><DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir este pneu?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pneus;
