import { useState } from "react";
import { Package, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Part } from "@/types/fleet";
import { demoParts } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import KpiCard from "@/components/dashboard/KpiCard";

const emptyForm: Omit<Part, "id"> = {
  codigo: "", descricao: "", categoria: "", quantidade: 0, quantidadeMinima: 1, unidade: "UN", custoUnitario: 0, localizacao: "", fornecedor: "",
};

const Estoque = () => {
  const { items, add, update, remove } = useStore<Part>("parts", demoParts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = items.filter(p => p.descricao.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()));
  const valorTotal = items.reduce((s, p) => s + p.quantidade * p.custoUnitario, 0);
  const itensAbaixo = items.filter(p => p.quantidade <= p.quantidadeMinima).length;

  const handleSave = () => {
    if (!form.descricao || !form.codigo) { toast({ title: "Preencha código e descrição", variant: "destructive" }); return; }
    if (editing) { update(editing.id, form); toast({ title: "Peça atualizada!" }); }
    else { add(form); toast({ title: "Peça cadastrada!" }); }
    setDialogOpen(false); setEditing(null); setForm(emptyForm);
  };

  const handleEdit = (p: Part) => { setEditing(p); setForm(p); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast({ title: "Peça removida!" }); };
  const setField = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Estoque</h1><p className="text-xs sm:text-sm text-muted-foreground mt-1">{items.length} itens cadastrados</p></div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"><Plus className="w-4 h-4" />Nova Peça</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={Package} title="Total de Itens" value={String(items.length)} variant="default" />
        <KpiCard icon={Package} title="Valor em Estoque" value={`R$ ${(valorTotal/1000).toFixed(1)}k`} variant="info" />
        <KpiCard icon={AlertTriangle} title="Abaixo do Mínimo" value={String(itensAbaixo)} variant={itensAbaixo > 0 ? "destructive" : "success"} />
      </div>

      <input type="text" placeholder="Buscar peça..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm w-full bg-muted/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr className="border-b border-border">{["Código", "Descrição", "Categoria", "Qtd", "Mín", "Custo Unit.", "Localização", "Fornecedor", "Ações"].map(h => <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3.5 text-sm font-mono text-primary">{p.codigo}</td>
                <td className="px-5 py-3.5 text-sm text-foreground">{p.descricao}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.categoria}</td>
                <td className="px-5 py-3.5"><span className={`text-sm font-mono font-medium ${p.quantidade <= p.quantidadeMinima ? "text-destructive" : "text-foreground"}`}>{p.quantidade} {p.unidade}</span></td>
                <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{p.quantidadeMinima}</td>
                <td className="px-5 py-3.5 text-sm font-mono text-foreground">R$ {p.custoUnitario.toFixed(2)}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.localizacao}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.fornecedor}</td>
                <td className="px-5 py-3.5"><div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(p)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(p.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">Nenhuma peça</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4">
          <DialogHeader><DialogTitle className="text-sm sm:text-base text-foreground">{editing ? "Editar Peça" : "Nova Peça"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {[
              { label: "Código", key: "codigo", placeholder: "FLT-001" },
              { label: "Categoria", key: "categoria", placeholder: "Filtros" },
              { label: "Descrição", key: "descricao", placeholder: "Filtro de óleo", span: true },
              { label: "Quantidade", key: "quantidade", type: "number" },
              { label: "Qtd Mínima", key: "quantidadeMinima", type: "number" },
              { label: "Unidade", key: "unidade", placeholder: "UN" },
              { label: "Custo Unitário", key: "custoUnitario", type: "number" },
              { label: "Localização", key: "localizacao", placeholder: "Prateleira A1" },
              { label: "Fornecedor", key: "fornecedor", placeholder: "Nome" },
            ].map(f => (
              <div key={f.key} className={f.span ? "col-span-1 sm:col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
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
        <DialogContent className="bg-card border-border max-w-sm"><DialogHeader><DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir esta peça?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Excluir</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
