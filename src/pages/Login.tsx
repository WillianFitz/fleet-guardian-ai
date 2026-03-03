import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buscarEmpresaPorCnpj, formatCnpjDisplay } from "@/lib/cnpj";

const Login = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register form (cadastro completo: dados buscados por CNPJ ou preenchidos manualmente)
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [uf, setUf] = useState("");
  const [nome, setNome] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ title: "Informe e-mail e senha", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast({ title: "Bem-vindo de volta!" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro ao entrar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarCnpj = async () => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Informe os 14 dígitos do CNPJ.", variant: "destructive" });
      return;
    }
    setLoadingCnpj(true);
    try {
      const dados = await buscarEmpresaPorCnpj(cnpj);
      if (dados) {
        setCompanyName(dados.razaoSocial);
        setTelefone(dados.telefone);
        setEndereco(dados.endereco);
        setUf(dados.uf);
        if (dados.email) setEmail(dados.email);
        setCnpj(formatCnpjDisplay(dados.cnpj));
        toast({ title: "Dados da empresa carregados", description: "Revise e complete o que faltar (ex.: e-mail)." });
      } else {
        toast({ title: "CNPJ não encontrado", description: "Preencha os dados manualmente.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CNPJ", description: "Preencha os dados manualmente.", variant: "destructive" });
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleRegister = async () => {
    if (!companyName || !cnpj || !email || !password) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (password !== passwordConfirm) {
      toast({ title: "As senhas não conferem", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const cnpjDigits = cnpj.replace(/\D/g, "");
      await register({
        companyName,
        cnpj: cnpjDigits,
        email,
        password,
        nome: nome || companyName,
        telefone: telefone || undefined,
        endereco: endereco || undefined,
        uf: uf || undefined,
      });
      toast({ title: "Conta criada com sucesso!" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro ao criar conta", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-4xl shadow-2xl shadow-black/60 grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-2xl border border-slate-800/60">

        {/* Painel esquerdo — imagem hero com overlay */}
        <div className="relative hidden md:flex flex-col justify-between overflow-hidden min-h-[520px]">
          {/* Imagem de fundo */}
          <img
            src="/hero.png"
            alt="Fleet Guardian AI"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Overlay escuro gradiente para legibilidade */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/30" />

          {/* Conteúdo sobre a imagem */}
          <div className="relative z-10 p-7 flex flex-col h-full justify-between">
            {/* Logo + nome no topo */}
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Fleet Guardian AI" style={{ mixBlendMode: "screen" }} className="w-10 h-10 object-contain" />
              <span className="text-base font-bold text-white tracking-tight">Fleet Guardian AI</span>
            </div>

            {/* Descrição e features na base */}
            <div>
              <h2 className="text-2xl font-extrabold text-white leading-tight mb-2">
                Gestão de frota<br />
                <span className="text-orange-400">inteligente e completa</span>
              </h2>
              <p className="text-sm text-slate-300 mb-5">
                Monitore veículos, motoristas, combustível, pneus e finanças em tempo real — com IA que responde suas dúvidas e identifica oportunidades de economia.
              </p>
              <div className="space-y-2">
                {[
                  { icon: "🚛", text: "Controle total da frota: veículos, manutenção e pneus" },
                  { icon: "⛽", text: "Abastecimento, km/L e custo por km automáticos" },
                  { icon: "🤖", text: "IA que analisa dados e responde suas perguntas" },
                  { icon: "📊", text: "CT-e, receitas, despesas e resultado financeiro" },
                  { icon: "🔔", text: "Alertas de CNH, seguro, licença e estoque mínimo" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-2 text-sm text-slate-200">
                    <span className="text-base leading-tight">{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 bg-slate-950">
          <div className="flex gap-2 mb-4 sm:mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Criar conta
            </button>
          </div>

          {mode === "login" ? (
            <>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">Acessar sua conta</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    placeholder="voce@empresa.com.br"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">
                Criar nova empresa
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Informe o CNPJ e clique em Buscar para preencher os dados da empresa automaticamente. Se não encontrar, cadastre manualmente.
              </p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ *</label>
                    <input
                      value={cnpj}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 14);
                        setCnpj(v.length === 14 ? formatCnpjDisplay(v) : v);
                      }}
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleBuscarCnpj}
                      disabled={loadingCnpj || cnpj.replace(/\D/g, "").length !== 14}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 text-primary border border-primary/40 text-sm font-medium hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      {loadingCnpj ? "Buscando..." : "Buscar"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Razão Social *</label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    placeholder="Nome da empresa (preenchido pela busca ou digite)"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">UF</label>
                    <select
                      value={uf}
                      onChange={(e) => setUf(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    >
                      <option value="">Selecione</option>
                      {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Endereço</label>
                  <input
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    placeholder="Rua, número, bairro, cidade - UF, CEP"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Seu nome *</label>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    placeholder="Nome do responsável"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                    placeholder="voce@empresa.com.br"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Senha
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Confirmar senha
                    </label>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Criando conta..." : "Criar conta e acessar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

