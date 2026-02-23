import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { cteApi } from "@/lib/api";
import { useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

function parseCteXml(xmlText: string, chave?: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const rem = doc.querySelector("rem, emit, emitente");
  const dest = doc.querySelector("dest, destinatario");
  const emitenteNome = rem?.querySelector("xNome")?.textContent || "";
  const destinatarioNome = dest?.querySelector("xNome")?.textContent || "";
  const items: any[] = [];
  const infDocs = Array.from(doc.querySelectorAll("infDoc, infNFe, infCarga, carga, infOutros"));
  if (infDocs.length) {
    infDocs.forEach((nd) => {
      const numero = nd.querySelector("nDoc, nNF, nFat")?.textContent || "";
      const nomeProd = nd.querySelector("xNome, xProd, descricao")?.textContent || "";
      const valorText = nd.querySelector("vDocFisc, vNF, vCarga, vProd")?.textContent || "";
      const pesoText = nd.querySelector("qCarga, peso, pesoBruto, pesoLiquido")?.textContent || "";
      const valor = valorText ? Number(valorText) : 0;
      const peso = pesoText ? Number(pesoText) : 0;
      items.push({ numero: numero || chave || "", produto: nomeProd || "", valor, peso, emitenteNome, destinatarioNome, chave: chave || "" });
    });
  } else {
    const vPrest = doc.querySelector("vPrest, vTPrest")?.textContent;
    const valor = vPrest ? Number(vPrest) : 0;
    items.push({ numero: "", produto: "", valor, peso: 0, emitenteNome, destinatarioNome, chave: chave || "" });
  }
  return { items, emitenteNome, destinatarioNome };
}

export default function BuscarChaveCTe() {
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const ambienteAtual = tenant?.ambienteCte || "homologacao";

  const handleBuscar = async () => {
    const digits = (chave || "").replace(/\D/g, "");
    if (digits.length !== 44) {
      toast({ title: "Chave inválida", description: "Informe 44 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      // Detecta o modelo (posições 21-22 na chave): '55' = NF-e, '57' = CT-e
      const modelo = digits.slice(20, 22);
      if (modelo === "55") {
        // NF-e → criar rascunho de CTe a partir da NF-e (passa ambiente do tenant)
        const created = await cteApi.fromNfe(digits, ambienteAtual);
        const cteData = created?.data ?? created;
        if (cteData && cteData.id) {
          toast({ title: "Rascunho criado", description: "CTe rascunho criado a partir da NF-e. Abrindo formulário..." });
          navigate(`/ctes?openDraftId=${cteData.id}`);
          return;
        } else {
          toast({ title: "Sucesso", description: "Rascunho criado, abra a lista de CT-e.", variant: "success" });
          navigate("/ctes");
          return;
        }
      } else {
        // CT-e ou outro → consulta direta de CT-e
        const res = await cteApi.consultar(digits, ambienteAtual);
        const xml = res.xml || res.raw || "";
        const parsed = parseCteXml(xml, digits);
        setResults(parsed.items || []);
        toast({ title: "CT-e consultado", description: `Encontradas ${parsed.items.length} entradas.` });
      }
    } catch (e: any) {
      const errMsg = e?.message || "Erro desconhecido";
      const body = e?.body ? JSON.stringify(e.body).slice(0, 1000) : "";
      toast({ title: "Falha na consulta", description: `${errMsg}${body ? ` — ${body}` : ""}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUsar = () => {
    // construir payload mínimo para pré-preencher formulário do CT-e
    const primeiro = results[0] || {};
    const pending = {
      chave: chave.replace(/\D/g, ""),
      chaveCTe: chave.replace(/\D/g, ""),
      numero: primeiro.numero || "",
      numeroNota: primeiro.numero || "",
      remetenteNome: primeiro.emitenteNome || "",
      destinatarioNome: primeiro.destinatarioNome || "",
      valorPrestacao: primeiro.valor || 0,
      infCarga: results,
    };
    localStorage.setItem("fleet_pending_cte", JSON.stringify(pending));
    navigate("/ctes");
    toast({ title: "CT-e importado", description: "Abra 'Novo CTe' e o formulário será pré-preenchido." });
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Buscar CT-e por Chave</h1>
      <div className="flex gap-2">
        <input value={chave} onChange={(e) => setChave(e.target.value.replace(/\D/g, "").slice(0, 44))} placeholder="44 dígitos" className="flex-1 p-2 border rounded" />
        <button onClick={handleBuscar} disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded">{loading ? "Buscando..." : "Buscar"}</button>
      </div>

      {results.length > 0 && (
        <>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Nº</th>
                  <th className="p-2 text-left">Produto</th>
                  <th className="p-2 text-left">Emitente</th>
                  <th className="p-2 text-left">Destinatário</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">Peso (kg)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-mono">{r.numero || "—"}</td>
                    <td className="p-2">{r.produto || "—"}</td>
                    <td className="p-2 max-w-[160px] truncate">{r.emitenteNome || "—"}</td>
                    <td className="p-2 max-w-[160px] truncate">{r.destinatarioNome || "—"}</td>
                    <td className="p-2 text-right">R$ {(Number(r.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">{Number(r.peso) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={handleUsar} className="px-4 py-2 rounded bg-primary text-primary-foreground">Próximo</button>
          </div>
        </>
      )}
    </div>
  );
}

