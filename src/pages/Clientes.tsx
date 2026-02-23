import { useState } from "react";
import useStore from "@/hooks/useStore";
import { Client } from "@/types/fleet";
import { validateCPF, validateCNPJ, fetchCnpjData, onlyDigits } from "@/lib/cpfCnpj";
import { toast } from "@/hooks/use-toast";

const Clientes = () => {
  const { items, add, update, remove } = useStore<Client>("clients", []);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});
  const [loadingFetch, setLoadingFetch] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm({});
  };

  const handleEdit = (c: Client) => {
    setEditing(c);
    setForm(c);
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
      // Mapear campos comuns
      setForm((p) => ({
        ...p,
        nome: data.razao_social || data.nome || p.nome,
        contato: (data.telefone || p.contato) ?? "",
        cep: data.estabelecimento?.cep || p.cep || "",
        logradouro: data.estabelecimento?.logradouro || p.logradouro || "",
        municipio: data.estabelecimento?.municipio || p.municipio || "",
        uf: data.estabelecimento?.uf || p.uf || "",
      }));
      toast({ title: "Dados do CNPJ preenchidos" });
    } catch (e: any) {
      toast({ title: "Falha ao buscar CNPJ", description: e?.message || "Erro", variant: "destructive" });
    } finally {
      setLoadingFetch(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clientes</h1>
        <button onClick={openNew} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground">Novo</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2">
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold">Nome</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold">CNPJ/CPF</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold">Município</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-3 py-2">{c.nome}</td>
                      <td className="px-3 py-2 font-mono">{c.cnpjCpf}</td>
                      <td className="px-3 py-2">{c.municipio} {c.uf ? `/${c.uf}` : ""}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => handleEdit(c)} className="px-2 py-1 rounded border">Editar</button>
                        <button onClick={() => remove(c.id)} className="px-2 py-1 rounded border ml-2 text-destructive">Excluir</button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nenhum cliente</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div>
          <div className="p-4 bg-card border-border rounded-lg space-y-2">
            <label className="text-xs">Nome</label>
            <input value={form.nome || ""} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} className="w-full px-2 py-2 border rounded" />
            <label className="text-xs">CNPJ / CPF</label>
            <div className="flex gap-2">
              <input value={form.cnpjCpf || ""} onChange={(e) => setForm((p) => ({ ...p, cnpjCpf: e.target.value }))} className="flex-1 px-2 py-2 border rounded" />
              <button onClick={handleFetchByCnpj} disabled={loadingFetch} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground">{loadingFetch ? "Buscando..." : "Buscar CNPJ"}</button>
            </div>
            <label className="text-xs">Telefone</label>
            <input value={form.telefone || ""} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} className="w-full px-2 py-2 border rounded" />
            <label className="text-xs">Município / UF</label>
            <div className="flex gap-2">
              <input value={form.municipio || ""} onChange={(e) => setForm((p) => ({ ...p, municipio: e.target.value }))} className="flex-1 px-2 py-2 border rounded" />
              <input value={form.uf || ""} onChange={(e) => setForm((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} className="w-16 px-2 py-2 border rounded" maxLength={2} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setForm({}); setEditing(null); }} className="px-3 py-2 rounded border">Cancelar</button>
              <button onClick={handleSave} className="px-3 py-2 rounded bg-primary text-primary-foreground">Salvar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clientes;

