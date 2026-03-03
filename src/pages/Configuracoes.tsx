import { Settings, Trash2, Database, Building2, Save, Loader2, Shield, AlertCircle, Upload, CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { isApiConfigured } from "@/lib/api";

const Configuracoes = () => {
  const { tenant, loading, updateTenant } = useTenant();
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    uf: "",
    telefone: "",
    email: "",
    endereco: "",
    ambienteCte: "homologacao" as "producao" | "homologacao",
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        nome: tenant.nome || "",
        cnpj: tenant.cnpj || "",
        uf: (tenant as any).uf || "",
        telefone: tenant.telefone || "",
        email: tenant.email || "",
        endereco: tenant.endereco || "",
        ambienteCte: (tenant.ambienteCte as "producao" | "homologacao") || "homologacao",
      });
    }
  }, [tenant]);

  const handleBuscarCnpj = async () => {
    const digits = (form.cnpj || "").replace(/\D/g, "");
    if (digits.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Informe os 14 dígitos do CNPJ.", variant: "destructive" });
      return;
    }
    setLoadingCnpj(true);
    try {
      const { buscarEmpresaPorCnpj, formatCnpjDisplay } = await import("@/lib/cnpj");
      const dados = await buscarEmpresaPorCnpj(form.cnpj);
      if (dados) {
        setForm((prev) => ({
          ...prev,
          nome: dados.razaoSocial || prev.nome,
          cnpj: formatCnpjDisplay(dados.cnpj),
          telefone: dados.telefone || prev.telefone,
          endereco: dados.endereco || prev.endereco,
          uf: dados.uf || prev.uf,
          email: dados.email || prev.email,
        }));
        toast({ title: "Dados da empresa carregados", description: "Revise e salve se estiver correto." });
      } else {
        toast({ title: "CNPJ não encontrado", description: "Preencha os dados manualmente.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CNPJ", description: "Preencha os dados manualmente.", variant: "destructive" });
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleSave = async () => {
    if (!form.nome || !form.cnpj || !form.uf) {
      toast({ title: "Preencha Razão Social, CNPJ e UF", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await updateTenant(form);
      toast({ title: "Dados da empresa atualizados com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAmbiente = async () => {
    setSaving(true);
    try {
      await updateTenant({ ambienteCte: form.ambienteCte });
      toast({ title: "Ambiente CT-e atualizado com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pfx') && !file.name.toLowerCase().endsWith('.p12')) {
        toast({ title: "Arquivo inválido", description: "Apenas arquivos .pfx ou .p12 são aceitos", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB
        toast({ title: "Arquivo muito grande", description: "Tamanho máximo: 10MB", variant: "destructive" });
        return;
      }
      setCertFile(file);
    }
  };

  const handleUploadCertificado = async () => {
    if (!certFile || !certPassword) {
      toast({ title: "Preencha todos os campos", description: "Selecione o arquivo e informe a senha", variant: "destructive" });
      return;
    }

    setUploadingCert(true);
    try {
      // Converter arquivo para base64
      const arrayBuffer = await certFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Validar certificado (chamar API para validar)
      let validationResult: any = null;
      try {
        const { api, isApiConfigured } = await import("@/lib/api");
        if (isApiConfigured()) {
          try {
            validationResult = await api.create("tenants/validar-certificado", {
              certificadoPfxBase64: base64,
              certificadoPassword: certPassword,
              cnpj: form.cnpj.replace(/\D/g, ''),
            });
          } catch (apiError) {
            console.warn("API de validação não disponível, salvando sem validação:", apiError);
          }
        }
      } catch (error) {
        console.warn("Erro ao validar certificado:", error);
      }

      if (validationResult) {
        if (validationResult.valido) {
          // Salvar certificado com validação
          await updateTenant({
            certificadoPfxBase64: base64,
            certificadoPassword: certPassword,
            certificadoStatus: validationResult.expirado ? "expirado" : "valido",
            certificadoValidoAte: validationResult.validoAte,
            certificadoCnpj: validationResult.cnpj,
          });
          toast({ title: "Certificado configurado e validado com sucesso!" });
        } else {
          toast({ title: "Certificado inválido", description: validationResult.mensagem || "Verifique o arquivo e a senha", variant: "destructive" });
          setUploadingCert(false);
          return;
        }
      } else {
        // Sem validação disponível, salvar mesmo assim
        await updateTenant({
          certificadoPfxBase64: base64,
          certificadoPassword: certPassword,
          certificadoStatus: "configurado",
        });
        toast({ title: "Certificado salvo. Validação será feita na próxima emissão." });
      }
      
      setCertFile(null);
      setCertPassword("");
      // Resetar input file
      const fileInput = document.getElementById('cert-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error("Erro ao salvar certificado:", error);
      toast({ title: "Erro ao salvar certificado", description: error.message, variant: "destructive" });
    } finally {
      setUploadingCert(false);
    }
  };

  const getCertStatusInfo = () => {
    if (!tenant?.certificadoStatus || tenant.certificadoStatus === "nao_configurado") {
      return { icon: XCircle, text: "Não configurado", color: "text-muted-foreground", bg: "bg-muted" };
    }
    if (tenant.certificadoStatus === "valido") {
      return { icon: CheckCircle2, text: "Válido", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" };
    }
    if (tenant.certificadoStatus === "expirado") {
      return { icon: Clock, text: "Expirado", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" };
    }
    if (tenant.certificadoStatus === "invalido") {
      return { icon: XCircle, text: "Inválido", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" };
    }
    return { icon: AlertCircle, text: "Configurado", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" };
  };

  const handleClearData = () => {
    const keys = ["vehicles", "drivers", "maintenance", "fuel", "tires", "parts", "expenses", "licenses", "insurances", "incidents", "garage"];
    keys.forEach(k => localStorage.removeItem(`fleet_${k}`));
    toast({ title: "Dados limpos! Recarregando..." });
    setTimeout(() => window.location.reload(), 1000);
    setConfirmClear(false);
  };

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Gerencie as configurações da empresa e do sistema</p>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Dados da Empresa</h3>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Razão Social *</label>
            <input
              value={form.nome}
              onChange={(e) => setField("nome", e.target.value)}
              placeholder="Nome da empresa"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ *</label>
              <input
                value={form.cnpj}
                onChange={(e) => setField("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <button
              type="button"
              onClick={handleBuscarCnpj}
              disabled={loadingCnpj || (form.cnpj || "").replace(/\D/g, "").length !== 14}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 text-primary border border-primary/40 text-sm font-medium hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loadingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loadingCnpj ? "Buscando..." : "Buscar por CNPJ"}
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">UF *</label>
            <select
              value={form.uf}
              onChange={(e) => setField("uf", e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">Selecione...</option>
              <option value="AC">AC</option>
              <option value="AL">AL</option>
              <option value="AP">AP</option>
              <option value="AM">AM</option>
              <option value="BA">BA</option>
              <option value="CE">CE</option>
              <option value="DF">DF</option>
              <option value="ES">ES</option>
              <option value="GO">GO</option>
              <option value="MA">MA</option>
              <option value="MT">MT</option>
              <option value="MS">MS</option>
              <option value="MG">MG</option>
              <option value="PA">PA</option>
              <option value="PB">PB</option>
              <option value="PR">PR</option>
              <option value="PE">PE</option>
              <option value="PI">PI</option>
              <option value="RJ">RJ</option>
              <option value="RN">RN</option>
              <option value="RS">RS</option>
              <option value="RO">RO</option>
              <option value="RR">RR</option>
              <option value="SC">SC</option>
              <option value="SP">SP</option>
              <option value="SE">SE</option>
              <option value="TO">TO</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => setField("telefone", e.target.value)}
              placeholder="(00) 0000-0000"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="contato@empresa.com.br"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Endereço</label>
            <input
              value={form.endereco}
              onChange={(e) => setField("endereco", e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">Certificado Digital CT-e</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                Faça upload do certificado digital (.pfx) para emitir CTes na SEFAZ
              </p>
            </div>
          </div>
        </div>
        
        {/* Status do Certificado */}
        {tenant && (
          <div className="mb-4 p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Status do Certificado:</span>
              {(() => {
                const statusInfo = getCertStatusInfo();
                const StatusIcon = statusInfo.icon;
                return (
                  <div className={`flex items-center gap-2 px-2 py-1 rounded ${statusInfo.bg}`}>
                    <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                    <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
                  </div>
                );
              })()}
            </div>
            {tenant.certificadoValidoAte && (
              <p className="text-xs text-muted-foreground">
                Válido até: {new Date(tenant.certificadoValidoAte).toLocaleDateString("pt-BR")}
              </p>
            )}
            {tenant.certificadoCnpj && (
              <p className="text-xs text-muted-foreground">
                CNPJ do certificado: {tenant.certificadoCnpj}
              </p>
            )}
          </div>
        )}

        {/* Upload de Certificado */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Arquivo do Certificado (.pfx ou .p12)</label>
            <input
              id="cert-file"
              type="file"
              accept=".pfx,.p12"
              onChange={handleCertFileChange}
              className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer"
            />
            {certFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Arquivo selecionado: {certFile.name} ({(certFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha do Certificado</label>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              placeholder="Digite a senha do certificado"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={handleUploadCertificado}
            disabled={!certFile || !certPassword || uploadingCert}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingCert ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {tenant?.certificadoStatus && tenant.certificadoStatus !== "nao_configurado" ? "Atualizar Certificado" : "Upload Certificado"}
              </>
            )}
          </button>
          {tenant?.certificadoStatus && tenant.certificadoStatus !== "nao_configurado" && (
            <button
              onClick={async () => {
                if (confirm("Tem certeza que deseja remover o certificado?")) {
                  await updateTenant({
                    certificadoPfxBase64: null,
                    certificadoPassword: null,
                    certificadoStatus: "nao_configurado",
                    certificadoValidoAte: null,
                    certificadoCnpj: null,
                  });
                  toast({ title: "Certificado removido" });
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remover Certificado
            </button>
          )}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">Ambiente CT-e</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                Escolha entre Homologação (testes) ou Produção (emissões reais)
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Ambiente SEFAZ</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setField("ambienteCte", "homologacao")}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  form.ambienteCte === "homologacao"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Homologação</span>
                </div>
                <p className="text-xs mt-1 opacity-75">Para testes e validação</p>
              </button>
              <button
                type="button"
                onClick={() => setField("ambienteCte", "producao")}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  form.ambienteCte === "producao"
                    ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Produção</span>
                </div>
                <p className="text-xs mt-1 opacity-75">Emissões reais na SEFAZ</p>
              </button>
            </div>
          </div>
          {form.ambienteCte === "producao" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs">
                <strong>Atenção:</strong> No ambiente de produção, os CTes emitidos serão válidos e terão efeito fiscal real.
                Certifique-se de que todos os dados estão corretos antes de emitir.
              </p>
            </div>
          )}
          <button
            onClick={handleSaveAmbiente}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Ambiente
              </>
            )}
          </button>
        </div>
      </div>

      {!isApiConfigured() && (
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Banco de Dados</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">
            Os dados estão armazenados localmente (localStorage). Para produção, configure a API para Cloudflare Workers + D1.
          </p>
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors w-full sm:w-auto justify-center"
          >
            <Trash2 className="w-4 h-4" /> Limpar Todos os Dados
          </button>
        </div>
      )}

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">Informações do Sistema</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div>
            <span className="text-muted-foreground">Versão:</span>
            <span className="text-foreground font-medium ml-2">1.0.0</span>
          </div>
          <div>
            <span className="text-muted-foreground">Backend:</span>
            <span className="text-foreground font-medium ml-2">
              {isApiConfigured() ? "Cloudflare Workers + D1" : "localStorage"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Frontend:</span>
            <span className="text-foreground font-medium ml-2">React + TypeScript + Tailwind CSS</span>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>
            <span className="text-success font-medium ml-2">Operacional</span>
          </div>
        </div>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="bg-card border-border max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-foreground">Confirmar Limpeza</DialogTitle>
          </DialogHeader>
          <p className="text-xs sm:text-sm text-muted-foreground">Tem certeza? Todos os cadastros serão apagados permanentemente.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleClearData}
              className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors"
            >
              Limpar Tudo
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
