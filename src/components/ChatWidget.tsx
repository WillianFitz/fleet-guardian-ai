import { Truck, Zap } from "lucide-react";
import { useCallback, useState, useRef, useEffect } from "react";
// Use explicit worker URL to avoid Pages-relative routing issues
const WORKER_URL = "https://fleet-guardian-ai.willian-fitzbr.workers.dev";

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
      // shared response variable used by multiple branches and fallback handlers
      let res: any = null;
      try {
        const headers: Record<string,string> = { "Content-Type": "application/json" };
        const token = localStorage.getItem("fleet_auth_token");
        const tenantId = localStorage.getItem("fleet_tenant_id");
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (!token && tenantId) headers["X-Tenant-Id"] = tenantId;

        // Conversation id for memory
        let convId = localStorage.getItem("agent_conversation_id");
        if (!convId) {
          try { convId = crypto.randomUUID().replace(/-/g,""); } catch { convId = String(Date.now()); }
          localStorage.setItem("agent_conversation_id", convId);
        }

        // First, try agent parser + executor pipeline (centralized)
        try {
          const parseRes = await fetch(`${WORKER_URL}/api/agent/parse`, {
            method: "POST",
            headers,
            body: JSON.stringify({ text })
          });
          if (parseRes && !parseRes.ok) {
            const txt = await parseRes.text().catch(() => "");
            console.error("agent/parse non-ok:", parseRes.status, txt);
          }
          if (parseRes && parseRes.ok) {
            const pj = await parseRes.json();
            const action = pj?.data || null;
            if (action && action.intent) {
              // execute
              const execRes = await fetch(`${WORKER_URL}/api/agent/execute`, {
                method: "POST",
                headers,
                body: JSON.stringify({ action, userText: text, conversationId: convId })
              });
              if (execRes && !execRes.ok) {
                const txt = await execRes.text().catch(() => "");
                console.error("agent/execute non-ok:", execRes.status, txt, { action, conversationId: convId });
              }
              if (execRes && execRes.ok) {
                const ej = await execRes.json().catch((e)=>{ console.error("agent/execute json parse error", e); return null; });
                const assistant = ej?.data?.assistant || ej?.assistant || null;
                const totals = ej?.data?.totals || ej?.data?.metrics || null;
                if (assistant) {
                  setMessages((s) => [...s, { role: "assistant", text: String(assistant).trim() }]);
                  setLoading(false);
                  return;
                }
                if (totals) {
                  // concise numeric reply
                  if (totals.totalValue !== undefined) {
                    setMessages((s) => [...s, { role: "assistant", text: `Total: R$ ${Number(totals.totalValue||0).toLocaleString("pt-BR")} • Registros: ${totals.count||0}` }]);
                    setLoading(false);
                    return;
                  }
                  if (totals.totalExpenses !== undefined) {
                    setMessages((s) => [...s, { role: "assistant", text: `Resumo: Custo combustível R$ ${Number(totals.totalFuel||0).toLocaleString("pt-BR")} • Despesas R$ ${Number(totals.totalExpenses||0).toLocaleString("pt-BR")}` }]);
                    setLoading(false);
                    return;
                  }
                }
              }
            }
          }
        } catch (err) {
          // fallthrough to heuristics if parser/execute fails
        }

        // Intent detection: handle metric or expenses queries directly
        const lower = text.toLowerCase();
        const monthNames: Record<string, number> = {
          janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, março: 3, mar: 3, abril: 4, abr: 4,
          maio: 5, junho: 6, jul:7, julho:7, agosto:8, ago:8, setembro:9, set:9, outubro:10, out:10,
          novembro:11, nov:11, dezembro:12, dez:12
        };

        const detectPlate = (s: string) => {
          const m = s.match(/placa\s*[:\s]?\s*([A-Z0-9-]+)/i) || s.match(/veiculo\s*[:\s]?\s*([A-Z0-9-]+)/i);
          return m ? m[1].toUpperCase() : null;
        };

        const detectMonth = (s: string) => {
          for (const k of Object.keys(monthNames)) {
            if (s.includes(k)) return monthNames[k];
          }
          return null;
        };

        const plate = detectPlate(text);
        const month = detectMonth(lower);

        // First: try LLM parser to produce structured action (brain)
        let parsedAction: any = null;
        try {
          const parserPrompt = `
Você é um parser de intenções em Português para um assistente de gestão de frotas.
Receba a mensagem do usuário e retorne APENAS um JSON (sem explicações) com estas chaves:
{
  "intent": "<get_metrics|get_expenses|get_expense_summary>",
  "plate": "<placa ou null>",
  "category": "<fuel|expenses|maintenance|all>",
  "days": <number|null>,
  "from": "<YYYY-MM-DD|null>",
  "to": "<YYYY-MM-DD|null>",
  "limit": <number|null>
}
Regras:
- "custos por veículo" ou "custos por veículo nos últimos X" => intent get_metrics
- "gastos" ou "despesas" => intent get_expenses
- palavras como "resumo", "apenas o resumo", "mostrar apenas o resumo" => intent get_expense_summary
Retorne somente JSON válido.
`;

          const parserRes = await fetch(`${WORKER_URL}/api/agent/parse`, {
            method: "POST",
            headers,
            body: JSON.stringify({ text })
          });
          if (parserRes && parserRes.ok) {
            const pj = await parserRes.json();
            const parsedText = pj?.data?.assistant || pj?.assistant || pj?.raw?.choices?.[0]?.message?.content;
            if (parsedText) {
              try {
                parsedAction = JSON.parse(String(parsedText));
              } catch {
                // no-op, fallback to heuristics
                parsedAction = null;
              }
            }
          }
        } catch (e) {
          parsedAction = null;
        }

        // If parser returned a valid action, orchestrate calls
        if (parsedAction && parsedAction.intent) {
          try {
            let intent = String(parsedAction.intent || "");
            const plateArg = parsedAction.plate || plate || null;
            // If user asked about efficiency (km/L), prefer get_efficiency
            const efficiencyRegex = /km\/l|quil[oó]metro.*litro|quil[oó]metros? por litro|km por litro|quilometro por litro/i;
            if (efficiencyRegex.test(text)) intent = "get_efficiency";
            const categoryArg = parsedAction.category || "all";
            const daysArg = parsedAction.days ? Number(parsedAction.days) : (parsedAction.period_days ? Number(parsedAction.period_days) : null);
            const fromArg = parsedAction.from || null;
            const toArg = parsedAction.to || null;
            const limitArg = parsedAction.limit ? Number(parsedAction.limit) : 500;

            if (intent === "get_metrics") {
              const pd = daysArg || 90;
              const res = await fetch(`${WORKER_URL}/api/insights`, {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "metrics", period_days: pd })
              });
              if (!res || !res.ok) throw new Error(await res.text().catch(()=>String(res?.status||"error")));
              const j = await res.json();
              const metrics = j?.data?.metrics;
              if (!metrics) throw new Error("No metrics returned");
              // ask worker to summarize concisely
              const sys = "Você é um assistente conciso em Português. Retorne uma linha numérica de resumo e uma recomendação prática curta. Responda em Português, apenas em Português.";
              const userP = `Resuma as métricas em uma linha e uma recomendação. Dados: ${JSON.stringify(metrics)}`;
              const r2 = await fetch(`${WORKER_URL}/api/insights`, {
                method: "POST",
                headers,
                body: JSON.stringify({ messages: [{ role: "system", content: sys }, { role: "user", content: userP }], max_tokens: 200 })
              });
              const j2 = await r2.json();
              const reply = j2?.data?.assistant || j2?.assistant || (j2?.raw?.choices?.[0]?.message?.content ?? "Sem resposta.");
              setMessages((s) => [...s, { role: "assistant", text: String(reply).trim() }]);
              setLoading(false);
              return;
            }

            if (intent === "get_expenses" || intent === "get_expense_summary") {
              const bodyPayload: any = { action: "expenses", category: categoryArg || "all", limit: limitArg };
              if (plateArg) bodyPayload.plate = plateArg;
              if (daysArg) bodyPayload.days = daysArg;
              if (fromArg) bodyPayload.from = fromArg;
              if (toArg) bodyPayload.to = toArg;
              const res = await fetch(`${WORKER_URL}/api/insights`, { method: "POST", headers, body: JSON.stringify(bodyPayload) });
              if (!res || !res.ok) throw new Error(await res.text().catch(()=>String(res?.status||"error")));
              const j = await res.json();
              const recs = j?.data?.records || [];
              const totals = j?.data?.totals || {};
              // If user wanted a quick summary, return concise numeric text
              if (intent === "get_expense_summary") {
                const totalValue = Number(totals.totalValue || recs.reduce((s:any,r:any)=>s + (Number(r.valor||0)),0));
                const totalLiters = recs.reduce((s:any,r:any)=>s + (Number(r.litros||0)),0);
                const totalKm = recs.reduce((s:any,r:any)=>s + ((Number(r.km_atual||0) - Number(r.km_anterior||0)) || 0),0);
                const parts = [`Total: R$ ${totalValue.toLocaleString("pt-BR")}`];
                if (totalLiters) parts.push(`${totalLiters} L`);
                if (totalKm) parts.push(`${totalKm} km`);
                setMessages((s) => [...s, { role: "assistant", text: parts.join(" • ") }]);
                setLoading(false);
                return;
              }
              // For full analysis use worker LLM
              const systemPrompt = "Você é um analista conciso em Português. Dado os registros e totais, produza uma linha numérica de resumo, duas frases de conclusão e uma recomendação prática. Responda em Português, apenas em Português.";
              const userPrompt = `Registros: ${JSON.stringify({ totals, sample: recs.slice(0,50) })}`;
              const r2 = await fetch(`${WORKER_URL}/api/insights`, {
                method: "POST",
                headers,
                body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 300 })
              });
              const j2 = await r2.json();
              const analysis = j2?.data?.assistant || j2?.assistant || (j2?.raw?.choices?.[0]?.message?.content ?? null);
              if (analysis) setMessages((s) => [...s, { role: "assistant", text: String(analysis).trim() }]);
              else setMessages((s) => [...s, { role: "assistant", text: `Total: R$ ${Number(totals.totalValue||0).toLocaleString("pt-BR")} • Registros: ${totals.count||recs.length}` }]);
              setLoading(false);
              return;
            }
          } catch (err:any) {
            setMessages((s) => [...s, { role: "assistant", text: `Erro ao executar ação: ${String(err.message || err)}` }]);
            setLoading(false);
            return;
          }
        }

        // If user asked "quantos veiculos" or similar, call metrics
        if (/quantos\s+veicul|quantos\s+veículos|quantos\s+motoristas|meu(s)?\s+veículo(s)?|custos\s+por\s+veículo|custos\s+por\s+veiculo|custos por veículo|custos por veiculo|custos\s+por\s+veiculos?/i.test(text)) {
          // Determine period_days if present (e.g., "3 meses" => 90 days)
          let periodDays = 90;
          const mMonths = lower.match(/(\d+)\s*mes(es)?/i);
          if (mMonths) periodDays = Number(mMonths[1]) * 30;
          const daysMatch = lower.match(/(\d+)\s*dias?/i);
          if (daysMatch) periodDays = Number(daysMatch[1]);

          // 1) fetch metrics from worker
          let res = await fetch(`${WORKER_URL}/api/insights`, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "metrics", period_days: periodDays }),
          });
          if (!res || !res.ok) {
            // retry once
            try {
              res = await fetch(`${WORKER_URL}/api/insights`, {
                method: "POST",
                headers,
                body: JSON.stringify({ action: "metrics", period_days: periodDays }),
              });
            } catch (err) {
              // network error on retry
            }
          }
          if (!res || !res.ok) {
            const status = res ? res.status : "no-response";
            const bodyText = res ? await res.text().catch(() => "") : "";
            console.error("Insights error:", { status, bodyText });
            setMessages((s) => [...s, { role: "assistant", text: `Erro do serviço: ${status} ${bodyText ? " — " + (bodyText.length > 300 ? bodyText.slice(0,300) + "..." : bodyText) : ""}` }]);
            setLoading(false);
            return;
          }
          const j = await res.json();
          const metrics = j?.data?.metrics;
          if (!metrics) {
            setMessages((s) => [...s, { role: "assistant", text: `Não foi possível obter métricas.` }]);
            setLoading(false);
            return;
          }

          // 2) ask worker to produce concise natural-language summary based on metrics
          const systemPrompt = "Você é um assistente analítico de frota. Responda em Português, muito sucinto: 1 linha numérica resumo, 1-2 frases de conclusão, 1 recomendação prática. Responda em Português, apenas em Português.";
          const userPrompt = `Gere um resumo curto dos custos por veículo usando estes dados (JSON):\n${JSON.stringify({ period_days: periodDays, metrics })}`;
          let r2 = await fetch(`${WORKER_URL}/api/insights`, {
            method: "POST",
            headers,
            body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 300 }),
          });
          if (!r2 || !r2.ok) {
            r2 = await fetch(`${WORKER_URL}/api/insights`, {
              method: "POST",
              headers,
              body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 300 }),
            });
          }
          if (!r2 || !r2.ok) {
            const txt = r2 ? await r2.text().catch(()=>"") : "no response";
            setMessages((s) => [...s, { role: "assistant", text: `Erro ao gerar análise: ${r2?.status || "?"} ${txt}` }]);
            setLoading(false);
            return;
          }
          const j2 = await r2.json();
          const analysis = j2?.data?.assistant || j2?.assistant || (j2?.raw?.choices?.[0]?.message?.content ?? null);
          if (analysis) {
            setMessages((s) => [...s, { role: "assistant", text: String(analysis).trim() }]);
          } else {
            setMessages((s) => [...s, { role: "assistant", text: `Resumo rápido: veículos cadastrados ${metrics.totalVehicles || 0}` }]);
          }
          setLoading(false);
          return;
        }

        // If user mentioned a plate or asked for gastos/despesas, call expenses action
        const wantSummary = /(^|\s)(resumo|resuma|sum[aá]rio|apenas o resumo|mostrar apenas o resumo|mostrar resumo|resuma|total|resumos)(\s|$)/i.test(text);
        if (plate || /gasto|gastos|despesa|despesas|combustiv/i.test(lower)) {
          // build date range
          let from: string | null = null;
          let to: string | null = null;
          const year = new Date().getFullYear();
          // detect "últimos N dias" or standalone "30 dias"
          let detectedDays: number | null = null;
          const daysMatch1 = lower.match(/últim(?:os|as)?\s+(\d+)\s*dias?/i);
          const daysMatch2 = lower.match(/last\s+(\d+)\s+days?/i);
          const daysMatch3 = lower.match(/(\d+)\s*dias?/i);
          if (daysMatch1) detectedDays = Number(daysMatch1[1]);
          else if (daysMatch2) detectedDays = Number(daysMatch2[1]);
          else if (daysMatch3) {
            // ensure not a year or day in date dd/mm/yyyy (avoid picking day from date)
            const before = lower.substring(0, daysMatch3.index || 0);
            if (!/\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(before)) detectedDays = Number(daysMatch3[1]);
          }
          if (month) {
            const lastDay = new Date(year, month, 0).getDate();
            from = `${year}-${String(month).padStart(2,"0")}-01`;
            to = `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
          }
          // override if user specified explicit dates (very simple dd/mm/yyyy detection)
          const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
          if (dateMatch) {
            from = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            // if only one date provided treat as single-day to-day
            to = from;
          }

          // Robust category detection (avoid matching 'os' inside words)
          let category: "fuel" | "maintenance" | "expenses" | "all" = "all";
          if (/combust|diesel|etanol|gasolina|gasolina/i.test(lower)) {
            category = "fuel";
          } else if (/manuten|oficina|revis[aã]o|conserto|manut|servi[cç]o/i.test(lower)) {
            category = "maintenance";
          } else if (/gasto|despesa|expense|custo|custos/i.test(lower)) {
            category = "expenses";
          } else {
            category = "all";
          }
          const bodyPayload: any = { action: "expenses", category, limit: 500 };
          if (plate) bodyPayload.plate = plate;
          if (from) bodyPayload.from = from;
          if (to) bodyPayload.to = to;
          if (detectedDays) bodyPayload.days = detectedDays;

          let res = await fetch(`${WORKER_URL}/api/insights`, { method: "POST", headers, body: JSON.stringify(bodyPayload) });
          if (!res || !res.ok) {
            try {
              res = await fetch(`${WORKER_URL}/api/insights`, { method: "POST", headers, body: JSON.stringify(bodyPayload) });
            } catch (err) {}
          }
          if (!res || !res.ok) {
            const status = res ? res.status : "no-response";
            const bodyText = res ? await res.text().catch(() => "") : "";
            console.error("Insights error (expenses):", { status, bodyText, bodyPayload });
            setMessages((s) => [...s, { role: "assistant", text: `Erro do serviço: ${status} ${bodyText ? " — " + (bodyText.length > 300 ? bodyText.slice(0,300) + "..." : bodyText) : ""}` }]);
            setLoading(false);
            return;
          }
          const j = await (res?.json ? res.json() : null);
          const recs = j?.data?.records || [];
          const totals = j?.data?.totals || {};
          const params = j?.data?.params || {};

          // If user asked for a quick summary, return concise numeric summary directly (no AI)
          if (wantSummary) {
            const totalValue = Number(totals.totalValue || recs.reduce((s:any,r:any)=>s + (Number(r.valor||0)),0));
            const totalLiters = recs.reduce((s:any,r:any)=>s + (Number(r.litros||0)),0);
            const totalKm = recs.reduce((s:any,r:any)=>s + ((Number(r.km_atual||0) - Number(r.km_anterior||0)) || 0),0);
            const summaryTextParts = [];
            summaryTextParts.push(`Resumo (${params.plate || "todas"} ${params.from}→${params.to}):`);
            summaryTextParts.push(`Total: R$ ${Number(totalValue).toLocaleString("pt-BR")}`);
            if (totalLiters > 0) summaryTextParts.push(`Litros: ${totalLiters} L`);
            if (totalKm > 0) summaryTextParts.push(`KM: ${totalKm} km`);
            setMessages((s) => [...s, { role: "assistant", text: summaryTextParts.join(" • ") }]);
            setLoading(false);
            return;
          }

          const lines: string[] = [];
          lines.push(`Resultados para placa ${params.plate || "todas"} (${params.from} → ${params.to}) — categoria: ${params.category}`);
          lines.push(`Registros: ${totals.count || recs.length} • Total valor: R$ ${Number(totals.totalValue || 0).toLocaleString("pt-BR")}`);

          // Prepare a compact dataset for analysis (limit to 50 records)
          const sample = recs.slice(0, 50).map((r:any) => {
            return {
              date: r.data,
              plate: r.veiculo_placa,
              type: r.litros ? "fuel" : (r.tipo || r.numero ? "maintenance" : "expense"),
              description: r.descricao || r.numero || r.posto || null,
              liters: r.litros || null,
              value: Number(r.valor || 0),
              km_from: r.km_anterior || null,
              km_to: r.km_atual || null
            };
          });

          // Ask the Worker to analyze these records via the AI
          const systemPrompt = "Você é um assistente analítico especializado em gestão de frotas. Responda em Português de forma muito concisa e amigável — apenas texto, sem JSON, sem cabeçalhos técnicos, nem códigos. Primeiro mostre um resumo numérico em 1-2 linhas, depois 2-3 frases com as principais conclusões e 1 recomendação prática. Responda em Português, apenas em Português.";
          const userPrompt = `Analise os seguintes registros (JSON) e gere apenas texto conciso.
Mostre:
 - 1 linha de resumo numérico (valor total • litros totais • km totais quando houver).
 - 2 frases com as principais conclusões (por exemplo: "manutenção alta", "consumo abaixo da média").
 - 1 recomendação prática curta.

Dados (JSON):
${JSON.stringify({ params, totals, sample })}`;

          try {
            // send to Worker/OpenAI for natural-language analysis
            let r2 = await fetch(`${WORKER_URL}/api/insights`, {
              method: "POST",
              headers,
              body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 600 }),
            });
            if (!r2 || !r2.ok) {
              r2 = await fetch(`${WORKER_URL}/api/insights`, {
                method: "POST",
                headers,
                body: JSON.stringify({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 600 }),
              });
            }
            const j2 = await (r2?.json ? r2.json() : Promise.resolve(null));
            const analysis = j2?.data?.assistant || j2?.assistant || (j2?.raw?.choices?.[0]?.message?.content ?? null);
            // show brief header + analysis (try parse JSON)
            const header = lines.join("\n");
            if (analysis) {
            // Show analysis as concise natural-language text (no JSON)
            if (analysis) {
              // Trim and condense whitespace
              const textAnalysis = String(analysis).trim().replace(/\s+/g, " ");
              setMessages((s) => [...s, { role: "assistant", text: header }, { role: "assistant", text: textAnalysis }]);
            } else {
              // fallback to structured lines if analysis failed
              for (let i=0;i<Math.min(5, recs.length); i++) {
                const r = recs[i];
                if (r.litros) lines.push(`• ${r.data} · Fuel · ${r.veiculo_placa} · ${r.litros} L · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
                else if (r.numero || r.tipo) lines.push(`• ${r.data} · Manutenção (${r.tipo||r.numero}) · ${r.veiculo_placa} · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
                else lines.push(`• ${r.data} · Despesa · ${r.descricao || r.veiculo_placa} · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
              }
              if (recs.length > 5) lines.push(`... e mais ${recs.length-5} registro(s). Use 'limit' para ver mais.`);
              setMessages((s) => [...s, { role: "assistant", text: lines.join("\n") }]);
            }
            } else {
              // fallback to structured lines if analysis failed
              // show up to 5 sample lines for user reference
              for (let i=0;i<Math.min(5, recs.length); i++) {
                const r = recs[i];
                if (r.litros) lines.push(`• ${r.data} · Fuel · ${r.veiculo_placa} · ${r.litros} L · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
                else if (r.numero || r.tipo) lines.push(`• ${r.data} · Manutenção (${r.tipo||r.numero}) · ${r.veiculo_placa} · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
                else lines.push(`• ${r.data} · Despesa · ${r.descricao || r.veiculo_placa} · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
              }
              if (recs.length > 5) lines.push(`... e mais ${recs.length-5} registro(s). Use 'limit' para ver mais.`);
              setMessages((s) => [...s, { role: "assistant", text: lines.join("\n") }]);
            }
          } catch (err) {
            // if analysis fails, fallback to structured lines
            for (let i=0;i<Math.min(5, recs.length); i++) {
              const r = recs[i];
              if (r.litros) lines.push(`• ${r.data} · Fuel · ${r.veiculo_placa} · ${r.litros} L · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
              else if (r.numero || r.tipo) lines.push(`• ${r.data} · Manutenção (${r.tipo||r.numero}) · ${r.veiculo_placa} · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
              else lines.push(`• ${r.data} · Despesa · ${r.descricao || r.veiculo_placa} · R$ ${Number(r.valor||0).toLocaleString("pt-BR")}`);
            }
            if (recs.length > 5) lines.push(`... e mais ${recs.length-5} registro(s). Use 'limit' para ver mais.`);
            setMessages((s) => [...s, { role: "assistant", text: lines.join("\n") }]);
          }
          setLoading(false);
          return;
        }

        if (!res || !res.ok) {
          try {
            res = await fetch(`${WORKER_URL}/api/insights`, {
              method: "POST",
              headers,
              body: JSON.stringify({ prompt: text, includeData: true }),
            });
          } catch (err) {}
        }
        if (!res || !res.ok) {
          const status = res ? res.status : "no-response";
          const bodyText = res ? await res.text().catch(() => "") : "";
          console.error("Insights fallback error:", { status, bodyText });
          setMessages((s) => [...s, { role: "assistant", text: `Erro do serviço: ${status} ${bodyText ? " — " + (bodyText.length > 300 ? bodyText.slice(0,300) + "..." : bodyText) : ""}` }]);
          setLoading(false);
          return;
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
      } catch (e:any) {
        console.error("ChatWidget send error:", e);
        const msg = e?.message ? `Erro ao consultar o serviço de Insights: ${String(e.message).slice(0,300)}` : "Erro ao consultar o serviço de Insights.";
        setMessages((s) => [...s, { role: "assistant", text: msg }]);
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

