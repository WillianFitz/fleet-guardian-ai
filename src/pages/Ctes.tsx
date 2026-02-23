import { useState, useEffect } from "react";
import { FileText, Plus, Edit, Trash2, Send, Search, AlertCircle, ExternalLink, Shield, FileCheck, Truck, Package, FileSignature, Loader2, FileCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useStore from "@/hooks/useStore";
import { CTe, Vehicle, FluxoOrigemCTe } from "@/types/fleet";
import { demoCtes, demoVehicles } from "@/data/demoData";
import { toast } from "@/hooks/use-toast";
import { api, cteApi } from "@/lib/api";
import { useTenant } from "@/hooks/useTenant";
import KpiCard from "@/components/dashboard/KpiCard";
import { Link, useNavigate, useLocation } from "react-router-dom";

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

const fluxoOptions: { id: FluxoOrigemCTe; label: string; desc: string; icon: typeof FileCheck }[] = [
  { id: "nfe", label: "Tenho Nota Fiscal Eletrônica", desc: "Chave NFe, XML ou busca SEFAZ", icon: FileCheck },
  { id: "cte_outro", label: "Tenho CT-e de outra transportadora", desc: "Subcontratação, redespacho ou redespacho intermediário", icon: Truck },
  { id: "nota_talao", label: "Tenho nota de produtos", desc: "Nota fiscal de talão", icon: Package },
  { id: "outros", label: "Tenho outro documento", desc: "Declaração, CF-e/SAT, NFC-e ou outros", icon: FileSignature },
];

const emptyForm: Omit<CTe, "id"> = {
  chave: "",
  numero: "",
  serie: "1",
  fluxoOrigem: "manual",
  veiculoPlaca: "",
  veiculoModelo: "",
  dataEmissao: new Date().toISOString().split("T")[0],
  dataInicioViagem: "",
  valorPrestacao: 0,
  valorFrete: 0,
  remetenteNome: "",
  remetenteCnpjCpf: "",
  remetenteCep: "",
  remetenteLogradouro: "",
  remetenteNumero: "",
  remetenteBairro: "",
  remetenteMunicipio: "",
  remetenteUf: "",
  destinatarioNome: "",
  destinatarioCnpjCpf: "",
  destinatarioCep: "",
  destinatarioLogradouro: "",
  destinatarioNumero: "",
  destinatarioBairro: "",
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
  // novos campos
  infCarga: [],
  informacoesAdicionais: [],
  tomador: "",
  numeroNota: "",
  hasExpedidor: false,
  hasRecebedor: false,
  cfop: "5353",
  emitirRetroativo: false,
  textoNota: "",
};

const Ctes = () => {
  const { items, add, update, remove } = useStore<CTe>("ctes", demoCtes);
  const { items: vehicles } = useStore<Vehicle>("vehicles", demoVehicles);
  const { items: clients, add: addClient, update: updateClient } = useStore<any>("clients", []);
  const { tenant } = useTenant();
  const ambienteAtual = tenant?.ambienteCte || "homologacao";
  const navigate = useNavigate();
  const location = useLocation();
  // inline busca por chave foi movida para página dedicada (/ctes/buscar-chave)
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClientType, setEditClientType] = useState<"remetente" | "destinatario" | null>(null);
  const [editClientForm, setEditClientForm] = useState({
    nome: "",
    cnpjCpf: "",
    indicadorIE: "",
    ie: "",
    contato: "",
    telefone: "",
  });
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
  const [showFluxoPicker, setShowFluxoPicker] = useState(false);
  /** Quando true, o dialog mostra só os 3 botões (Chave/XML/SEFAZ) antes do formulário de cadastro */
  const [showNfeTipoStep, setShowNfeTipoStep] = useState(false);
  const [nfeOrigemTipo, setNfeOrigemTipo] = useState<"xml" | "chave" | "sefaz">("chave");
  const [nfeSefazLoading, setNfeSefazLoading] = useState(false);
  const [nfeSefazResult, setNfeSefazResult] = useState<Array<{ chave: string; nfe: string; dhEmi: string; xNomeEmit: string; xNomeDest: string; vNF: number }>>([]);
  const [nfeSefazUltNSU, setNfeSefazUltNSU] = useState<number>(0);
  const [nfeSefazMaxNSU, setNfeSefazMaxNSU] = useState<number>(0);

  const buscarCep = async (cep: string, tipo: "remetente" | "destinatario") => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "Digite um CEP com 8 dígitos.",
        variant: "destructive",
      });
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
        return;
      }
      setForm((prev) => {
        if (tipo === "remetente") {
          return {
            ...prev,
            remetenteCep: digits,
            remetenteLogradouro: data.logradouro || prev.remetenteLogradouro,
            remetenteBairro: data.bairro || prev.remetenteBairro,
            remetenteMunicipio: data.localidade || prev.remetenteMunicipio,
            remetenteUf: data.uf || prev.remetenteUf,
            municipioOrigem: prev.municipioOrigem || data.localidade || prev.municipioOrigem,
            ufOrigem: prev.ufOrigem || data.uf || prev.ufOrigem,
          };
        }
        return {
          ...prev,
          destinatarioCep: digits,
          destinatarioLogradouro: data.logradouro || prev.destinatarioLogradouro,
          destinatarioBairro: data.bairro || prev.destinatarioBairro,
          destinatarioMunicipio: data.localidade || prev.destinatarioMunicipio,
          destinatarioUf: data.uf || prev.destinatarioUf,
          municipioDestino: prev.municipioDestino || data.localidade || prev.municipioDestino,
          ufDestino: prev.ufDestino || data.uf || prev.ufDestino,
        };
      });
    } catch (e) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível consultar o CEP. Tente novamente.",
        variant: "destructive",
      });
    }
  };

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
    const auto = `PLACA DO VEICULO ${form.veiculoPlaca || ""} REFERENTE A CONTROLE DE CTE Nº ${form.numero || ""}, REFERENTE A NOTA Nº ${form.numeroNota || ""}`;
    const newForm = { ...form, textoNota: form.textoNota && form.textoNota.trim() ? form.textoNota : auto };

    if (editing) {
      update(editing.id, newForm);
      toast({ title: "CTe atualizado!" });
    } else {
      add(newForm);
      toast({ title: "CTe cadastrado!" });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setShowNfeTipoStep(false);
  };

  const handleEdit = (c: CTe) => {
    setEditing(c);
    setForm(c);
    setShowNfeTipoStep(false);
    setDialogOpen(true);
  };
  const handleNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowFluxoPicker(true);
  };

  // Parseador simples de XML de CT-e para extrair cargas / documentos
  function parseCteXml(xmlText: string, chave?: string) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "application/xml");
      // Extrair emitente/destinatário
      const rem = doc.querySelector("rem, emit, emitente");
      const dest = doc.querySelector("dest, destinatario");
      const emitenteNome = rem?.querySelector("xNome")?.textContent || rem?.querySelector("xNomeEmit")?.textContent || "";
      const destinatarioNome = dest?.querySelector("xNome")?.textContent || dest?.querySelector("xNomeDest")?.textContent || "";

      const items: Array<any> = [];

      // Procurar por nós de documento/carga comuns
      const infDocs = Array.from(doc.querySelectorAll("infDoc, infDocRef, infNFe, infNFeSupl, infOutros, infCarga, carga, infQ, infQUnid"));
      if (infDocs.length) {
        infDocs.forEach((nd) => {
          const numero = nd.querySelector("nDoc, nNF, nNFref, nNf, nNFref")?.textContent || nd.querySelector("nFat")?.textContent || "";
          const nomeProd = nd.querySelector("xNome, xProd, xDesc, descricao, desc")?.textContent || "";
          const valorText = nd.querySelector("vDocFisc, vNF, vMerc, vProd, vCarga")?.textContent || "";
          const pesoText = nd.querySelector("qCarga, pesoB, peso, pesoBruto, pesoLiquido")?.textContent || "";
          const valor = valorText ? Number(valorText) : 0;
          const peso = pesoText ? Number(pesoText) : 0;
          items.push({
            numero: numero || chave || "",
            produto: nomeProd || "",
            valor,
            peso,
            chave: chave || "",
          });
        });
      }

      // Fallback: se não encontrou cargas, criar um item único usando valores do XML (vPrest / vTPrest)
      if (items.length === 0) {
        const vPrest = doc.querySelector("vPrest, vTPrest, vRec, vRecTot")?.textContent;
        const valor = vPrest ? Number(vPrest) : 0;
        items.push({
          numero: "",
          produto: "",
          valor,
          peso: 0,
          chave: chave || "",
          emitenteNome,
          destinatarioNome,
        });
      }

      return { items, emitenteNome, destinatarioNome };
    } catch (e) {
      return { items: [], emitenteNome: "", destinatarioNome: "" };
    }
  }

  // Busca por chave removida do modal — usa página dedicada.

  // resumoBuscar removido — função relacionada à busca inline eliminada

  const openClientEditor = (type: "remetente" | "destinatario") => {
    setEditClientType(type);
    setEditClientForm({
      nome: type === "remetente" ? (form.remetenteNome || "") : (form.destinatarioNome || ""),
      cnpjCpf: type === "remetente" ? (form.remetenteCnpjCpf || "") : (form.destinatarioCnpjCpf || ""),
      indicadorIE: "",
      ie: "",
      contato: "",
      telefone: "",
    });
    setEditClientOpen(true);
  };

  const saveClientEditor = () => {
    const payload = {
      nome: editClientForm.nome,
      cnpjCpf: editClientForm.cnpjCpf,
      indicadorIE: editClientForm.indicadorIE,
      ie: editClientForm.ie,
      contato: editClientForm.contato,
      telefone: editClientForm.telefone,
    };

    // salvar no store de clients: se existir por cnpjCpf atualiza, senão adiciona
    const existing = clients.find((c: any) => (c.cnpjCpf || "").replace(/\D/g, "") === (payload.cnpjCpf || "").replace(/\D/g, ""));
    if (existing) {
      updateClient(existing.id, payload);
    } else {
      addClient(payload);
    }

    if (editClientType === "remetente") {
      setForm((p) => ({
        ...p,
        remetenteNome: editClientForm.nome,
        remetenteCnpjCpf: editClientForm.cnpjCpf,
      }));
    } else if (editClientType === "destinatario") {
      setForm((p) => ({
        ...p,
        destinatarioNome: editClientForm.nome,
        destinatarioCnpjCpf: editClientForm.cnpjCpf,
      }));
    }

    setEditClientOpen(false);
    setEditClientType(null);
  };

  const handleFluxoSelect = (fluxo: FluxoOrigemCTe) => {
    setForm((prev) => ({ ...prev, fluxoOrigem: fluxo }));
    setNfeSefazResult([]);
    setNfeSefazUltNSU(0);
    setNfeSefazMaxNSU(0);
    setShowFluxoPicker(false);
    if (fluxo === "nfe") {
      setShowNfeTipoStep(true);
      setNfeOrigemTipo("chave");
    } else {
      setShowNfeTipoStep(false);
      setNfeOrigemTipo("chave");
    }
    setDialogOpen(true);
  };

  /** Escolheu como informar a NF-e (Chave/XML/SEFAZ) → vai para o formulário de cadastro */
  const handleNfeTipoSelect = (tipo: "xml" | "chave" | "sefaz") => {
    setNfeOrigemTipo(tipo);
    // Para SEFAZ: permanece neste passo para buscar/listar as NF-e do CNPJ.
    // Para Chave: abrir página dedicada para digitar a chave.
    // Para XML: avança direto para o cadastro do CT-e.
    if (tipo === "sefaz") return;
    if (tipo === "chave") {
      // Fechar diálogo e navegar para a página dedicada de busca por chave
      setDialogOpen(false);
      setShowNfeTipoStep(false);
      navigate("/ctes/buscar-chave");
      return;
    }
    // Para XML: avançar para o formulário de cadastro
    setShowNfeTipoStep(false);
  };

  // Checa se há CTe pendente vindo da página de busca por chave
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fleet_pending_cte");
      if (raw) {
        const pending = JSON.parse(raw);
        setForm((p) => ({ ...p, ...(pending || {}) }));
        setDialogOpen(true);
        localStorage.removeItem("fleet_pending_cte");
      }
    } catch {
      // ignore
    }
  }, []);

  // Abrir rascunho criado externamente (ex: /ctes?openDraftId=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const openId = params.get("openDraftId");
      if (openId) {
        const item = items.find((i) => i.id === openId);
        if (item) {
          // abrir diálogo para editar
          setEditing(item);
          setForm(item);
          setDialogOpen(true);
          // remover query param
          navigate("/ctes", { replace: true });
        }
      }
    } catch {
      // ignore
    }
  }, [location.search, items, navigate]);

  const handleBuscaNFeSefaz = async () => {
    // Se já consumimos até o maxNSU, não chamar de novo para evitar rejeição 656 (consumo indevido)
    if (nfeSefazMaxNSU && nfeSefazUltNSU >= nfeSefazMaxNSU) {
      toast({
        title: "Limite de consulta atingido",
        description: "A SEFAZ já informou que não há novos documentos (ultNSU = maxNSU). Aguarde cerca de 1 hora antes de nova consulta para evitar rejeição por consumo indevido (cStat 656).",
        variant: "destructive",
      });
      return;
    }
    setNfeSefazLoading(true);
    setNfeSefazResult([]);
    try {
      const res = await cteApi.buscaNFeSefaz(ambienteAtual, nfeSefazUltNSU || 0);
      setNfeSefazUltNSU(res.ultNSU ?? 0);
      setNfeSefazMaxNSU(res.maxNSU ?? 0);
      setNfeSefazResult(res.nfe || []);
      if (!res.nfe?.length) {
        const amb = ambienteAtual === "producao" ? "produção" : "homologação";
        toast({
          title: "Nenhuma NF-e encontrada na SEFAZ",
          description: `Consulta no ambiente ${amb}. Se suas notas são do outro ambiente, altere em Configurações → Ambiente SEFAZ e tente de novo. O certificado deve ser do mesmo CNPJ que emite ou recebe as NF-e.`,
          variant: "destructive",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      if (msg.toLowerCase().includes("consumo indevido") || msg.includes("cStat: 656") || msg.includes("cstat 656")) {
        toast({
          title: "SEFAZ bloqueou a consulta (cStat 656)",
          description: "A SEFAZ retornou consumo indevido. Aguarde cerca de 1 hora antes de tentar buscar NF-e novamente para este CNPJ.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro ao buscar NF-e", description: msg, variant: "destructive" });
      }
    } finally {
      setNfeSefazLoading(false);
    }
  };

  const handleSelectNFeSefaz = (item: { chave: string; xNomeEmit: string; xNomeDest: string; vNF: number }) => {
    setForm((prev) => ({
      ...prev,
      chaveNFe: item.chave,
      remetenteNome: item.xNomeEmit,
      destinatarioNome: item.xNomeDest,
      valorPrestacao: item.vNF,
    }));
    toast({ title: "NF-e selecionada", description: "Remetente, destinatário e valor preenchidos." });
    // Após escolher uma NF-e, avança para o formulário completo do CT-e.
    setShowNfeTipoStep(false);
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
      // Re-fetch tenant config to ensure ambiente is up-to-date (avoid stale UI state)
      let emitAmbiente = ambienteAtual;
      try {
        const tenantRes = await fetch(`${API_URL}/api/tenants/${(tenant?.id)}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (tenantRes.ok) {
          const tenantJson = await tenantRes.json();
          emitAmbiente = tenantJson.data?.ambienteCte || ambienteAtual;
        }
      } catch {
        // ignore, use existing ambienteAtual
      }

      const payload: Record<string, unknown> = {
        numero: cte.numero,
        serie: cte.serie,
        veiculoPlaca: cte.veiculoPlaca,
        dataEmissao: cte.dataEmissao,
        valorPrestacao: cte.valorPrestacao,
        fluxoOrigem: cte.fluxoOrigem || "manual",
        remetente: {
          nome: cte.remetenteNome,
          cnpjCpf: cte.remetenteCnpjCpf,
          cep: cte.remetenteCep,
          logradouro: cte.remetenteLogradouro,
          numero: cte.remetenteNumero,
          bairro: cte.remetenteBairro,
          municipio: cte.remetenteMunicipio,
          uf: cte.remetenteUf,
        },
        destinatario: {
          nome: cte.destinatarioNome,
          cnpjCpf: cte.destinatarioCnpjCpf,
          cep: cte.destinatarioCep,
          logradouro: cte.destinatarioLogradouro,
          numero: cte.destinatarioNumero,
          bairro: cte.destinatarioBairro,
          municipio: cte.destinatarioMunicipio,
          uf: cte.destinatarioUf,
        },
      };
      if (cte.chaveNFe) payload.chaveNFe = cte.chaveNFe;
      if (cte.chaveCTe) payload.chaveCTe = cte.chaveCTe;
      if (cte.tpServ) payload.tpServ = cte.tpServ;
      if (cte.infOutros) payload.infOutros = cte.infOutros;
      if (cte.infCarga) payload.infCarga = cte.infCarga;
      if (cte.informacoesAdicionais) payload.informacoesAdicionais = cte.informacoesAdicionais;
      if (cte.tomador) payload.tomador = cte.tomador;
      if (cte.numeroNota) payload.numeroNota = cte.numeroNota;
      if (cte.cfop) payload.cfop = cte.cfop;
      if (typeof cte.valorFrete !== "undefined") payload.valorFrete = cte.valorFrete;
      if (cte.emitirRetroativo) payload.emitirRetroativo = cte.emitirRetroativo;
      if (cte.textoNota) payload.textoNota = cte.textoNota;
      if (typeof cte.hasExpedidor !== "undefined") payload.hasExpedidor = cte.hasExpedidor;
      if (typeof cte.hasRecebedor !== "undefined") payload.hasRecebedor = cte.hasRecebedor;
      const result = await cteApi.emitir(payload, emitAmbiente as "producao" | "homologacao");
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
    if (v) {
      const normalizePlaca = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      setForm((prev) => ({ ...prev, veiculoPlaca: normalizePlaca(v.placa), veiculoModelo: v.modelo, veiculoId: v.id }));
    }
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
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleNew}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Novo CTe
          </button>
        </div>
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
                      {c.status === "rascunho" && tenant && tenant.certificadoStatus !== "nao_configurado" && tenant.certificadoStatus !== "invalido" && (
                        <button
                          onClick={() => handleEmitir(c)}
                          disabled={emitting}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors"
                          title="Emitir na SEFAZ"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {c.status === "rascunho" && (!tenant || tenant.certificadoStatus === "nao_configurado" || tenant.certificadoStatus === "invalido") && (
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

      <Dialog open={showFluxoPicker} onOpenChange={setShowFluxoPicker}>
        <DialogContent className="bg-card border-border w-full max-w-2xl mx-4 sm:mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-foreground">Como deseja criar o CT-e?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 mt-2">
            {fluxoOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleFluxoSelect(opt.id)}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 transition-colors text-left"
                >
                  <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => handleFluxoSelect("manual")}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-foreground">Preencher manualmente</p>
                <p className="text-xs text-muted-foreground">Remetente, destinatário, valor e demais dados</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setShowNfeTipoStep(false); }}>
        <DialogContent className="bg-card border-border w-full max-w-4xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-foreground">
              {editing ? "Editar CTe" : showNfeTipoStep ? "Novo CTe — Como informar a NF-e?" : `Novo CTe — ${fluxoOptions.find((f) => f.id === form.fluxoOrigem)?.label ?? (form.fluxoOrigem === "manual" ? "Preenchimento manual" : "Documento")}`}
            </DialogTitle>
          </DialogHeader>

          {/* Passo 1: Só os 3 botões — qual tipo de operação (Chave / XML / SEFAZ). Só depois vai para o cadastro. */}
          {form.fluxoOrigem === "nfe" && showNfeTipoStep && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">Escolha como deseja informar a Nota Fiscal Eletrônica. Em seguida você preenche veículo, remetente, destinatário e demais dados.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "chave" as const, label: "Chave de acesso", desc: "Informar os 44 dígitos da NFe", icon: FileText },
                  { id: "xml" as const, label: "Arquivo XML", desc: "Enviar o arquivo XML da NF-e", icon: FileCode },
                  { id: "sefaz" as const, label: "Buscar na SEFAZ", desc: "Consultar NF-e na Distribuição DFe", icon: Search },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleNfeTipoSelect(opt.id)}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/10 text-center transition-all"
                    >
                      <Icon className="w-8 h-8 text-primary" />
                      <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Ao selecionar "Chave de acesso" a navegação ocorre para a página dedicada de busca. */}
            </div>
          )}

          {/* Passo 2: Formulário de cadastro (veículo, remetente, destinatário, etc.) */}
          {!(form.fluxoOrigem === "nfe" && showNfeTipoStep) && (
          <>
          {/* Bloco NFe no topo do form: Chave/XML/SEFAZ já escolhido — campos para preencher */}
          {form.fluxoOrigem === "nfe" && (
            <div className="mt-2 mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
              <p className="text-sm font-semibold text-foreground">NF-e: {nfeOrigemTipo === "chave" ? "Chave de acesso" : nfeOrigemTipo === "xml" ? "Arquivo XML" : "Busca na SEFAZ"}</p>
              {/* A entrada direta da chave foi removida do modal; use a página dedicada se necessário. */}
              {nfeOrigemTipo === "xml" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Arquivo XML da NF-e</label>
                  <input
                    type="file"
                    accept=".xml,application/xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const r = new FileReader();
                        r.onload = () => {
                          const txt = r.result as string;
                          const m = txt.match(/<chNFe>(\d{44})<\/chNFe>/);
                          if (m) setField("chaveNFe", m[1]);
                          else toast({ title: "Chave não encontrada no XML", variant: "destructive" });
                        };
                        r.readAsText(f);
                      }
                    }}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground file:text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">A chave será extraída automaticamente do XML.</p>
                </div>
              )}
              {nfeOrigemTipo === "sefaz" && (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Chave da NF-e selecionada</label>
                      <input
                        value={form.chaveNFe ?? ""}
                        readOnly
                        placeholder="Selecione uma NF-e na etapa anterior (SEFAZ)"
                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNfeSefazResult([]); setShowNfeTipoStep(true); }}
                      className="mt-6 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      Trocar NF-e
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">A listagem e seleção das NF-e fica na etapa “Buscar na SEFAZ”.</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div className="col-span-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Veículo</label>
            <select
              value={form.veiculoId || (vehicles.find((v) => v.placa === form.veiculoPlaca)?.id ?? "")}
              onChange={(e) => {
                const vid = e.target.value;
                if (vid) {
                  const v = vehicles.find((x) => x.id === vid);
                  if (v) {
                    setForm((prev) => ({ ...prev, veiculoPlaca: v.placa, veiculoModelo: v.modelo, veiculoId: v.id }));
                  }
                }
              }}
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
          ].map((f) => (
            <div key={f.key}>
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
          {/* Campos adicionais solicitados: CFOP, Valor Frete, Tomador, Número da nota origem, toggles */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CFOP</label>
            <select value={form.cfop ?? "5353"} onChange={(e) => setField("cfop", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione CFOP...</option>
              <option value="5353">5353 - Serviço de Transporte de Cargas</option>
              <option value="5254">5254 - Remessa p/ industrialização</option>
              <option value="5933">5933 - Operações de transporte</option>
              <option value="0000">0000 - Outro / Manual</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">Sugestão automática: 5353 para CT-e originados de NF-e (ajuste conforme necessário).</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor do Frete (R$)</label>
            <input type="number" step="0.01" value={form.valorFrete ?? 0} onChange={(e) => setField("valorFrete", Number(e.target.value) || 0)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tomador</label>
            <select value={form.tomador ?? ""} onChange={(e) => setField("tomador", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              <option value="remetente">Remetente</option>
              <option value="destinatario">Destinatário</option>
              <option value="terceiro">Terceiro</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Número da nota origem</label>
            <input value={form.numeroNota ?? ""} onChange={(e) => setField("numeroNota", e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input id="hasExpedidor" type="checkbox" checked={!!form.hasExpedidor} onChange={(e) => setField("hasExpedidor", e.target.checked)} />
              <label htmlFor="hasExpedidor" className="text-xs text-muted-foreground">Tem Expedidor</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="hasRecebedor" type="checkbox" checked={!!form.hasRecebedor} onChange={(e) => setField("hasRecebedor", e.target.checked)} />
              <label htmlFor="hasRecebedor" className="text-xs text-muted-foreground">Tem Recebedor</label>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <input id="emitirRetro" type="checkbox" checked={!!form.emitirRetroativo} onChange={(e) => setField("emitirRetroativo", e.target.checked)} />
              <label htmlFor="emitirRetro" className="text-xs text-muted-foreground">Emitir retroativo</label>
            </div>
          </div>
          {/* Informações Adicionais */}
          <div className="col-span-1 sm:col-span-2 mt-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Informações Adicionais</label>
            <div className="space-y-2">
              {(form.informacoesAdicionais || []).map((info: string, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <input value={info} onChange={(e) => setForm((p) => ({ ...p, informacoesAdicionais: (p.informacoesAdicionais || []).map((x, i) => i === idx ? e.target.value : x) }))} className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, informacoesAdicionais: (p.informacoesAdicionais || []).filter((_, i) => i !== idx) }))} className="px-2 rounded-lg border">Remover</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((p) => ({ ...p, informacoesAdicionais: [...(p.informacoesAdicionais || []), ""] }))} className="px-3 py-2 rounded-lg bg-muted/20 border border-border text-sm">Adicionar mais informações</button>
            </div>
          </div>
          {/* Texto automático para nota */}
          <div className="col-span-1 sm:col-span-2 mt-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Texto da nota (automático)</label>
            <div className="flex gap-2">
              <input value={form.textoNota ?? ""} onChange={(e) => setField("textoNota", e.target.value)} className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
              <button type="button" onClick={() => {
                const txt = `PLACA DO VEICULO ${form.veiculoPlaca || ""} REFERENTE A CONTROLE DE CTE Nº ${form.numero || ""}, REFERENTE A NOTA Nº ${form.numeroNota || ""}`;
                setField("textoNota", txt);
              }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Gerar</button>
            </div>
          </div>
          <div className="col-span-1 sm:col-span-2 mt-2">
            <p className="text-xs font-semibold text-muted-foreground">Remetente</p>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
            <div className="flex gap-2">
              <input
                value={form.remetenteNome}
                onChange={(e) => setField("remetenteNome", e.target.value)}
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => openClientEditor("remetente")}
                className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                Editar
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ/CPF</label>
            <input
              value={form.remetenteCnpjCpf ?? ""}
              onChange={(e) => setField("remetenteCnpjCpf", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CEP</label>
            <div className="flex gap-2">
              <input
                value={form.remetenteCep ?? ""}
                onChange={(e) => setField("remetenteCep", e.target.value)}
                onBlur={(e) => e.target.value && buscarCep(e.target.value, "remetente")}
                placeholder="00000-000"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Endereço</label>
            <input
              value={form.remetenteLogradouro ?? ""}
              onChange={(e) => setField("remetenteLogradouro", e.target.value)}
              placeholder="Rua / Avenida"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Número</label>
            <input
              value={form.remetenteNumero ?? ""}
              onChange={(e) => setField("remetenteNumero", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Bairro</label>
            <input
              value={form.remetenteBairro ?? ""}
              onChange={(e) => setField("remetenteBairro", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Município</label>
            <input
              value={form.remetenteMunicipio ?? ""}
              onChange={(e) => setField("remetenteMunicipio", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">UF</label>
            <input
              value={form.remetenteUf ?? ""}
              onChange={(e) => setField("remetenteUf", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="SP"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="col-span-1 sm:col-span-2 mt-2">
            <p className="text-xs font-semibold text-muted-foreground">Destinatário</p>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
            <div className="flex gap-2">
              <input
                value={form.destinatarioNome}
                onChange={(e) => setField("destinatarioNome", e.target.value)}
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => openClientEditor("destinatario")}
                className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                Editar
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ/CPF</label>
            <input
              value={form.destinatarioCnpjCpf ?? ""}
              onChange={(e) => setField("destinatarioCnpjCpf", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CEP</label>
            <input
              value={form.destinatarioCep ?? ""}
              onChange={(e) => setField("destinatarioCep", e.target.value)}
              onBlur={(e) => e.target.value && buscarCep(e.target.value, "destinatario")}
              placeholder="00000-000"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Endereço</label>
            <input
              value={form.destinatarioLogradouro ?? ""}
              onChange={(e) => setField("destinatarioLogradouro", e.target.value)}
              placeholder="Rua / Avenida"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Número</label>
            <input
              value={form.destinatarioNumero ?? ""}
              onChange={(e) => setField("destinatarioNumero", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Bairro</label>
            <input
              value={form.destinatarioBairro ?? ""}
              onChange={(e) => setField("destinatarioBairro", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Município</label>
            <input
              value={form.destinatarioMunicipio ?? ""}
              onChange={(e) => setField("destinatarioMunicipio", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">UF</label>
            <input
              value={form.destinatarioUf ?? ""}
              onChange={(e) => setField("destinatarioUf", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="SP"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="col-span-1 sm:col-span-2 mt-2">
            <p className="text-xs font-semibold text-muted-foreground">Origem/Destino (para fins de chave e rota)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Município Origem</label>
            <input
              value={form.municipioOrigem ?? ""}
              onChange={(e) => setField("municipioOrigem", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">UF Origem</label>
            <input
              value={form.ufOrigem ?? ""}
              onChange={(e) => setField("ufOrigem", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="SP"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Município Destino</label>
            <input
              value={form.municipioDestino ?? ""}
              onChange={(e) => setField("municipioDestino", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">UF Destino</label>
            <input
              value={form.ufDestino ?? ""}
              onChange={(e) => setField("ufDestino", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="MG"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Campos adicionais por fluxo (NFe já está no topo do dialog) */}
          {form.fluxoOrigem === "cte_outro" && (
            <>
              <div className="col-span-1 sm:col-span-2 mt-2">
                <p className="text-xs font-semibold text-muted-foreground">CT-e de outra transportadora</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Chave de acesso do CT-e (44 dígitos)</label>
                <input
                  value={form.chaveCTe ?? ""}
                  onChange={(e) => setField("chaveCTe", e.target.value.replace(/\D/g, "").slice(0, 44))}
                  placeholder="Chave do CT-e da transportadora anterior"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de serviço</label>
                <select
                  value={form.tpServ ?? "1"}
                  onChange={(e) => setField("tpServ", e.target.value as "1" | "2" | "3")}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="1">Subcontratação</option>
                  <option value="2">Redespacho</option>
                  <option value="3">Redespacho Intermediário</option>
                </select>
              </div>
            </>
          )}
          {form.fluxoOrigem === "outros" && (
            <>
              <div className="col-span-1 sm:col-span-2 mt-2">
                <p className="text-xs font-semibold text-muted-foreground">Outro documento</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de documento</label>
                <select
                  value={form.infOutros?.tpDoc ?? "99"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      infOutros: { ...(p.infOutros || { tpDoc: "99", descOutros: "", nDoc: "", vDocFisc: 0, dEmi: "" }), tpDoc: e.target.value as "00" | "04" | "05" | "99" },
                    }))
                  }
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="00">Declaração de conteúdo</option>
                  <option value="04">CF-e SAT (Cupom Fiscal Eletrônico)</option>
                  <option value="05">NFC-e (Nota Fiscal de Consumidor Eletrônica)</option>
                  <option value="99">Outros documentos</option>
                </select>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                <input
                  value={form.infOutros?.descOutros ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      infOutros: { ...(p.infOutros || { tpDoc: "99", descOutros: "", nDoc: "", vDocFisc: 0, dEmi: "" }), descOutros: e.target.value },
                    }))
                  }
                  placeholder="Ex: Declaração de conteúdo da carga"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Número do documento</label>
                <input
                  value={form.infOutros?.nDoc ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      infOutros: { ...(p.infOutros || { tpDoc: "99", descOutros: "", nDoc: "", vDocFisc: 0, dEmi: "" }), nDoc: e.target.value },
                    }))
                  }
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.infOutros?.vDocFisc ?? 0}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      infOutros: { ...(p.infOutros || { tpDoc: "99", descOutros: "", nDoc: "", vDocFisc: 0, dEmi: "" }), vDocFisc: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de emissão</label>
                <input
                  type="date"
                  value={form.infOutros?.dEmi ?? form.dataEmissao ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      infOutros: { ...(p.infOutros || { tpDoc: "99", descOutros: "", nDoc: "", vDocFisc: 0, dEmi: "" }), dEmi: e.target.value },
                    }))
                  }
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </>
          )}
          {form.fluxoOrigem === "nota_talao" && (
            <div className="col-span-1 sm:col-span-2 mt-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
              Nota fiscal de talão: preencha remetente, destinatário e valor. Os dados da NF de talão serão informados na emissão.
            </div>
          )}
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
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar cliente (Remetente / Destinatário) */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="bg-card border-border w-full max-w-md mx-4 sm:mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar {editClientType === "remetente" ? "Remetente" : "Destinatário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome</label>
              <input value={editClientForm.nome} onChange={(e) => setEditClientForm((p) => ({ ...p, nome: e.target.value }))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">CPF / CNPJ</label>
              <input value={editClientForm.cnpjCpf} onChange={(e) => setEditClientForm((p) => ({ ...p, cnpjCpf: e.target.value }))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Indicador IE</label>
                <input value={editClientForm.indicadorIE} onChange={(e) => setEditClientForm((p) => ({ ...p, indicadorIE: e.target.value }))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">IE</label>
                <input value={editClientForm.ie} onChange={(e) => setEditClientForm((p) => ({ ...p, ie: e.target.value }))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Contato</label>
                <input value={editClientForm.contato} onChange={(e) => setEditClientForm((p) => ({ ...p, contato: e.target.value }))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Telefone</label>
                <input value={editClientForm.telefone} onChange={(e) => setEditClientForm((p) => ({ ...p, telefone: e.target.value }))} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditClientOpen(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={saveClientEditor} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border w-full max-w-sm mx-4 sm:mx-auto p-4 sm:p-6">
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
