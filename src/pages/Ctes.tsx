import { useState } from "react";
import { FileText, Plus, Edit, Trash2, Send, Search, AlertCircle, ExternalLink, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { CTe, Vehicle } from "@/types/fleet";
import { demoCtes, demoVehicles } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import { api, cteApi } from "@/lib/api";
import { useTenant } from "@/hooks/useTenant";
import KpiCard from "@/components/dashboard/KpiCard";
import { Link } from "react-router-dom";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  autorizado: "Autorizado",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
  erro: "Erro",
};

const statusStyles: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  autorizado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejeitado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelado: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  erro: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const emptyForm: Omit<CTe, "id"> = {
  chave: "",
  numero: "",
  serie: "1",
  veiculoPlaca: "",
  veiculoModelo: "",
  dataEmissao: new Date().toISOString().split("T")[0],
  dataInicioViagem: "",
  valorPrestacao: 0,
  valorFrete: 0,
  remetenteNome: "",
  remetenteCnpjCpf: "",
  remetenteMunicipio: "",
  remetenteUf: "",
  destinatarioNome: "",
  destinatarioCnpjCpf: "",
  destinatarioMunicipio: "",
  destinatarioUf: "",
  municipioOrigem: "",
  ufOrigem: "",
  municipioDestino: "",
  ufDestino: "",
  status: "rascunho",
  protocolo: "",
  motivoRejeicao: "",
  xmlUrl: "",
  pdfUrl: "",
};

