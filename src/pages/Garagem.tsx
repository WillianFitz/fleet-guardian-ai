import { useState } from "react";
import { ParkingCircle, Plus, Edit, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { GarageEntry, Vehicle, Driver } from "@/types/fleet";
import { demoGarageEntries, demoVehicles, demoDrivers } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";

const statusStyles: Record<string, string> = { aprovado: "text-success bg-success/10", pendente: "text-warning bg-warning/10", negado: "text-destructive bg-destructive/10" };

const emptyForm: Omit<GarageEntry, "id"> = {
  veiculoPlaca: "", veiculoModelo: "", motorista: "", tipo: "saida", data: new Date().toISOString().split("T")[0], hora: "", km: 0, destino: "", observacoes: "", status: "pendente",
};

const Garagem = () => {
  const { items, add, update, remove } = useStore<GarageEntry>("garage", demoGarageEntries);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: drivers } = useStore<Driver>("drivers", demoDrivers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GarageEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const saidas = items.filter(g => g.tipo === "saida").length;
  const entradas = items.filter(g => g.tipo === "entrada").length;

  const handleSave = () => {
    if (!form.veiculoPlaca) { toast({ title: "Preencha a placa", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Registro atualizado!" }); }
    else { add(form); toast({ title: "Registro criado!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (g: GarageEntry) => { setEditing(g); setForm(g); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Registro removido!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setForm(prev => ({
        ...prev,
        veiculoPlaca: vehicle.placa,
        veiculoModelo: vehicle.modelo,
        motorista: vehicle.motorista ? drivers.find(d => d.id === vehicle.motorista)?.nome || "" : "",
        km: vehicle.km || prev.km,
      }));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Garagem</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">Controle de entrada e saída</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"><Plus className="w-4 h-4" />Novo Registro</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><ArrowDownLeft className="w-5 h-5 text-success" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{entradas}</p><p className="text-xs text-muted-foreground">Entradas</p></div></div>
        <div className="glass-card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-info" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{saidas}</p><p className="text-xs text-muted-foreground">Saídas</p></div></div>
        <div className="glass-card p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><ParkingCircle className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold font-mono text-foreground">{items.length}</p><p className="text-xs text-muted-foreground">Total Registros</p></div></div>
      </div>

      <div className="space-y-3">
        {items.map((g, i) => (
          <div key={g.id} className="glass-card p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:border-primary/20 transition-all group animate-slide-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${g.tipo === "saida" ? "bg-info/10" : "bg-success/10"}`}>
              {g.tipo === "saida" ? <ArrowUpRight className="w-5 h-5 text-info" /> : <ArrowDownLeft className="w-5 h-5 text-success" />}
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${g.tipo === "saida" ? "bg-info/10 text-info" : "bg-success/10 text-success"}`}>{g.tipo}</span>
                <span className="text-xs font-mono text-primary">{g.veiculoPlaca}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{g.destino || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{g.veiculoModelo} • {g.motorista}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap w-full sm:w-auto">
              <span className="text-xs sm:text-sm font-mono text-muted-foreground">{g.km.toLocaleString("pt-BR")} km</span>
              <span className="text-xs text-muted-foreground">{g.data} {g.hora}</span>
              {(() => {
                const safeStatus = g.status && statusStyles[g.status] ? g.status : "pendente";
                const cls = statusStyles[safeStatus];
                return (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>
                    {safeStatus}
                  </span>
                );
              })()}
              <button onClick={() => handleEdit(g)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
              <button onClick={() => setDeleteConfirm(g.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center text-muted-foreground py-10">Nenhum registro</div>}
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
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label><select value={form.tipo} onChange={e => setField("tipo", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label><select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"><option value="pendente">Pendente</option><option value="aprovado">Aprovado</option><option value="negado">Negado</option></select></div>
            {[
              { label: "Placa", key: "veiculoPlaca" }, { label: "Modelo", key: "veiculoModelo" },
              { label: "Motorista", key: "motorista" }, { label: "KM", key: "km", type: "number" },
              { label: "Data", key: "data", type: "date" }, { label: "Hora", key: "hora", placeholder: "06:30" },
              { label: "Destino", key: "destino", span: true },
            ].map(f => (
              <div key={f.key} className={f.span ? "col-span-1 sm:col-span-2" : ""}><label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
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
        <DialogContent className="bg-card border-border max-w-sm"><DialogHeader><DialogTitle className="text-foreground">Confirmar</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Excluir este registro?</p>
          <div className="flex justify-end gap-2 mt-4"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button><button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Garagem;
