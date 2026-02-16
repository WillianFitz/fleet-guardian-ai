import { useState, useEffect } from "react";
import { Truck, Plus, Search, Filter, Edit, Trash2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Vehicle, Driver } from "@/types/fleet";
import { demoVehicles, demoDrivers } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";

const statusConfig = {
  operando: { icon: CheckCircle, label: "Operando", className: "text-success bg-success/10" },
  manutencao: { icon: AlertTriangle, label: "Manutenção", className: "text-warning bg-warning/10" },
  parado: { icon: XCircle, label: "Parado", className: "text-destructive bg-destructive/10" },
  vendido: { icon: XCircle, label: "Vendido", className: "text-muted-foreground bg-muted" },
};

const emptyForm: Omit<Vehicle, "id"> = {
  placa: "", modelo: "", tipo: "Cavalo Mecânico", categoria: "Pesado", ano: 2026, km: 0,
  status: "operando", motorista: "", chassi: "", renavam: "", cor: "", combustivel: "Diesel S10", createdAt: new Date().toISOString().split("T")[0],
};

const Veiculos = () => {
  const { items, add, update, remove } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: drivers } = useStore<Driver>("drivers", demoDrivers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getDriverName = (id: string | null | undefined) => {
    if (!id || id === "" || id === null || id === undefined) return "";
    const driver = drivers.find(d => d.id === String(id));
    return driver?.nome || "";
  };

  // Garante que quando o dialog abre para edição, o form seja atualizado corretamente
  useEffect(() => {
    if (dialogOpen) {
      if (editing) {
        // Trata null/undefined como string vazia para o campo motorista
        const motoristaValue = (editing.motorista === null || editing.motorista === undefined) 
          ? "" 
          : String(editing.motorista);
        setForm({ ...editing, motorista: motoristaValue });
      } else {
        setForm(emptyForm);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, editing?.id]);

  const filtered = items.filter(
    (v) => v.placa.toLowerCase().includes(search.toLowerCase()) ||
      v.modelo.toLowerCase().includes(search.toLowerCase()) ||
      getDriverName(v.motorista).toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.placa || !form.modelo) { toast({ title: "Preencha placa e modelo", variant: "destructive" }); return; }
    
    // Garante que o campo motorista seja salvo corretamente
    // Se form.motorista for null, undefined, ou string vazia, usa string vazia
    const motoristaValue = (form.motorista === null || form.motorista === undefined || form.motorista === "") 
      ? "" 
      : String(form.motorista).trim();
    
    // Cria objeto completo com todos os campos, garantindo que motorista sempre esteja presente
    const dataToSave: Partial<Vehicle> = { 
      placa: form.placa,
      modelo: form.modelo,
      tipo: form.tipo,
      categoria: form.categoria,
      ano: form.ano || new Date().getFullYear(),
      km: form.km || 0,
      status: form.status,
      motorista: motoristaValue, // SEMPRE inclui o campo motorista explicitamente
      chassi: form.chassi || "",
      renavam: form.renavam || "",
      cor: form.cor || "",
      combustivel: form.combustivel || "Diesel S10",
      createdAt: form.createdAt || new Date().toISOString().split("T")[0]
    };
    
    if (editing) { 
      update(editing.id, dataToSave); 
      toast({ title: "Veículo atualizado!" }); 
    } else { 
      add(dataToSave as Omit<Vehicle, "id">); 
      toast({ title: "Veículo cadastrado!" }); 
    }
    setDialogOpen(false); 
    setEditing(null); 
    setForm(emptyForm);
  };

  const handleEdit = (v: Vehicle) => { 
    setEditing(v); 
    // Garante que o campo motorista seja carregado corretamente (trata null como string vazia)
    const vehicleData = { 
      ...v, 
      motorista: (v.motorista === null || v.motorista === undefined) ? "" : String(v.motorista)
    };
    setForm(vehicleData); 
    setDialogOpen(true); 
  };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Veículo removido!" }); };
  const setField = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} veículos cadastrados</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Veículo
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar por placa, modelo ou motorista..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Veículo", "Tipo", "KM", "Status", "Motorista", "Combustível", "Ações"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                // Garante que sempre exista um status válido (protege contra dados vindos da API sem status)
                const safeStatus = v.status && statusConfig[v.status] ? v.status : "operando";
                const sc = statusConfig[safeStatus];
                return (
                  <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors animate-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Truck className="w-4 h-4 text-primary" /></div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{v.modelo}</p>
                          <p className="text-xs text-muted-foreground font-mono">{v.placa} • {v.ano}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{v.tipo}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-foreground">{v.km.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.className}`}>
                        <sc.icon className="w-3 h-3" />{sc.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {v.motorista && v.motorista !== null && String(v.motorista).trim() !== "" 
                        ? (getDriverName(v.motorista) || "—") 
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{v.combustivel}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(v)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(v.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Nenhum veículo encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditing(null);
          setForm(emptyForm);
        }
      }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editing ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { label: "Placa", key: "placa", placeholder: "ABC-1234" },
              { label: "Modelo", key: "modelo", placeholder: "Scania R450" },
              { label: "Tipo", key: "tipo", placeholder: "Cavalo Mecânico" },
              { label: "Categoria", key: "categoria", placeholder: "Pesado" },
              { label: "Ano", key: "ano", placeholder: "2026", type: "number" },
              { label: "KM Atual", key: "km", placeholder: "0", type: "number" },
              { label: "Chassi", key: "chassi", placeholder: "9BSR..." },
              { label: "RENAVAM", key: "renavam", placeholder: "12345678901" },
              { label: "Cor", key: "cor", placeholder: "Branco" },
              { label: "Combustível", key: "combustivel", placeholder: "Diesel S10" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={(e) => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Motorista</label>
              <select 
                value={form.motorista && form.motorista !== null && form.motorista !== undefined ? String(form.motorista) : ""} 
                onChange={(e) => {
                  const value = e.target.value;
                  // Garante que o valor seja sempre uma string (mesmo que vazia)
                  const motoristaValue = value === "" ? "" : String(value);
                  setField("motorista", motoristaValue);
                }}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">Sem motorista</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.nome} — CNH {d.cnh}</option>
                ))}
              </select>
              {drivers.length === 0 && <p className="text-xs text-warning mt-1">Cadastre motoristas primeiro na aba Motoristas.</p>}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="operando">Operando</option><option value="manutencao">Manutenção</option><option value="parado">Parado</option><option value="vendido">Vendido</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Veiculos;
