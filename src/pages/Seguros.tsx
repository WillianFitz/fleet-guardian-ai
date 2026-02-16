import { useState } from "react";
import { ShieldCheck, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Insurance } from "@/types/fleet";
import { demoInsurances } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import KpiCard from "@/components/dashboard/KpiCard";

const statusStyles: Record<string, string> = { ativa: "text-success bg-success/10", vencida: "text-destructive bg-destructive/10", cancelada: "text-muted-foreground bg-muted" };

const emptyForm: Omit<Insurance, "id"> = {
  apolice: "", seguradora: "", veiculoPlaca: "", veiculoModelo: "", tipo: "", valorPremio: 0, valorFranquia: 0, vigenciaInicio: "", vigenciaFim: "", status: "ativa", abrangencia: "Nacional",
};

const Seguros = () => {
  const { items, add, update, remove } = useStore<Insurance>("insurances", demoInsurances);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Insurance | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalPremio = items.reduce((s, i) => s + i.valorPremio, 0);
  const ativas = items.filter(i => i.status === "ativa").length;

  const handleSave = () => {
    if (!form.apolice || !form.veiculoPlaca) { toast({ title: "Preencha apólice e placa", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Seguro atualizado!" }); }
    else { add(form); toast({ title: "Seguro cadastrado!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (i: Insurance) => { setEditing(i); setForm(i); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Seguro removido!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Seguros</h1><p className="text-sm text-muted-foreground mt-1">Gestão de apólices</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><Plus className="w-4 h-4" />Novo Seguro</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={ShieldCheck} title="Apólices Ativas" value={String(ativas)} variant="success" />
        <KpiCard icon={ShieldCheck} title="Total em Prêmios" value={`R$ ${(totalPremio/1000).toFixed(1)}k`} variant="info" />
        <KpiCard icon={ShieldCheck} title="Total Apólices" value={String(items.length)} variant="default" />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border">{["Apólice", "Seguradora", "Veículo", "Tipo", "Prêmio", "Franquia", "Vigência", "Status", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {items.map(i => {
              const safeStatus = i.status && statusStyles[i.status] ? i.status : "ativa";
              const cls = statusStyles[safeStatus];
              return (
              <tr key={i.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5 text-sm font-mono text-primary">{i.apolice}</td>
                <td className="px-5 py-3.5 text-sm text-foreground">{i.seguradora}</td>
                <td className="px-5 py-3.5"><p className="text-sm font-mono text-foreground">{i.veiculoPlaca}</p><p className="text-xs text-muted-foreground">{i.veiculoModelo}</p></td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{i.tipo}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-foreground">R$ {i.valorPremio.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">R$ {i.valorFranquia.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">{i.vigenciaInicio} → {i.vigenciaFim}</td>
                <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>{safeStatus}</span></td>
                <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(i)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(i.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div></td>
              </tr>
            )})}
            {items.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">Nenhum seguro</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Editar" : "Novo Seguro"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { label: "Nº Apólice", key: "apolice" }, { label: "Seguradora", key: "seguradora" },
              { label: "Placa", key: "veiculoPlaca" }, { label: "Modelo", key: "veiculoModelo" },
              { label: "Tipo", key: "tipo", placeholder: "Casco Completo" }, { label: "Abrangência", key: "abrangencia" },
              { label: "Prêmio (R$)", key: "valorPremio", type: "number" }, { label: "Franquia (R$)", key: "valorFranquia", type: "number" },
              { label: "Início Vigência", key: "vigenciaInicio", type: "date" }, { label: "Fim Vigência", key: "vigenciaFim", type: "date" },
            ].map(f => (
              <div key={f.key}><label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={e => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            ))}
            <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label><select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="ativa">Ativa</option><option value="vencida">Vencida</option><option value="cancelada">Cancelada</option></select></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm"><DialogHeader><DialogTitle className="text-foreground">Confirmar</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Excluir este seguro?</p>
          <div className="flex justify-end gap-2 mt-4"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Seguros;
