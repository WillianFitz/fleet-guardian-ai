import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { cteApi, api } from "@/lib/api";
import { useTenant } from "@/hooks/useTenant";

export default function BuscarChaveCTe() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const ambienteAtual = tenant?.ambienteCte || "homologacao";
  const [mode, setMode] = useState<"chave" | "sefaz" | "xml">("chave");
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);
  const [sefazLoading, setSefazLoading] = useState(false);
  const [sefazResult, setSefazResult] = useState<Array<any>>([]);
  // ler query param 'mode' para inicializar (ex: ?mode=sefaz)
  try {
    const qp = new URLSearchParams(window.location.search);
    const qm = qp.get("mode");
    if ((qm === "sefaz" || qm === "xml") && mode !== (qm as any)) setMode(qm as any);
  } catch {
    // ignore (SSR safety)
  }

  const handleBuscar = async () => {
    const digits = (chave || "").replace(/\D/g, "");
    if (digits.length !== 44) {
      toast({ title: "Chave inválida", description: "Informe 44 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const modelo = digits.slice(20, 22);
      if (modelo === "55") {
        // NF-e → criar rascunho de CTe a partir da NF-e
        const res = await cteApi.fromNfe(digits, ambienteAtual as "producao" | "homologacao");
        const id = res?.data?.id || res?.id || res?.data?.cteId;
        toast({ title: "Rascunho criado", description: "Abrindo formulário de CTe..." });
        if (id) {
          navigate(`/ctes?openDraftId=${id}`);
        } else {
          navigate("/ctes");
        }
        return;
      }

      // Outro modelo (CT-e etc.) → consultar e retornar dados para o formulário
      const res = await cteApi.consultar(digits, ambienteAtual as "producao" | "homologacao");
      // guardar resultado temporariamente para abrir no formulário
      try {
        localStorage.setItem("fleet_pending_cte", JSON.stringify(res || {}));
      } catch {
        // ignore
      }
      toast({ title: "Consulta realizada", description: "Abra o formulário de CT-e para revisar os dados." });
      navigate("/ctes");
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarSefaz = async () => {
    setSefazLoading(true);
    setSefazResult([]);
    try {
      const res = await cteApi.buscaNFeSefaz(ambienteAtual);
      if (res?.nfe) {
        setSefazResult(res.nfe);
        if (!res.nfe.length) {
          toast({ title: "Nenhuma NF-e encontrada", description: "Não foram encontradas NF-e para este CNPJ.", variant: "warning" });
        }
      } else {
        toast({ title: "Resposta inválida", description: "Nenhuma NF-e retornada.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao buscar na SEFAZ", description: e?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setSefazLoading(false);
    }
  };

  const handleSelectSefazItem = (item: any) => {
    try {
      localStorage.setItem("fleet_pending_cte", JSON.stringify({
        chaveNFe: item.chave,
        remetenteNome: item.xNomeEmit,
        destinatarioNome: item.xNomeDest,
        valorPrestacao: item.vNF,
        infCarga: [{ numero: item.nfe || "", produto: "Mercadoria", valor: item.vNF || 0, peso: 0, chave: item.chave }],
      }));
    } catch {
      // ignore
    }
    toast({ title: "NF-e selecionada", description: "Abrindo formulário de CTe..." });
    navigate("/ctes");
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-background p-4 pt-8">
      <div className="w-full max-w-3xl bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Buscar NF-e (SEFAZ)</h2>
            <p className="text-sm text-muted-foreground">Busque NF-e disponíveis para o CNPJ configurado no tenant.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMode("chave")} className={`px-3 py-1 rounded ${mode === "chave" ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground"}`}>Por chave</button>
            <button onClick={() => setMode("xml")} className={`px-3 py-1 rounded ${mode === "xml" ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground"}`}>Arquivo XML</button>
            <button onClick={() => setMode("sefaz")} className={`px-3 py-1 rounded ${mode === "sefaz" ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground"}`}>Buscar na SEFAZ</button>
          </div>
        </div>

        {mode === "chave" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              autoFocus
              value={chave}
              onChange={(e) => setChave(e.target.value.replace(/\D/g, "").slice(0, 44))}
              placeholder="Informe a chave da NF-e (44 dígitos)"
              className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition w-full"
            />
            <button
              onClick={handleBuscar}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        )}

        {mode === "sefaz" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={handleBuscarSefaz} disabled={sefazLoading} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {sefazLoading ? "Buscando..." : "Buscar notas do CNPJ"}
              </button>
              <div className="text-xs text-muted-foreground">Ambiente: {ambienteAtual === "producao" ? "Produção" : "Homologação"}</div>
            </div>

            {sefazResult.length > 0 && (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold">Chave</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold">NF-e</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold">Emitente</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold">Dest.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold">Valor</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold">Emissão</th>
                      <th className="px-3 py-2 text-xs font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sefazResult.map((r: any, idx: number) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">{r.chave || "—"}</td>
                        <td className="px-3 py-2">{r.nfe || "—"}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate">{r.xNomeEmit || r.emitente || "—"}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate">{r.xNomeDest || r.destinatario || "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">R$ {(r.vNF || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">{r.dhEmi ? String(r.dhEmi).split("T")[0] : (r.dEmi || "—")}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleSelectSefazItem(r)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Usar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {mode === "xml" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Arquivo XML da NF-e</label>
              <input
                type="file"
                accept=".xml,application/xml"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const txt = String(reader.result || "");
                    try {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(txt, "application/xml");
                      const extract = (tag: string) => doc.querySelector(tag)?.textContent?.trim() || "";
                      const extractFromParent = (parent: string, tag: string) => doc.querySelector(`${parent} ${tag}`)?.textContent?.trim() || "";
                      const ch = extract("chNFe") || extractFromParent("infNFe", "Id") || "";
                      const nnum = extract("nNF") || (ch ? ch.substr(25, 9) : "");
                      const xNomeEmit = extractFromParent("emit", "xNome") || extract("xNomeEmit") || "";
                      const xNomeDest = extractFromParent("dest", "xNome") || extract("xNomeDest") || "";
                      const vNFVal = extract("vNF") || extractFromParent("total", "vNF") || "0";
                      const vNF = Number(String(vNFVal).replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
                      const dhEmi = extract("dhEmi") || extract("dEmi") || "";
                      const placa = extract("placa") || "";
                      const emitCnpj = extractFromParent("emit", "CNPJ") || extract("CNPJ") || "";
                      const destCnpj = extractFromParent("dest", "CNPJ") || "";
                      const remetenteCep = extractFromParent("enderEmit", "CEP") || "";
                      const remetenteLogradouro = extractFromParent("enderEmit", "xLgr") || "";
                      const remetenteNumero = extractFromParent("enderEmit", "nro") || "";
                      const remetenteBairro = extractFromParent("enderEmit", "xBairro") || "";
                      const remetenteMunicipio = extractFromParent("enderEmit", "xMun") || "";
                      const remetenteUf = extractFromParent("enderEmit", "UF") || "";
                      const destinatarioCep = extractFromParent("enderDest", "CEP") || "";
                      const destinatarioLogradouro = extractFromParent("enderDest", "xLgr") || "";
                      const destinatarioNumero = extractFromParent("enderDest", "nro") || "";
                      const destinatarioBairro = extractFromParent("enderDest", "xBairro") || "";
                      const destinatarioMunicipio = extractFromParent("enderDest", "xMun") || "";
                      const destinatarioUf = extractFromParent("enderDest", "UF") || "";

                      const payload: any = {
                        fluxoOrigem: "nfe",
                        numero: nnum || "",
                        serie: "1",
                        chave: ch || "",
                        chaveNFe: ch || "",
                        numeroNota: nnum || "",
                        valorPrestacao: vNF || 0,
                        remetenteNome: xNomeEmit || "",
                        remetenteCnpjCpf: emitCnpj.replace(/\D/g, "") || "",
                        remetenteCep: remetenteCep.replace(/\D/g, "") || "",
                        remetenteLogradouro: remetenteLogradouro || "",
                        remetenteNumero: remetenteNumero || "",
                        remetenteBairro: remetenteBairro || "",
                        remetenteMunicipio: remetenteMunicipio || "",
                        remetenteUf: remetenteUf || "",
                        destinatarioNome: xNomeDest || "",
                        destinatarioCnpjCpf: destCnpj.replace(/\D/g, "") || "",
                        destinatarioCep: destinatarioCep.replace(/\D/g, "") || "",
                        destinatarioLogradouro: destinatarioLogradouro || "",
                        destinatarioNumero: destinatarioNumero || "",
                        destinatarioBairro: destinatarioBairro || "",
                        destinatarioMunicipio: destinatarioMunicipio || "",
                        destinatarioUf: destinatarioUf || "",
                        veiculoPlaca: placa ? String(placa).toUpperCase().replace(/[^A-Z0-9]/g, "") : "",
                        dataEmissao: dhEmi ? String(dhEmi).split("T")[0] : new Date().toISOString().split("T")[0],
                        infCarga: [
                          { numero: nnum || "", produto: "Mercadoria", valor: vNF || 0, peso: 0, chave: ch || "" }
                        ],
                        informacoesAdicionais: [],
                        tomador: "",
                        cfop: "5353",
                        valorFrete: 0,
                        hasExpedidor: false,
                        hasRecebedor: false,
                        emitirRetroativo: false,
                        textoNota: `Referente à NF-e ${nnum || ""} - CHAVE ${ch || ""}`,
                      };
                      // map origem/destino fields
                      payload.municipioOrigem = remetenteMunicipio || null;
                      payload.ufOrigem = remetenteUf || null;
                      payload.municipioDestino = destinatarioMunicipio || null;
                      payload.ufDestino = destinatarioUf || null;
                      // try to match vehicle from server-side vehicles list
                      try {
                        const vehicles = await api.list("vehicles");
                        const normalize = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                        if (payload.veiculoPlaca) {
                          const placaNorm = normalize(payload.veiculoPlaca);
                          const match = (vehicles || []).find((v: any) => normalize(v.placa) === placaNorm);
                          if (match) {
                            payload.veiculoId = match.id;
                            payload.veiculoModelo = match.modelo || null;
                            toast({ title: "Veículo encontrado", description: `Placa ${match.placa} selecionada automaticamente.` });
                          } else {
                            toast({
                              title: "Veículo não encontrado",
                              description: `Placa ${payload.veiculoPlaca} não corresponde a nenhum veículo cadastrado (${(vehicles || []).length} veículos).`,
                              variant: "warning",
                            });
                          }
                        }
                      } catch {
                        // ignore vehicle matching failures
                      }
                      // sanitize payload: keep only columns supported by D1 schema (camelCase keys)
                      const allowed = new Set([
                        "chave","numero","serie","veiculoPlaca","veiculoModelo","dataEmissao","dataInicioViagem",
                        "valorPrestacao","valorFrete","remetenteNome","remetenteCnpjCpf","remetenteCep","remetenteLogradouro",
                        "remetenteNumero","remetenteBairro","remetenteMunicipio","remetenteUf","destinatarioNome","destinatarioCnpjCpf",
                        "destinatarioCep","destinatarioLogradouro","destinatarioNumero","destinatarioBairro","destinatarioMunicipio",
                        "destinatarioUf","municipioOrigem","ufOrigem","municipioDestino","ufDestino","infCarga","informacoesAdicionais",
                        "tomador","numeroNota","hasExpedidor","hasRecebedor","cfop","emitirRetroativo","textoNota","status"
                      ]);
                      const filteredPayload: Record<string, any> = {};
                      for (const [k, v] of Object.entries(payload)) {
                        if (allowed.has(k)) filteredPayload[k] = v;
                      }

                      try {
                        localStorage.setItem("fleet_pending_cte", JSON.stringify(filteredPayload));
                      } catch {}
                      const created = await api.create("ctes", filteredPayload);
                      toast({ title: "Rascunho criado", description: "Abrindo formulário..." });
                      if (created?.id) {
                        navigate(`/ctes?openDraftId=${created.id}`);
                      } else {
                        navigate("/ctes");
                      }
                    } catch (err: any) {
                      toast({ title: "Erro ao importar XML", description: err?.message || "Arquivo inválido", variant: "destructive" });
                    }
                  };
                  reader.readAsText(f);
                  (e.target as HTMLInputElement).value = "";
                }}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground file:text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">Ao anexar o XML da NF-e, o sistema cria um rascunho de CT-e automaticamente.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

