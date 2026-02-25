import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import useStore from "@/hooks/useStore";
import { Client } from "@/types/fleet";
import { validateCPF, validateCNPJ, fetchCnpjData, onlyDigits } from "@/lib/cpfCnpj";
import { toast } from "@/hooks/use-toast";

const Clientes = () => {
  const { items, add, update, remove } = useStore<Client>("clients", []);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [search, setSearch] = useState("");
  const nameRef = useRef<HTMLInputElement | null>(null);
  const normalize = (s?: string) => {
    if (!s) return "";
    try {
      return s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();
    } catch {
      return s.toLowerCase().trim();
    }
  };

  const [modalOpen, setModalOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm({});
    setModalOpen(true);
    // focus will happen after modal opens
    setTimeout(() => nameRef.current?.focus(), 200);
  };

  const handleEdit = (c: Client) => {
    setEditing(c);
    setForm(c);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 200);
  };

  const handleSave = () => {
    if (!form.nome) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    const payload = { ...form } as any;
    if (editing) {
      update(editing.id, payload);
      toast({ title: "Cliente atualizado" });
    } else {
      add(payload);
      toast({ title: "Cliente adicionado" });
    }
    setForm({});
    setEditing(null);
  };

  const handleFetchByCnpj = async () => {
    const cnpj = String(form.cnpjCpf || "");
    if (!validateCNPJ(cnpj)) {
      toast({ title: "CNPJ inválido", variant: "destructive" });
      return;
    }
    setLoadingFetch(true);
    try {
      const data = await fetchCnpjData(cnpj);
      // Debug: if needed inspect returned JSON in logs
      try { /* fetchCnpjData result logged during development */ } catch {}

      // Extract phone from several possible locations in BrasilAPI response
      // Try multiple possible fields/locations for phone numbers returned by BrasilAPI or other sources
      const phoneCandidates = [
        data.telefone,
        data.telefone_contato,
        data.telefones && Array.isArray(data.telefones) ? data.telefones[0] : null,
        data.contato?.telefone,
        data.contatos && Array.isArray(data.contatos) ? data.contatos[0]?.telefone : null,
        data.estabelecimento?.telefone,
        // BrasilAPI common fields
        data.ddd_telefone_1 || data.ddd_telefone_2 || null,
        data.telefone_1 || data.telefone_2 || null,
        // combine ddd + telefone when present
        (data.estabelecimento?.ddd && data.estabelecimento?.telefone) ? `${data.estabelecimento.ddd}${data.estabelecimento.telefone}` : null,
        (Array.isArray(data.estabelecimentos) && (data.estabelecimentos[0]?.ddd && data.estabelecimentos[0]?.telefone)) ? `${data.estabelecimentos[0].ddd}${data.estabelecimentos[0].telefone}` : null,
        (Array.isArray(data.estabelecimentos) && data.estabelecimentos[0]?.telefone) ? data.estabelecimentos[0]?.telefone : null,
      ];
      let phone = null;
      for (const p of phoneCandidates) {
        if (p && String(p).trim()) {
          phone = String(p).trim();
          break;
        }
      }
      // Normalize/format phone if found (BR format)
      if (phone) {
        const digits = onlyDigits(phone);
        if (digits.length === 10) {
          // (AA) NNNN-NNNN
          phone = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        } else if (digits.length === 11) {
          // (AA) NNNNN-NNNN
          phone = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        } else {
          // keep digits grouping for unknown lengths
          phone = digits;
        }
      }

      // Extract address/municipio/uf from multiple possible locations
      const rawCep = data.estabelecimento?.cep || data.cep || data.estabelecimentos?.[0]?.cep || null;
      const logradouro = data.estabelecimento?.logradouro || data.logradouro || data.estabelecimentos?.[0]?.logradouro || null;
      const numeroField = data.numero || data.estabelecimento?.numero || data.estabelecimentos?.[0]?.numero || null;
      const bairroField = data.bairro || data.estabelecimento?.bairro || data.estabelecimentos?.[0]?.bairro || null;
      const complementoField = data.complemento || data.estabelecimento?.complemento || data.estabelecimentos?.[0]?.complemento || null;
      const municipio = data.estabelecimento?.municipio || data.municipio || data.estabelecimentos?.[0]?.municipio || null;
      const uf = data.estabelecimento?.uf || data.uf || data.estabelecimentos?.[0]?.uf || null;

      // normalize cep (format 12345-678)
      let cep = rawCep || null;
      if (cep) {
        const d = onlyDigits(String(cep));
        if (d.length === 8) cep = `${d.slice(0,5)}-${d.slice(5)}`;
        else cep = d;
      }

      // Mapear campos comuns
      setForm((p) => ({
        ...p,
        nome: data.razao_social || data.nome || p.nome,
        contato: phone || p.contato || "",
        telefone: phone || p.telefone || "",
        cep: cep || p.cep || "",
        logradouro: logradouro || p.logradouro || "",
        numero: numeroField || p.numero || "",
        bairro: bairroField || p.bairro || "",
        complemento: complementoField || p.complemento || "",
        municipio: municipio || p.municipio || "",
        uf: uf || p.uf || "",
      }));
      toast({ title: "Dados do CNPJ preenchidos" });

      // If we have a CEP but missing street/bairro, try ViaCEP to enrich address
      try {
        const cepDigits = cep ? cep.replace(/\D/g, "") : null;
        const needViaCep = cepDigits && (!logradouro || !bairroField);
        if (needViaCep) {
          try {
            const viaRes = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
            if (viaRes.ok) {
              const viaJson = await viaRes.json();
              if (!viaJson.erro) {
                setForm((p) => ({
                  ...p,
                  logradouro: p.logradouro || viaJson.logradouro || logradouro || "",
                  bairro: p.bairro || viaJson.bairro || bairroField || "",
                  complemento: p.complemento || viaJson.complemento || complementoField || p.complemento || "",
                }));
                toast({ title: "Endereço completado via CEP" });
              }
            }
          } catch {
            // ignore ViaCEP errors
          }
        }
      } catch {
        // ignore
      }
    } catch (e: any) {
      toast({ title: "Falha ao buscar CNPJ", description: e?.message || "Erro", variant: "destructive" });
    } finally {
      setLoadingFetch(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-sm text-muted-foreground">Gerencie clientes gerados pelas importações e buscas.</p>
          </div>
        <div className="flex items-center gap-3">
          {/* Search moved below and aligned with the clients card */}
        </div>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-5xl">
            <div className="flex justify-end mb-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou CNPJ"
                className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none"
              />
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden mx-auto">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="text-lg font-semibold">Lista de clientes</div>
                <div className="text-sm text-muted-foreground">{items.length} cadastrados</div>
              </div>
              <div className="overflow-x-auto">
                <div className="mx-auto">
                  <table className="w-full min-w-[680px] divide-y divide-border text-base table-auto mx-auto">
                    <thead className="bg-muted/10">
                      <tr className="text-xs text-muted-foreground uppercase">
                        <th className="text-left px-6 py-4">Nome</th>
                        <th className="text-left px-6 py-4">CNPJ/CPF</th>
                        <th className="text-left px-6 py-4">Município / UF</th>
                        <th className="px-6 py-4 text-right w-40">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card">
                  {items.filter(c => {
                    const q = normalize(search);
                    if (!q) return true;
                    const name = normalize(c.nome || "");
                    const cnpjDigits = (c.cnpjCpf || "").replace(/\D/g, "");
                    const qDigits = search.replace(/\D/g, "");
                    return name.includes(q) || (qDigits && cnpjDigits.includes(qDigits));
                  }).map((c) => (
                        <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 align-top max-w-md">{c.nome}</td>
                          <td className="px-6 py-4 align-top font-mono">{c.cnpjCpf}</td>
                          <td className="px-6 py-4 align-top">{c.municipio}{c.uf ? ` / ${c.uf}` : ""}</td>
                          <td className="px-6 py-4 text-right align-top">
                            <div className="inline-flex items-center gap-2">
                              <button onClick={() => handleEdit(c)} className="inline-flex items-center px-3 py-1.5 rounded border">Editar</button>
                              <button
                                onClick={() => {
                                  if (confirm(`Excluir cliente ${c.nome}?`)) {
                                    remove(c.id);
                                    toast({ title: "Cliente excluído" });
                                  }
                                }}
                                className="inline-flex items-center px-3 py-1.5 rounded border text-destructive"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Nenhum cliente cadastrado</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for new/edit client */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setForm({}); setEditing(null); } }}>
        <DialogContent className="bg-card border-border w-full max-w-2xl mx-4 sm:mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 max-h-[65vh] overflow-y-auto">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome</label>
              <input ref={nameRef} value={form.nome || ""} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">CNPJ / CPF</label>
                <div className="flex gap-2">
                  <input value={form.cnpjCpf || ""} onChange={(e) => setForm((p) => ({ ...p, cnpjCpf: e.target.value }))} className="flex-1 px-3 py-2 border rounded bg-muted/50" />
                  {(() => {
                    try {
                      const digits = onlyDigits(form.cnpjCpf || "");
                      return digits.length >= 14 ? (
                        <button onClick={handleFetchByCnpj} disabled={loadingFetch} className="px-3 py-2 rounded bg-primary text-primary-foreground">
                          {loadingFetch ? "Buscando..." : "Buscar CNPJ"}
                        </button>
                      ) : null;
                    } catch {
                      return null;
                    }
                  })()}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Telefone</label>
                <input value={form.telefone || ""} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">CEP</label>
                <input value={form.cep || ""} onChange={(e) => setForm((p) => ({ ...p, cep: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Logradouro</label>
                <input value={form.logradouro || ""} onChange={(e) => setForm((p) => ({ ...p, logradouro: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Número</label>
                <input value={form.numero || ""} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Bairro</label>
                <input value={form.bairro || ""} onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Complemento</label>
                <input value={form.complemento || ""} onChange={(e) => setForm((p) => ({ ...p, complemento: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Município</label>
                <input value={form.municipio || ""} onChange={(e) => setForm((p) => ({ ...p, municipio: e.target.value }))} className="w-full px-3 py-2 border rounded bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">UF</label>
                <input value={form.uf || ""} onChange={(e) => setForm((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} className="w-full px-3 py-2 border rounded bg-muted/50" maxLength={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setModalOpen(false); setForm({}); setEditing(null); }} className="px-3 py-2 rounded border">Cancelar</button>
              <button onClick={() => { handleSave(); setModalOpen(false); }} className="px-3 py-2 rounded bg-primary text-primary-foreground">Salvar</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating add button bottom-right with pulse */}
      <div className="fixed right-6 bottom-6 z-50">
        <div className="relative">
          <span className="absolute -inset-1 rounded-full bg-primary/30 animate-ping"></span>
          <button
            onClick={openNew}
            title="Novo cliente"
            className="relative inline-flex items-center justify-center gap-2 px-6 py-5 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 transform transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Clientes;

