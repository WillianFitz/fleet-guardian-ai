import { useState } from "react";
import { TrendingUp, Plus, Edit, Trash2, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { Receita, Vehicle, CTe } from "@/types/fleet";
import { demoReceitas, demoVehicles, demoCtes } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import { api, isApiConfigured } from "@/lib/api";
import KpiCard from "@/components/dashboard/KpiCard";

const statusStyles: Record<string, string> = {
  pendente: "text-warning bg-warning/10",
  recebido: "text-success bg-success/10",
  cancelado: "text-muted-foreground bg-muted",
};

const emptyForm: Omit<Receita, "id"> = {
  descricao: "",
  categoria: "Frete",
  valor: 0,
  data: new Date().toISOString().split("T")[0],
  veiculoPlaca: "",
  cliente: "",
  cteId: "",
  cteChave: "",
  cteNumero: "",
  notaFiscal: "",
  status: "pendente",
  formaPagamento: "",
  dataRecebimento: "",
  observacoes: "",
};

const Receitas = () => {
  const { items, add, update, remove, setItems } = useStore<Receita>("receitas", demoReceitas);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: ctes, update: updateCte } = useStore<CTe>("ctes", demoCtes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Receita | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [importCteOpen, setImportCteOpen] = useState(false);
  const [linkingCte, setLinkingCte] = useState<CTe | null>(null);

  const filtered = items.filter(
    (r) =>
      r.descricao.toLowerCase().includes(search.toLowerCase()) ||
      r.veiculoPlaca.toLowerCase().includes(search.toLowerCase()) ||
      r.cliente.toLowerCase().includes(search.toLowerCase())
  );
  const totalRecebido = items.filter((r) => r.status === "recebido").reduce((s, r) => s + r.valor, 0);
  const totalPendente = items.filter((r) => r.status === "pendente").reduce((s, r) => s + r.valor, 0);

  const handleSave = async () => {
    if (!form.descricao) {
      toast({ title: "Preencha a descrição", variant: "destructive" });
      return;
    }
    if (editing) {
      update(editing.id, form);
      toast({ title: "Receita atualizada!" });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setLinkingCte(null);
      return;
    }
    if (linkingCte && isApiConfigured()) {
      try {
        const created = await api.create<Receita>("receitas", form);
        updateCte(linkingCte.id, { receitaId: created.id });
        setItems((prev) => [created, ...prev]);
        toast({ title: "Receita criada e vinculada ao CTe!" });
      } catch (e: unknown) {
        toast({
          title: "Erro ao salvar",
          description: e instanceof Error ? e.message : "Erro desconhecido",
          variant: "destructive",
        });
        return;
      }
    } else if (linkingCte) {
      const newItem = add(form) as Receita;
      updateCte(linkingCte.id, { receitaId: newItem.id });
      toast({ title: "Receita registrada e vinculada ao CTe!" });
    } else {
      add(form);
      toast({ title: "Receita registrada!" });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setLinkingCte(null);
  };

  const handleEdit = (r: Receita) => {
    setEditing(r);
    setForm(r);
    setDialogOpen(true);
  };
  const handleNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const handleDelete = (id: string) => {
    remove(id);
    setDeleteConfirm(null);
    toast({ title: "Receita removida!" });
  };
  const setField = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      setForm((prev) => ({
        ...prev,
        veiculoPlaca: vehicle.placa,
      }));
    }
  };

  const ctesDisponiveis = ctes.filter((c) => !c.receitaId && c.status === "autorizado");
  const handleSelectCte = (cte: CTe) => {
    setForm({
      descricao: `Frete CTe ${cte.numero} - ${cte.remetenteNome || ""} → ${cte.destinatarioNome || ""}`,
      categoria: "Frete",
      valor: cte.valorPrestacao ?? 0,
      data: cte.dataEmissao || new Date().toISOString().split("T")[0],
      veiculoPlaca: cte.veiculoPlaca || "",
      cliente: cte.destinatarioNome || "",
      cteId: cte.id,
      cteChave: cte.chave || "",
      cteNumero: cte.numero,
      notaFiscal: cte.chave || "",
      status: "pendente",
      formaPagamento: "",
      dataRecebimento: "",
      observacoes: "",
    });
    setLinkingCte(cte);
    setImportCteOpen(false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Receitas / Fretes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Controle de receitas e fretes</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setImportCteOpen(true)}
            className="flex items-center gap-2 bg-muted text-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-muted/80 transition-colors justify-center"
          >
            <FileDown className="w-4 h-4" />
            Importar do CTe
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Nova Receita
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={TrendingUp}
          title="Total Geral"
          value={`R$ ${((totalRecebido + totalPendente) / 1000).toFixed(1)}k`}
          variant="default"
        />
        <KpiCard icon={TrendingUp} title="Total Recebido" value={`R$ ${(totalRecebido / 1000).toFixed(1)}k`} variant="success" />
        <KpiCard icon={TrendingUp} title="Pendente" value={`R$ ${(totalPendente / 1000).toFixed(1)}k`} variant="warning" />
      </div>

      <input
        type="text"
        placeholder="Buscar receita..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm w-full bg-muted/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border">
                {["Descrição", "Categoria", "Veículo", "Cliente", "Valor", "Status", "Data", "Ações"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const safeStatus = r.status && statusStyles[r.status] ? r.status : "pendente";
                const cls = statusStyles[safeStatus];
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-foreground">{r.descricao}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{r.categoria}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{r.veiculoPlaca || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{r.cliente}</td>
                    <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">
                      R$ {r.valor.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${cls}`}>{safeStatus}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{r.data}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(r.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">
                    Nenhuma receita
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-foreground">
              {editing ? "Editar" : linkingCte ? "Nova Receita (a partir do CTe)" : "Nova Receita"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Selecionar Veículo</label>
              <select
                value={vehicles.find((v) => v.placa === form.veiculoPlaca)?.id ?? ""}
                onChange={(e) => e.target.value && handleVehicleSelect(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">Selecione um veículo...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.modelo}
                  </option>
                ))}
              </select>
            </div>
            {[
              { label: "Descrição", key: "descricao", span: true },
              { label: "Categoria", key: "categoria", placeholder: "Frete" },
              { label: "Valor (R$)", key: "valor", type: "number" },
              { label: "Veículo (Placa)", key: "veiculoPlaca", placeholder: "ABC-1234" },
              { label: "Cliente", key: "cliente" },
              { label: "Nota Fiscal", key: "notaFiscal" },
              { label: "Data", key: "data", type: "date" },
              { label: "Forma de Pagamento", key: "formaPagamento", placeholder: "PIX, Boleto..." },
              { label: "Data Recebimento", key: "dataRecebimento", type: "date" },
            ].map((f) => (
              <div key={f.key} className={f.span ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={((form as Record<string, unknown>)[f.key] as string) ?? ""}
                  onChange={(e) => setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            ))}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="pendente">Pendente</option>
                <option value="recebido">Recebido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
              <textarea
                value={form.observacoes || ""}
                onChange={(e) => setField("observacoes", e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Salvar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importCteOpen} onOpenChange={setImportCteOpen}>
        <DialogContent className="bg-card border-border max-w-lg mx-4">
          <DialogHeader>
            <DialogTitle className="text-foreground">Importar receita a partir de um CTe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Selecione um CTe autorizado para preencher a receita (frete) com os dados do conhecimento.
          </p>
          <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
            {ctesDisponiveis.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground text-sm">
                Nenhum CTe disponível (todos já vinculados ou nenhum autorizado).
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-3 py-2">Número</th>
                    <th className="text-left px-3 py-2">Placa</th>
                    <th className="text-left px-3 py-2">Emissão</th>
                    <th className="text-left px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {ctesDisponiveis.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono">{c.numero}</td>
                      <td className="px-3 py-2">{c.veiculoPlaca || "—"}</td>
                      <td className="px-3 py-2">{c.dataEmissao}</td>
                      <td className="px-3 py-2">R$ {(c.valorPrestacao ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => handleSelectCte(c)} className="text-primary hover:underline text-xs font-medium">
                          Usar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir esta receita?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors"
            >
              Excluir
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Receitas;
