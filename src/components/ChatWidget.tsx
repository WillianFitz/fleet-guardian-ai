import { Truck, Zap } from "lucide-react";
import { useCallback, useState, useRef, useEffect } from "react";

const WORKER_URL = "https://fleet-guardian-ai.willian-fitzbr.workers.dev";

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const getConversationId = () => {
    let convId = localStorage.getItem("agent_conversation_id");
    if (!convId) {
      try { convId = crypto.randomUUID().replace(/-/g, ""); } catch { convId = String(Date.now()); }
      localStorage.setItem("agent_conversation_id", convId);
    }
    return convId;
  };

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = localStorage.getItem("fleet_auth_token");
    const tenantId = localStorage.getItem("fleet_tenant_id");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!token && tenantId) headers["X-Tenant-Id"] = tenantId;
    return headers;
  };

  const send = useCallback(
    async (prompt?: string) => {
      const text = (prompt ?? input).trim();
      if (!text) return;
      setMessages((s) => [...s, { role: "user", text }]);
      setInput("");
      setLoading(true);

      try {
        const convId = getConversationId();
        const res = await fetch(`${WORKER_URL}/api/agent/chat`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ message: text, conversationId: convId })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          setMessages((s) => [...s, { role: "assistant", text: `Erro ${res.status}: ${errText || "Falha ao consultar o assistente."}` }]);
          return;
        }

        const j = await res.json().catch(() => null);
        const reply = j?.data?.text || "Sem resposta do assistente.";
        setMessages((s) => [...s, { role: "assistant", text: String(reply).trim() }]);
      } catch (e: any) {
        setMessages((s) => [...s, { role: "assistant", text: `Erro ao conectar: ${String(e?.message || e)}` }]);
      } finally {
        setLoading(false);
      }
    },
    [input]
  );

  useEffect(() => {
    if (open && boxRef.current) {
      const el = boxRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  return (
    <>
      <div className="fixed z-50 right-4 bottom-4 sm:right-6 sm:bottom-6">
        <div className="flex items-end">
          {open && (
            <div className="mr-2 hidden sm:block">
              <button
                className="px-3 py-1 text-xs rounded-md bg-card/80 border border-border shadow-sm text-foreground"
                onClick={() => setMinimized(!minimized)}
              >
                {minimized ? "Abrir" : "Minimizar"}
              </button>
            </div>
          )}
          <button
            aria-label="Abrir chat IA"
            title="IA & Insights"
            onClick={() => {
              setOpen((o) => !o);
              if (open) setMinimized(false);
            }}
            className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border border-primary/30 hover:scale-105 transition-transform"
          >
            <div className="relative">
              <Truck className="w-6 h-6 opacity-90" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <Zap className="w-3 h-3 text-primary" />
              </span>
            </div>
          </button>
        </div>

        {open && !minimized && (
          <div className="mt-3">
            <div
              className="bg-card/95 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col w-[92vw] max-w-lg md:w-96 md:max-w-md"
              style={{ backdropFilter: "blur(6px)" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-semibold text-foreground">Fleet Guardian AI</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Pergunte sobre custos, combustível, motoristas e mais</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMinimized(true)} className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10">Minimizar</button>
                  <button onClick={() => { setOpen(false); setMinimized(false); }} className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10">Fechar</button>
                </div>
              </div>

              <div ref={boxRef} className="p-4 max-h-[60vh] overflow-auto space-y-3 bg-background/40">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2 space-y-1">
                    <p className="font-medium text-foreground">Exemplos de perguntas:</p>
                    {[
                      "Combustível do ABC-1234 nos últimos 30 dias",
                      "Qual o km/L do meu caminhão ABC-1234?",
                      "Quais postos de gasolina foram usados?",
                      "Quantos motoristas ativos tenho?",
                      "Quais despesas tive em fevereiro?",
                    ].map((ex) => (
                      <button
                        key={ex}
                        className="block w-full text-left px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 text-xs transition-colors"
                        onClick={() => send(ex)}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`${m.role === "user" ? "bg-primary text-white" : "bg-card/20 text-foreground"} max-w-[85%] px-4 py-2 rounded-2xl shadow-sm whitespace-pre-wrap text-sm`}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-card/20 text-foreground px-4 py-2 rounded-2xl shadow-sm text-sm animate-pulse">
                      Consultando dados...
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border bg-background/60">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={2}
                    className="flex-1 resize-none h-14 px-3 py-2 rounded-md border border-border focus:outline-none bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="Pergunte algo sobre sua frota..."
                    disabled={loading}
                  />
                  <button
                    className="bg-primary text-white px-4 py-2 rounded-md shadow hover:brightness-95 disabled:opacity-50"
                    onClick={() => send()}
                    disabled={loading}
                  >
                    {loading ? "..." : "Enviar"}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Dados em tempo real do banco de dados da sua frota.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatWidget;
