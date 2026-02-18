/**
 * Busca dados da empresa por CNPJ (BrasilAPI).
 * Retorna razão social, endereço, telefone, email, UF etc. para preencher cadastro.
 */
export interface DadosEmpresaPorCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
}

const BRASIL_API_CNPJ = "https://brasilapi.com.br/api/cnpj/v1";

function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function formatTelefone(ddd: string, numero: string): string {
  if (!ddd || !numero) return "";
  const n = onlyDigits(numero);
  if (n.length === 10) return `(${ddd}) ${n.slice(0, 2)} ${n.slice(2, 6)}-${n.slice(6)}`;
  if (n.length === 11) return `(${ddd}) ${n.slice(0, 1)} ${n.slice(1, 5)}-${n.slice(5)}`;
  return `(${ddd}) ${numero}`;
}

export async function buscarEmpresaPorCnpj(cnpj: string): Promise<DadosEmpresaPorCnpj | null> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return null;

  try {
    const res = await fetch(`${BRASIL_API_CNPJ}/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();

    const logradouro = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ") || "";
    const numero = data.numero || "S/N";
    const complemento = data.complemento || "";
    const bairro = data.bairro || "";
    const municipio = data.municipio || "";
    const uf = data.uf || "";
    const cep = data.cep ? String(data.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2") : "";

    const enderecoParts = [
      logradouro && `${logradouro}, ${numero}`,
      complemento && complemento,
      bairro && `Bairro ${bairro}`,
      municipio && uf && `${municipio} - ${uf}`,
      cep && `CEP ${cep}`,
    ].filter(Boolean);
    const endereco = enderecoParts.join(", ") || "";

    const ddd1 = data.ddd_telefone_1 ? String(data.ddd_telefone_1).slice(0, 2) : "";
    const num1 = data.ddd_telefone_1 ? String(data.ddd_telefone_1).slice(2) : "";
    const telefone = formatTelefone(ddd1, num1) || (data.ddd_telefone_1 ? `(${ddd1}) ${num1}` : "");

    const email = data.email && String(data.email).trim() ? String(data.email).trim() : "";

    return {
      cnpj: digits,
      razaoSocial: data.razao_social || "",
      nomeFantasia: data.nome_fantasia || "",
      endereco,
      logradouro,
      numero,
      complemento,
      bairro,
      municipio,
      uf,
      cep,
      telefone,
      email,
    };
  } catch {
    return null;
  }
}

/** Formata CNPJ para exibição 00.000.000/0001-00 */
export function formatCnpjDisplay(cnpj: string): string {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
