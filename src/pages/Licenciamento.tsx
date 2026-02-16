import { useState } from "react";
import { FileText, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { License, Vehicle } from "@/types/fleet";
import { demoLicenses, demoVehicles } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import KpiCard from "@/components/dashboard/KpiCard";

const statusStyles: Record<string, string> = { pago: "text-success bg-success/10", pendente: "text-warning bg-warning/10", vencido: "text-destructive bg-destructive/10", parcelado: "text-info bg-info/10" };
const tipoLabels: Record<string, string> = { ipva: "IPVA", licenciamento: "Licenciamento", seguro_obrigatorio: "Seguro Obrigatório" };

const emptyForm: Omit<License, "id"> = {
  veiculoPlaca: "", veiculoModelo: "", tipo: "ipva", anoReferencia: "2026", valor: 0, dataVencimento: "", status: "pendente", parcelas: 1, parcelasPagas: 0,
};

const Licenciamento = () => {
  const { items, add, update, remove } = useStore<License>("licenses", demoLicenses);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalPendente = items.filter(l => l.status !== "pago").reduce((s, l) => s + l.valor, 0);
  const vencidos = items.filter(l => l.status === "vencido").length;

  const handleSave = () => {
    if (!form.veiculoPlaca) { toast({ title: "Preencha a placa", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Licença atualizada!" }); }
    else { add(form); toast({ title: "Licença registrada!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (l: License) => { setEditing(l); setForm(l); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Licença removida!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        veiculoPlaca: vehicle.placa,
        veiculoModelo: vehicle.modelo,
      }));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Licenciamento</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">IPVA, Licenciamento e Seguro Obrigatório</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"><Plus className="w-4 h-4" />Novo Registro</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={FileText} title="Total Registros" value={String(items.length)} variant="default" />
        <KpiCard icon={FileText} title="Valor Pendente" value={`R$ ${(totalPendente/1000).toFixed(1)}k`} variant="warning" />
        <KpiCard icon={AlertTriangle} title="Vencidos" value={String(vencidos)} variant={vencidos > 0 ? "destructive" : "success"} />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr className="border-b border-border">{["Veículo", "Tipo", "Ano Ref.", "Valor", "Vencimento", "Parcelas", "Status", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3">{h}</th>)}</tr></thead>
          <tbody>
            {items.map(l => {
              const safeStatus = l.status && statusStyles[l.status] ? l.status : "pendente";
              const cls = statusStyles[safeStatus];
              return (
              <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5"><p className="text-sm font-mono text-foreground">{l.veiculoPlaca}</p><p className="text-xs text-muted-foreground">{l.veiculoModelo}</p></td>
                <td className="px-5 py-3.5 text-sm text-foreground">{tipoLabels[l.tipo]}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{l.anoReferencia}</td>
                <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">R$ {l.valor.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{l.dataVencimento}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{l.parcelasPagas}/{l.parcelas}</td>
                <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>{safeStatus}</span></td>
                <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(l)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(l.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div></td>
              </tr>
            )})}
            {items.length === 0 && <tr><td colSpan={8} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">Nenhum registro</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4">
          <DialogHeader><DialogTitle className="text-sm sm:text-base text-foreground">{editing ? "Editar" : "Novo Registro"}</DialogTitle></DialogHeader>
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
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Placa</label><input value={form.veiculoPlaca} onChange={e => setField("veiculoPlaca", e.target.value)} placeholder="ABC-1234" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo</label><input value={form.veiculoModelo} onChange={e => setField("veiculoModelo", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label><select value={form.tipo} onChange={e => setField("tipo", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="ipva">IPVA</option><option value="licenciamento">Licenciamento</option><option value="seguro_obrigatorio">Seguro Obrigatório</option></select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Ano Referência</label><input value={form.anoReferencia} onChange={e => setField("anoReferencia", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label><input type="number" value={form.valor} onChange={e => setField("valor", Number(e.target.value))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Vencimento</label><input type="date" value={form.dataVencimento} onChange={e => setField("dataVencimento", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Parcelas</label><input type="number" value={form.parcelas} onChange={e => setField("parcelas", Number(e.target.value))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Parcelas Pagas</label><input type="number" value={form.parcelasPagas} onChange={e => setField("parcelasPagas", Number(e.target.value))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div className="col-span-1 sm:col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label><select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="vencido">Vencido</option><option value="parcelado">Parcelado</option></select></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm"><DialogHeader><DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir este registro?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Licenciamento;
