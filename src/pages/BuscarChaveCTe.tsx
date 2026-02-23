import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { cteApi } from "@/lib/api";
import { useTenant } from "@/hooks/useTenant";

export default function BuscarChaveCTe() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const ambienteAtual = tenant?.ambienteCte || "homologacao";
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-start justify-center bg-background p-4 pt-8">
      <div className="w-full max-w-lg sm:max-w-xl bg-card border border-border rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-2">Buscar por chave</h2>
        <p className="text-sm text-muted-foreground mb-4">Informe a chave da NF-e (44 dígitos) para criar um rascunho de CT-e ou consultar o documento.</p>
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
        <div className="mt-4 text-xs text-muted-foreground">
          <div>Ambiente: {ambienteAtual === "producao" ? "Produção" : "Homologação"}</div>
        </div>
      </div>
    </div>
  );
}

