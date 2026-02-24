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
          <div className="mt-3 w-80 max-w-xs">
            <div className="bg-card/80 border border-border rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">IA & Insights</div>
                    <div className="text-xs text-muted-foreground">Pergunte sobre custos, manutenção e economia</div>
                  </div>
                </div>
                <div>
                  <button onClick={() => { setOpen(false); setMinimized(false); }} className="text-xs text-muted-foreground px-2">Fechar</button>
                </div>
              </div>
              <div ref={boxRef} className="p-2 max-h-60 overflow-auto">
                {messages.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2">Peça: "Me mostre custos por veículo nos últimos 3 meses" ou "Onde posso reduzir gastos?"</div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`mb-2 ${m.role === "user" ? "text-right" : "text-left"}`}>
                      <div className={`inline-block px-3 py-2 rounded-md ${m.role === "user" ? "bg-primary/10 text-foreground" : "bg-muted-foreground/5 text-foreground"}`}>
                        <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-border">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    className="flex-1 input"
                    placeholder="Pergunte algo..."
                  />
                  <button className="btn" onClick={() => send()} disabled={loading}>{loading ? "..." : "Enviar"}</button>
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

