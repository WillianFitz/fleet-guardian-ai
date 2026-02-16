import { useState } from "react";
import { AlertTriangle, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Incident, Vehicle, Driver } from "@/types/fleet";
import { demoIncidents, demoVehicles, demoDrivers } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import KpiCard from "@/components/dashboard/KpiCard";

const tipoStyles: Record<string, string> = { multa: "text-warning bg-warning/10", acidente: "text-destructive bg-destructive/10", avaria: "text-info bg-info/10", sinistro: "text-destructive bg-destructive/10" };
const statusStyles: Record<string, string> = { aberto: "text-warning bg-warning/10", em_recurso: "text-info bg-info/10", pago: "text-success bg-success/10", resolvido: "text-success bg-success/10" };

const emptyForm: Omit<Incident, "id"> = {
  tipo: "multa", data: new Date().toISOString().split("T")[0], veiculoPlaca: "", motorista: "", descricao: "", valor: 0, status: "aberto", local: "", pontosCnh: 0,
};

const Ocorrencias = () => {
  const { items, add, update, remove } = useStore<Incident>("incidents", demoIncidents);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: drivers } = useStore<Driver>("drivers", demoDrivers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalValor = items.reduce((s, i) => s + i.valor, 0);
  const abertos = items.filter(i => i.status === "aberto" || i.status === "em_recurso").length;

  const handleSave = () => {
    if (!form.descricao) { toast({ title: "Preencha a descrição", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Ocorrência atualizada!" }); }
    else { add(form); toast({ title: "Ocorrência registrada!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (i: Incident) => { setEditing(i); setForm(i); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Ocorrência removida!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        veiculoPlaca: vehicle.placa,
        motorista: vehicle.motorista ? drivers.find(d => d.id === vehicle.motorista)?.nome || "" : "",
      }));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Ocorrências</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Multas, acidentes e avarias</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"><Plus className="w-4 h-4" />Nova Ocorrência</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={AlertTriangle} title="Total Ocorrências" value={String(items.length)} variant="default" />
        <KpiCard icon={AlertTriangle} title="Em Aberto" value={String(abertos)} variant={abertos > 0 ? "warning" : "success"} />
        <KpiCard icon={AlertTriangle} title="Custo Total" value={`R$ ${(totalValor/1000).toFixed(1)}k`} variant="destructive" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-border">{["Tipo", "Data", "Veículo", "Motorista", "Descrição", "Valor", "Pontos", "Status", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3">{h}</th>)}</tr></thead>
          <tbody>
            {items.map(i => {
              const safeTipo = i.tipo && tipoStyles[i.tipo] ? i.tipo : "multa";
              const tipoCls = tipoStyles[safeTipo];
              const safeStatus = i.status && statusStyles[i.status] ? i.status : "aberto";
              const statusCls = statusStyles[safeStatus];
              return (
              <tr key={i.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${tipoCls}`}>{safeTipo}</span></td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{i.data}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-foreground">{i.veiculoPlaca}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{i.motorista}</td>
                <td className="px-5 py-3.5 text-sm text-foreground max-w-xs truncate">{i.descricao}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-foreground">R$ {i.valor.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{i.pontosCnh || "—"}</td>
                <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusCls}`}>{safeStatus.replace("_", " ")}</span></td>
                <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(i)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(i.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div></td>
              </tr>
            )})}
            {items.length === 0 && <tr><td colSpan={9} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">Nenhuma ocorrência</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4">
          <DialogHeader><DialogTitle className="text-sm sm:text-base text-foreground">{editing ? "Editar" : "Nova Ocorrência"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selecionar Veículo</label>
              <select value="" onChange={(e) => e.target.value && handleVehicleSelect(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">Selecione um veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                ))}
              </select>
            </div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label><select value={form.tipo} onChange={e => setField("tipo", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="multa">Multa</option><option value="acidente">Acidente</option><option value="avaria">Avaria</option><option value="sinistro">Sinistro</option></select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label><input type="date" value={form.data} onChange={e => setField("data", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            {[
              { label: "Placa", key: "veiculoPlaca" }, { label: "Motorista", key: "motorista" },
              { label: "Local", key: "local" }, { label: "Valor (R$)", key: "valor", type: "number" },
              { label: "Pontos CNH", key: "pontosCnh", type: "number" },
            ].map(f => (
              <div key={f.key}><label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label><input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={e => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            ))}
            <div className="col-span-1 sm:col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label><input value={form.descricao} onChange={e => setField("descricao", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div className="col-span-1 sm:col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label><select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="aberto">Aberto</option><option value="em_recurso">Em Recurso</option><option value="pago">Pago</option><option value="resolvido">Resolvido</option></select></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm"><DialogHeader><DialogTitle className="text-foreground">Confirmar</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Excluir esta ocorrência?</p>
          <div className="flex justify-end gap-2 mt-4"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ocorrencias;
