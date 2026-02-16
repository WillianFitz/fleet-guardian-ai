import { Settings, Trash2, Database, Building2, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { isApiConfigured } from "@/lib/api";

const Configuracoes = () => {
  const { tenant, loading, updateTenant } = useTenant();
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        nome: tenant.nome || "",
        cnpj: tenant.cnpj || "",
        telefone: tenant.telefone || "",
        email: tenant.email || "",
        endereco: tenant.endereco || "",
      });
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!form.nome || !form.cnpj) {
      toast({ title: "Preencha Razão Social e CNPJ", variant: "destructive" });
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ *</label>
            <input
              value={form.cnpj}
              onChange={(e) => setField("cnpj", e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
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
