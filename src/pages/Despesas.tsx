import { useState } from "react";
import { DollarSign, Plus, Edit, Trash2, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Expense, Vehicle, CTe } from "@/types/fleet";
import { demoExpenses, demoVehicles, demoCtes } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import KpiCard from "@/components/dashboard/KpiCard";
import { api, isApiConfigured } from "@/lib/api";

const statusStyles: Record<string, string> = { pendente: "text-warning bg-warning/10", pago: "text-success bg-success/10", cancelado: "text-muted-foreground bg-muted" };

const emptyForm: Omit<Expense, "id"> = {
  descricao: "", categoria: "", valor: 0, data: new Date().toISOString().split("T")[0], veiculoPlaca: "", fornecedor: "", notaFiscal: "", status: "pendente", centroCusto: "",
};

const Despesas = () => {
  const { items, add, update, remove } = useStore<Expense>("expenses", demoExpenses);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = items.filter(e => e.descricao.toLowerCase().includes(search.toLowerCase()) || e.veiculoPlaca.toLowerCase().includes(search.toLowerCase()));
  const totalPago = items.filter(e => e.status === "pago").reduce((s, e) => s + e.valor, 0);
  const totalPendente = items.filter(e => e.status === "pendente").reduce((s, e) => s + e.valor, 0);

  const handleSave = () => {
    if (!form.descricao) { toast({ title: "Preencha a descrição", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Despesa atualizada!" }); }
    else { add(form); toast({ title: "Despesa registrada!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (e: Expense) => { setEditing(e); setForm(e); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Despesa removida!" }); };
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
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Despesas</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Controle de custos gerais</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"><Plus className="w-4 h-4" />Nova Despesa</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} title="Total Geral" value={`R$ ${((totalPago + totalPendente)/1000).toFixed(1)}k`} variant="default" />
        <KpiCard icon={DollarSign} title="Total Pago" value={`R$ ${(totalPago/1000).toFixed(1)}k`} variant="success" />
        <KpiCard icon={DollarSign} title="Pendente" value={`R$ ${(totalPendente/1000).toFixed(1)}k`} variant="warning" />
      </div>

      <input type="text" placeholder="Buscar despesa..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm w-full bg-muted/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr className="border-b border-border">{["Descrição", "Categoria", "Veículo", "Fornecedor", "Valor", "Status", "Data", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(e => {
              const safeStatus = e.status && statusStyles[e.status] ? e.status : "pendente";
              const cls = statusStyles[safeStatus];
              return (
              <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5 text-sm text-foreground">{e.descricao}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{e.categoria}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{e.veiculoPlaca || "—"}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{e.fornecedor}</td>
                <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">R$ {e.valor.toLocaleString("pt-BR")}</td>
                <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>{safeStatus}</span></td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{e.data}</td>
                <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(e)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(e.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div></td>
              </tr>
            )})}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">Nenhuma despesa</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4">
          <DialogHeader><DialogTitle className="text-sm sm:text-base text-foreground">{editing ? "Editar" : "Nova Despesa"}</DialogTitle></DialogHeader>
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
            {[
              { label: "Descrição", key: "descricao", span: true },
              { label: "Categoria", key: "categoria", placeholder: "Pedágio" },
              { label: "Valor (R$)", key: "valor", type: "number" },
              { label: "Veículo (Placa)", key: "veiculoPlaca", placeholder: "ABC-1234" },
              { label: "Fornecedor", key: "fornecedor" },
              { label: "Nota Fiscal", key: "notaFiscal" },
              { label: "Centro de Custo", key: "centroCusto" },
              { label: "Data", key: "data", type: "date" },
            ].map(f => (
              <div key={f.key} className={f.span ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={e => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            ))}
            <div className="col-span-1 sm:col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option>
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
          <p className="text-sm text-muted-foreground">Excluir esta despesa?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Despesas;