const Ctes = () => {
  const { items, add, update, remove } = useStore<CTe>("ctes", demoCtes);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { tenant } = useTenant();
  const ambienteAtual = tenant?.ambienteCte || "homologacao";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CTe | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [placaFilter, setPlacaFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [emitting, setEmitting] = useState(false);
  const [consulting, setConsulting] = useState<string | null>(null);

  const filtered = items.filter((c) => {
    const matchSearch =
      !search ||
      c.numero.toLowerCase().includes(search.toLowerCase()) ||
      c.chave?.toLowerCase().includes(search.toLowerCase()) ||
      c.remetenteNome?.toLowerCase().includes(search.toLowerCase()) ||
      c.destinatarioNome?.toLowerCase().includes(search.toLowerCase());
    const matchPlaca = !placaFilter || c.veiculoPlaca === placaFilter;
    const matchDateStart = !dateStart || (c.dataEmissao && c.dataEmissao >= dateStart);
    const matchDateEnd = !dateEnd || (c.dataEmissao && c.dataEmissao <= dateEnd);
    return matchSearch && matchPlaca && matchDateStart && matchDateEnd;
  });

  const totalAutorizados = items.filter((c) => c.status === "autorizado").length;
  const valorTotalPeriodo = filtered
    .filter((c) => c.status === "autorizado")
    .reduce((s, c) => s + (c.valorPrestacao || 0), 0);

  const handleSave = () => {
    if (!form.numero) {
      toast({ title: "Informe o número do CTe", variant: "destructive" });
      return;
    }
    if (editing) {
      update(editing.id, form);
      toast({ title: "CTe atualizado!" });
    } else {
      add(form);
      toast({ title: "CTe cadastrado!" });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleEdit = (c: CTe) => {
    setEditing(c);
    setForm(c);
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
    toast({ title: "CTe removido!" });
  };
  const setField = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleEmitir = async (cte: CTe) => {
    setEmitting(true);
    try {
      const payload = {
        numero: cte.numero,
        serie: cte.serie,
        veiculoPlaca: cte.veiculoPlaca,
        dataEmissao: cte.dataEmissao,
        valorPrestacao: cte.valorPrestacao,
        remetente: {
          nome: cte.remetenteNome,
          cnpjCpf: cte.remetenteCnpjCpf,
          municipio: cte.remetenteMunicipio,
          uf: cte.remetenteUf,
        },
        destinatario: {
          nome: cte.destinatarioNome,
          cnpjCpf: cte.destinatarioCnpjCpf,
          municipio: cte.destinatarioMunicipio,
          uf: cte.destinatarioUf,
        },
      };
      const result = await cteApi.emitir(payload, ambienteAtual);
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.chave) {
        update(cte.id, { chave: result.chave, status: "autorizado", protocolo: result.protocolo });
        toast({ title: `CTe autorizado na SEFAZ (${ambienteAtual === "producao" ? "Produção" : "Homologação"})!` });
      }
    } catch (e: unknown) {
      toast({
        title: "Falha ao emitir CTe",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setEmitting(false);
    }
  };

  const handleConsultar = async (cte: CTe) => {
    if (!cte.chave) {
      toast({ title: "CTe sem chave para consulta", variant: "destructive" });
      return;
    }
    setConsulting(cte.id);
    try {
      const result = await cteApi.consultar(cte.chave, ambienteAtual);
      if (result.error) {
        throw new Error(result.error);
      }
      update(cte.id, {
        status: result.status === "100" ? "autorizado" : "erro",
        protocolo: result.protocolo,
      });
      toast({ title: `Consulta realizada (${ambienteAtual === "producao" ? "Produção" : "Homologação"}).` });
    } catch (e: unknown) {
      toast({
        title: "Falha na consulta",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setConsulting(null);
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v) setForm((prev) => ({ ...prev, veiculoPlaca: v.placa, veiculoModelo: v.modelo }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">CT-e</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Conhecimento de Transporte Eletrônico — emissão e entradas de frete
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Novo CTe
        </button>
      </div>

      {tenant?.certificadoStatus === "nao_configurado" && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-700 dark:text-red-400" />
          <div className="flex-1 text-sm text-red-700 dark:text-red-400">
            <p className="mb-1 font-medium">Certificado digital não configurado</p>
            <p className="text-xs mb-2">
              Para emitir CTes na SEFAZ, você precisa fazer upload do certificado digital nas{" "}
              <Link to="/configuracoes" className="underline font-medium">
                Configurações da Empresa
              </Link>.
            </p>
          </div>
        </div>
      )}
      
      {tenant?.certificadoStatus === "expirado" && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-700 dark:text-orange-400" />
          <div className="flex-1 text-sm text-orange-700 dark:text-orange-400">
            <p className="mb-1 font-medium">Certificado digital expirado</p>
            <p className="text-xs mb-2">
              O certificado expirou em {tenant.certificadoValidoAte ? new Date(tenant.certificadoValidoAte).toLocaleDateString("pt-BR") : ""}. 
              Faça upload de um novo certificado nas{" "}
              <Link to="/configuracoes" className="underline font-medium">
                Configurações
              </Link>.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-700 dark:text-blue-400" />
        <div className="flex-1 text-sm text-blue-700 dark:text-blue-400">
          <p className="mb-1">
            Para emitir e consultar CTe na SEFAZ, configure a variável <code className="text-xs bg-muted px-1 rounded">CTE_API_URL</code> no Worker apontando para o backend PHP{" "}
            <a
              href="https://github.com/nfephp-org/sped-cte"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              nfephp-org/sped-cte
            </a>.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Shield className="w-3 h-3" />
            <span className="text-xs font-medium">
              Ambiente atual:{" "}
              <span className={`px-2 py-0.5 rounded ${
                ambienteAtual === "producao"
                  ? "bg-green-500/20 text-green-700 dark:text-green-400"
                  : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
              }`}>
                {ambienteAtual === "producao" ? "Produção" : "Homologação"}
              </span>
            </span>
            <Link
              to="/configuracoes"
              className="text-xs underline hover:no-underline"
            >
              (alterar)
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={FileText} title="Total de CT-es" value={String(items.length)} variant="default" />
        <KpiCard icon={FileText} title="Autorizados" value={String(totalAutorizados)} variant="success" />
        <KpiCard icon={FileText} title="Valor (filtro)" value={`R$ ${valorTotalPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} variant="info" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Buscar número, chave, remetente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs w-full bg-muted/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <select
          value={placaFilter}
          onChange={(e) => setPlacaFilter(e.target.value)}
          className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.placa}>
              {v.placa}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                {["Número", "Série", "Placa", "Emissão", "Remetente", "Destinatário", "Valor", "Status", "Ações"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 sm:px-5 py-2 sm:py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-primary">{c.numero}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.serie}</td>
                  <td className="px-5 py-3.5 text-sm font-mono text-foreground">{c.veiculoPlaca || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.dataEmissao}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground max-w-[120px] truncate" title={c.remetenteNome}>
                    {c.remetenteNome || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-foreground max-w-[120px] truncate" title={c.destinatarioNome}>
                    {c.destinatarioNome || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">
                    R$ {(c.valorPrestacao ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[c.status] || statusStyles.rascunho}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {c.status === "rascunho" && tenant?.certificadoStatus === "valido" && (
                        <button
                          onClick={() => handleEmitir(c)}
                          disabled={emitting}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors"
                          title="Emitir na SEFAZ"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "rascunho" && tenant?.certificadoStatus !== "valido" && (
                        <button
                          disabled
                          className="p-1.5 rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
                          title="Configure certificado digital para emitir"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {c.chave && (
                        <button
                          onClick={() => handleConsultar(c)}
                          disabled={consulting === c.id}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Consultar SEFAZ"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      )}
                      {c.receitaId && (
                        <Link
                          to={`/receitas?highlight=${c.receitaId}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Ver receita vinculada"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}
                      <button
                        onClick={() => setDeleteConfirm(c.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 sm:px-5 py-10 text-center text-muted-foreground">
                    Nenhum CTe encontrado
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
              {editing ? "Editar CTe" : "Novo CTe"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Veículo</label>
              <select
                value={vehicles.find((v) => v.placa === form.veiculoPlaca)?.id ?? ""}
                onChange={(e) => e.target.value && handleVehicleSelect(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">Selecione...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.modelo}
                  </option>
                ))}
              </select>
            </div>
            {[
              { label: "Número", key: "numero", placeholder: "000000001" },
              { label: "Série", key: "serie", placeholder: "1" },
              { label: "Data Emissão", key: "dataEmissao", type: "date" },
              { label: "Valor da Prestação (R$)", key: "valorPrestacao", type: "number" },
              { label: "Remetente (Nome)", key: "remetenteNome", span: true },
              { label: "Remetente CNPJ/CPF", key: "remetenteCnpjCpf" },
              { label: "Destinatário (Nome)", key: "destinatarioNome", span: true },
              { label: "Destinatário CNPJ/CPF", key: "destinatarioCnpjCpf" },
              { label: "Município Origem", key: "municipioOrigem" },
              { label: "UF Origem", key: "ufOrigem", placeholder: "SP" },
              { label: "Município Destino", key: "municipioDestino" },
              { label: "UF Destino", key: "ufDestino", placeholder: "MG" },
            ].map((f) => (
              <div key={f.key} className={f.span ? "col-span-1 sm:col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={((form as Record<string, unknown>)[f.key] as string) ?? ""}
                  onChange={(e) =>
                    setField(f.key, f.type === "number" ? Number(e.target.value) || 0 : e.target.value)
                  }
                  placeholder={f.placeholder}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            ))}
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

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Excluir CTe?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
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

export default Ctes;
