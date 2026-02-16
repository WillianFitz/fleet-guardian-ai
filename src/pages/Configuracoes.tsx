import { Settings, Trash2, Database, Building2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const Configuracoes = () => {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearData = () => {
    const keys = ["vehicles", "drivers", "maintenance", "fuel", "tires", "parts", "expenses", "licenses", "insurances", "incidents", "garage"];
    keys.forEach(k => localStorage.removeItem(`fleet_${k}`));
    toast({ title: "Dados limpos! Recarregando..." });
    setTimeout(() => window.location.reload(), 1000);
    setConfirmClear(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold text-foreground">Configurações</h1><p className="text-sm text-muted-foreground mt-1">Configurações do sistema</p></div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4"><Building2 className="w-5 h-5 text-primary" /><h3 className="text-sm font-semibold text-foreground">Empresa</h3></div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Razão Social", placeholder: "Nome da empresa" },
            { label: "CNPJ", placeholder: "00.000.000/0001-00" },
            { label: "Telefone", placeholder: "(00) 0000-0000" },
            { label: "E-mail", placeholder: "contato@empresa.com.br" },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <input placeholder={f.placeholder} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-primary" /><h3 className="text-sm font-semibold text-foreground">Banco de Dados</h3></div>
        <p className="text-sm text-muted-foreground mb-4">Os dados estão armazenados localmente (localStorage). Para produção, configure a API para Cloudflare Workers + D1.</p>
        <button onClick={() => setConfirmClear(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">
          <Trash2 className="w-4 h-4" /> Limpar Todos os Dados
        </button>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4"><Settings className="w-5 h-5 text-primary" /><h3 className="text-sm font-semibold text-foreground">Sistema</h3></div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><span className="text-foreground font-medium">Versão:</span> 1.0.0</p>
          <p><span className="text-foreground font-medium">Plataforma:</span> FleetCommand SaaS</p>
          <p><span className="text-foreground font-medium">Backend:</span> Cloudflare Workers + D1 (configurável)</p>
          <p><span className="text-foreground font-medium">Frontend:</span> React + TypeScript + Tailwind CSS</p>
        </div>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Confirmar Limpeza</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza? Todos os cadastros serão apagados permanentemente.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleClearData} className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors">Limpar Tudo</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
