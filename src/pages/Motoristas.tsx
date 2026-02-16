import { useState } from "react";
import { Users, Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Driver } from "@/types/fleet";
import { demoDrivers } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "text-success bg-success/10" },
  inativo: { label: "Inativo", className: "text-muted-foreground bg-muted" },
  ferias: { label: "Férias", className: "text-info bg-info/10" },
  afastado: { label: "Afastado", className: "text-warning bg-warning/10" },
};

const emptyForm: Omit<Driver, "id"> = {
  nome: "", cpf: "", cnh: "", categoriaCnh: "E", vencimentoCnh: "", telefone: "", email: "", status: "ativo", dataAdmissao: new Date().toISOString().split("T")[0], vencimentoExameMedico: "",
};

const Motoristas = () => {
  const { items, add, update, remove } = useStore<Driver>("drivers", demoDrivers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = items.filter(d => d.nome.toLowerCase().includes(search.toLowerCase()) || d.cpf.includes(search));

  const handleSave = () => {
    if (!form.nome || !form.cpf) { toast({ title: "Preencha nome e CPF", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Motorista atualizado!" }); }
    else { add(form); toast({ title: "Motorista cadastrado!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (d: Driver) => { setEditing(d); setForm(d); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Motorista removido!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // Check CNH alerts
  const today = new Date();
  const cnhAlerts = items.filter(d => {
    const vc = new Date(d.vencimentoCnh);
    const diff = (vc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff < 30 && diff > 0;
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Motoristas</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">{items.length} motoristas cadastrados</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"><Plus className="w-4 h-4" />Novo Motorista</button>
      </div>

      {cnhAlerts.length > 0 && (
        <div className="glass-card p-4 border-warning/30">
          <div className="flex items-center gap-2 text-warning text-sm font-medium"><AlertTriangle className="w-4 h-4" />{cnhAlerts.length} motorista(s) com CNH próxima do vencimento</div>
        </div>
      )}

      <div className="relative max-w-sm">
        <input type="text" placeholder="Buscar motorista..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg pl-4 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr className="border-b border-border">{["Motorista", "CPF", "CNH", "Cat.", "Venc. CNH", "Telefone", "Status", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((d, i) => {
              // Garante que sempre exista um status válido (protege contra dados vindos da API sem status)
              const safeStatus = d.status && statusConfig[d.status] ? d.status : "ativo";
              const sc = statusConfig[safeStatus];
              const cnhDate = new Date(d.vencimentoCnh);
              const cnhDiff = (cnhDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
              return (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors animate-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-4 h-4 text-primary" /></div>
                      <div><p className="text-sm font-medium text-foreground">{d.nome}</p><p className="text-xs text-muted-foreground">{d.email}</p></div></div>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{d.cpf}</td>
                  <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{d.cnh}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground font-medium">{d.categoriaCnh}</td>
                  <td className="px-5 py-3.5"><span className={`text-sm font-mono ${cnhDiff < 30 ? "text-warning" : cnhDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>{d.vencimentoCnh}</span></td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{d.telefone}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.className}`}>{sc.label}</span>
                  </td>
                  <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(d)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirm(d.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">Nenhum motorista</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4">
          <DialogHeader><DialogTitle className="text-sm sm:text-base text-foreground">{editing ? "Editar Motorista" : "Novo Motorista"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {[
              { label: "Nome Completo", key: "nome", span: true },
              { label: "CPF", key: "cpf", placeholder: "000.000.000-00" },
              { label: "Telefone", key: "telefone", placeholder: "(00) 00000-0000" },
              { label: "E-mail", key: "email", span: true },
              { label: "CNH", key: "cnh" },
              { label: "Categoria", key: "categoriaCnh", placeholder: "E" },
              { label: "Vencimento CNH", key: "vencimentoCnh", type: "date" },
              { label: "Venc. Exame Médico", key: "vencimentoExameMedico", type: "date" },
              { label: "Data Admissão", key: "dataAdmissao", type: "date" },
            ].map(f => (
              <div key={f.key} className={f.span ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input type={f.type || "text"} value={(form as any)[f.key] ?? ""} onChange={e => setField(f.key, e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            ))}
            <div className="col-span-1 sm:col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="ferias">Férias</option><option value="afastado">Afastado</option>
              </select></div>
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
          <p className="text-sm text-muted-foreground">Excluir este motorista?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Motoristas;
