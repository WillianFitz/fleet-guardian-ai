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
        const headers: Record<string,string> = { "Content-Type": "application/json" };
        const token = localStorage.getItem("fleet_auth_token");
        const tenantId = localStorage.getItem("fleet_tenant_id");
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (!token && tenantId) headers["X-Tenant-Id"] = tenantId;

        let res = await fetch("/api/insights", {
          method: "POST",
          headers,
          body: JSON.stringify({ prompt: text, includeData: true }),
        });

        if (!res || !res.ok) {
          try {
            res = await fetch("https://fleet-guardian-ai.willian-fitzbr.workers.dev/api/insights", {
              method: "POST",
              headers,
              body: JSON.stringify({ prompt: text, includeData: true }),
            });
          } catch (err) {
            // continue to error handling
          }
        }

        const j = await (res?.json ? res.json() : Promise.resolve(null));

        // If metrics returned, show a concise structured summary first
        const metrics = j?.data?.metrics;
        if (metrics) {
          try {
            const totalLitros = metrics.totalFuel ? Number(metrics.totalFuel) : (metrics.byVehicle ? metrics.byVehicle.reduce((acc:any, v:any) => acc + (Number(v.total_litros||0)), 0) : 0);
            const totalValor = metrics.totalExpenses ? Number(metrics.totalExpenses) : (metrics.byVehicle ? metrics.byVehicle.reduce((acc:any, v:any) => acc + (Number(v.total_fuel||0)), 0) : 0);
            const totalKm = metrics.byVehicle ? metrics.byVehicle.reduce((acc:any, v:any) => acc + (Number(v.km_driven||0)), 0) : 0;
            const consumo = totalLitros > 0 ? (totalKm / totalLitros) : null;
            const precoMedio = totalLitros > 0 ? (totalValor / totalLitros) : null;

            const lines: string[] = [];
            lines.push(`Resumo rápido:`);
            lines.push(`• Total abastecido: ${Number(totalLitros).toLocaleString("pt-BR")} L`);
            lines.push(`• Custo combustível: R$ ${Number(totalValor).toLocaleString("pt-BR")}`);
            if (precoMedio) lines.push(`• Preço médio: R$ ${precoMedio.toFixed(2)} / L`);
            if (consumo) lines.push(`• Consumo médio frota: ${consumo.toFixed(2)} km/L`);
            lines.push(`• Veículos cadastrados: ${metrics.totalVehicles ?? (metrics.activeVehicles ? metrics.activeVehicles.length : 0)}`);
            lines.push(`• Motoristas cadastrados: ${metrics.totalDrivers ?? 0}`);

            setMessages((s) => [...s, { role: "assistant", text: lines.join("\n") }]);
          } catch (err) {
            // ignore metrics formatting errors
          }
        }

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

        {/* Chat box: responsive - full screen on small, floating on md+ */}
        {open && !minimized && (
          <div className="mt-3">
            <div
              className={`bg-card/95 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col
                w-[92vw] max-w-lg md:w-96 md:max-w-md
                ${/* full-screen style on small devices */ ""}`}
              style={{ backdropFilter: "blur(6px)" }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-semibold text-foreground">IA & Insights</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">Peça relatórios, métricas e recomendações para reduzir custos</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMinimized(true)} className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10">Minimizar</button>
                  <button onClick={() => { setOpen(false); setMinimized(false); }} className="text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted/10">Fechar</button>
                </div>
              </div>

              <div ref={boxRef} className="p-4 max-h-[60vh] overflow-auto space-y-3 bg-background/40">
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
                    className="flex-1 resize-none h-14 px-3 py-2 rounded-md border border-border focus:outline-none bg-background text-foreground placeholder:text-muted-foreground"
                    placeholder="Digite sua pergunta (Shift+Enter para nova linha)..."
                  />
                  <button className="bg-primary text-white px-4 py-2 rounded-md shadow hover:brightness-95" onClick={() => send()} disabled={loading}>
                    {loading ? "..." : "Enviar"}
                  </button>
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

