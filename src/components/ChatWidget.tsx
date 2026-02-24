import { Truck, Zap } from "lucide-react";
import { useCallback, useState, useRef, useEffect } from "react";

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const send = useCallback(
    async (prompt?: string) => {
      const text = (prompt ?? input).trim();
      if (!text) return;
      setMessages((s) => [...s, { role: "user", text }]);
      setInput("");
      setLoading(true);
      try {
        // Try relative endpoint first (ideal when frontend and worker share origin)
        let res = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, includeData: true }),
        });

        // Fallback to direct Worker domain if relative call failed / returned non-OK
        if (!res || !res.ok) {
          try {
            res = await fetch("https://fleet-guardian-ai.willian-fitzbr.workers.dev/api/insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: text, includeData: true }),
            });
          } catch (e) {
            // keep original error path
          }
        }

        const j = await (res?.json ? res.json() : Promise.resolve(null));
        const assistant = j?.data?.assistant || j?.assistant || (j?.raw?.choices?.[0]?.message?.content ?? "Sem resposta.");
        setMessages((s) => [...s, { role: "assistant", text: String(assistant) }]);
      } catch (e) {
        setMessages((s) => [...s, { role: "assistant", text: "Erro ao consultar o serviço de Insights." }]);
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
      {/* Floating button */}
      <div className="fixed z-50 right-4 bottom-4">
        <div className="flex items-end">
          {open && (
            <div className="mr-2">
              <button
                className="px-3 py-1 text-xs rounded-md bg-card/80 border border-border shadow-sm"
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
            className="w-14 h-14 rounded-full bg-primary/90 hover:bg-primary/100 text-white flex items-center justify-center shadow-xl border border-primary/30"
          >
              <div className="relative">
                <Truck className="w-6 h-6 opacity-90" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <Zap className="w-3 h-3 text-primary" />
                </span>
              </div>
          </button>
        </div>

        {/* Chat box */}
        {open && !minimized && (
          <div className="mt-3 w-96 max-w-md">
            <div className="bg-card/90 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-semibold">IA & Insights</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Peça relatórios, métricas e recomendações para reduzir custos</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMinimized(true)} className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10">Minimizar</button>
                  <button onClick={() => { setOpen(false); setMinimized(false); }} className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10">Fechar</button>
                </div>
              </div>

              <div ref={boxRef} className="p-4 max-h-80 overflow-auto space-y-3 bg-gradient-to-b from-background/50 to-background/40">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">Sugestões: <span className="font-medium">"Me mostre custos por veículo nos últimos 3 meses"</span> • <span className="font-medium">"Onde posso reduzir gastos?"</span></div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`${m.role === "user" ? "bg-primary text-white" : "bg-card/20 text-foreground"} max-w-[85%] px-4 py-2 rounded-2xl shadow-sm whitespace-pre-wrap text-sm`}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border bg-background/60">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={2}
                    className="flex-1 textarea resize-none h-12 px-3 py-2 rounded-md border border-border focus:outline-none"
                    placeholder="Digite sua pergunta (Shift+Enter para nova linha)..."
                  />
                  <button className="btn" onClick={() => send()} disabled={loading}>{loading ? "..." : "Enviar"}</button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">Respostas geradas por IA — sua privacidade é importante.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatWidget;

