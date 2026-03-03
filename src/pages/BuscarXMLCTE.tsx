import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useTenant } from "@/hooks/useTenant";

export default function BuscarXMLCTE() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const ambienteAtual = tenant?.ambienteCte || "homologacao";

  return (
    <div className="flex items-start justify-center p-4 pt-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Importar NF-e via XML</h2>
            <p className="text-sm text-muted-foreground">Selecione o arquivo XML da NF-e para criar um rascunho de CT-e (fluxo idêntico ao por chave).</p>
          </div>
        </div>

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
                      const apiModule = await import("@/lib/api");
                      const res = await apiModule.cteApi.importXml(txt);
                      // Tentar extrair dados do rascunho criado (res.data)
                      const created = res?.data || res || {};
                      // Função helper: cria cliente se não existir
                      const ensureClient = async (cnpjCpf?: string, nome?: string, municipio?: string, uf?: string) => {
                        if (!cnpjCpf) return;
                        const cleaned = String(cnpjCpf).replace(/\D/g, "");
                        if (!cleaned) return;
                        try {
                          const existing = await apiModule.api.list("clients");
                          const found = (existing || []).find((c: any) => (String(c.cnpjCpf || "").replace(/\D/g, "") === cleaned));
                          if (!found) {
                            const payload = {
                              nome: nome || "",
                              cnpjCpf: cleaned,
                              municipio: municipio || "",
                              uf: uf || "",
                            };
                            try {
                              await apiModule.api.create("clients", payload);
                            } catch {
                              // ignore create errors
                            }
                          }
                        } catch {
                          // ignore list errors
                        }
                      };

                      // Remetente / destinatário do rascunho
                      await ensureClient(created.remetenteCnpjCpf || created.remetenteCnpj || created.remetenteCnpjCpf, created.remetenteNome || created.remetente_nome, created.remetenteMunicipio || created.remetente_municipio, created.remetenteUf || created.remetente_uf);
                      await ensureClient(created.destinatarioCnpjCpf || created.destinatarioCnpj || created.destinatarioCnpjCpf, created.destinatarioNome || created.destinatario_nome, created.destinatarioMunicipio || created.destinatario_municipio, created.destinatarioUf || created.destinatario_uf);

                      const id = created?.id || res?.id || created?.cteId;
                      toast({ title: "Rascunho criado", description: "Abrindo formulário de CTe..." });
                      if (id) {
                        navigate(`/ctes?openDraftId=${id}`);
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
      </div>
    </div>
  );
}

