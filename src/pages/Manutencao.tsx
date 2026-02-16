import { useState } from "react";
import { Wrench, Plus, Clock, CheckCircle, ArrowRight, Edit, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { MaintenanceOrder, Vehicle } from "@/types/fleet";
import { demoMaintenanceOrders, demoVehicles } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";

const statusStyles: Record<string, string> = { aberta: "bg-warning/10 text-warning", em_andamento: "bg-info/10 text-info", concluida: "bg-success/10 text-success", cancelada: "bg-muted text-muted-foreground" };
const statusLabels: Record<string, string> = { aberta: "Aberta", em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada" };
const prioridadeStyles: Record<string, string> = { baixa: "bg-muted text-muted-foreground", media: "bg-info/10 text-info", alta: "bg-warning/10 text-warning", urgente: "bg-destructive/10 text-destructive" };

const emptyForm: Omit<MaintenanceOrder, "id"> = {
  numero: "", veiculoId: "", veiculoPlaca: "", veiculoModelo: "", tipo: "preventiva", descricao: "", status: "aberta", prioridade: "media", data: new Date().toISOString().split("T")[0], custo: 0, oficina: "", observacoes: "",
};

const Manutencao = () => {
  const { items, add, update, remove } = useStore<MaintenanceOrder>("maintenance", demoMaintenanceOrders);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const nextNum = `OS-2026-${String(items.length + 146).padStart(4, "0")}`;
  const filtered = items.filter(i => i.descricao.toLowerCase().includes(search.toLowerCase()) || i.veiculoPlaca.toLowerCase().includes(search.toLowerCase()));
  const abertas = items.filter(o => o.status === "aberta").length;
  const andamento = items.filter(o => o.status === "em_andamento").length;
  const custoMes = items.reduce((s, o) => s + o.custo, 0);

  const handleSave = () => {
    if (!form.descricao || !form.veiculoPlaca) { toast({ title: "Preencha os campos obrigatórios", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "OS atualizada!" }); }
    else { add({ ...form, numero: nextNum }); toast({ title: "OS criada!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (o: MaintenanceOrder) => { setEditing(o); setForm(o); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm({ ...emptyForm, numero: nextNum }); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "OS removida!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        veiculoId: vehicle.id,
        veiculoPlaca: vehicle.placa,
        veiculoModelo: vehicle.modelo,
      }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Manutenção</h1><p className="text-sm text-muted-foreground mt-1">Ordens de serviço e planejamento</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><Plus className="w-4 h-4" />Nova OS</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Clock className="w-5 h-5 text-warning" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{abertas}</p><p className="text-xs text-muted-foreground">OS Abertas</p></div></div>
        <div className="glass-card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center"><Wrench className="w-5 h-5 text-info" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{andamento}</p><p className="text-xs text-muted-foreground">Em Andamento</p></div></div>
        <div className="glass-card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-success" /></div><div><p className="text-2xl font-bold font-mono text-foreground">R$ {(custoMes/1000).toFixed(1)}k</p><p className="text-xs text-muted-foreground">Custo este mês</p></div></div>
      </div>

      <div className="relative max-w-sm">
        <input type="text" placeholder="Buscar OS..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg pl-4 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      <div className="space-y-3">
        {filtered.map((os, i) => {
          const safeStatus = os.status && statusStyles[os.status] ? os.status : "aberta";
          const statusCls = statusStyles[safeStatus];
          const statusLabel = statusLabels[safeStatus];
          const safePrioridade = os.prioridade && prioridadeStyles[os.prioridade] ? os.prioridade : "media";
          const prioridadeCls = prioridadeStyles[safePrioridade];
          return (
          <div key={os.id} className="glass-card p-4 flex items-center gap-4 hover:border-primary/20 transition-all group animate-slide-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0"><Wrench className="w-5 h-5 text-muted-foreground" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-primary font-medium">{os.numero}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${os.tipo === "preventiva" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"}`}>{os.tipo}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{os.descricao}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{os.veiculoModelo} • {os.veiculoPlaca}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${prioridadeCls}`}>{safePrioridade}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCls}`}>{statusLabel}</span>
              {os.custo > 0 && <span className="text-sm font-mono text-foreground">R$ {os.custo.toLocaleString("pt-BR")}</span>}
              <span className="text-xs text-muted-foreground">{os.data}</span>
              <button onClick={() => handleEdit(os)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
              <button onClick={() => setDeleteConfirm(os.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )})}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-10">Nenhuma OS encontrada</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Editar OS" : "Nova Ordem de Serviço"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selecionar Veículo</label>
              <select value={form.veiculoId || ""} onChange={(e) => e.target.value && handleVehicleSelect(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">Selecione um veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                ))}
              </select>
            </div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Placa do Veículo</label><input value={form.veiculoPlaca} onChange={e => setField("veiculoPlaca", e.target.value)} placeholder="ABC-1234" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo</label><input value={form.veiculoModelo} onChange={e => setField("veiculoModelo", e.target.value)} placeholder="Scania R450" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label><select value={form.tipo} onChange={e => setField("tipo", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option></select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label><select value={form.prioridade} onChange={e => setField("prioridade", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label><select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="aberta">Aberta</option><option value="em_andamento">Em Andamento</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option></select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Custo (R$)</label><input type="number" value={form.custo} onChange={e => setField("custo", Number(e.target.value))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label><input value={form.descricao} onChange={e => setField("descricao", e.target.value)} placeholder="Descreva o serviço" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Oficina</label><input value={form.oficina} onChange={e => setField("oficina", e.target.value)} placeholder="Nome da oficina" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" /></div>
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
          <p className="text-sm text-muted-foreground">Excluir esta ordem de serviço?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Manutencao;
