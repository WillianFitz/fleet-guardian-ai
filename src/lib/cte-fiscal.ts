/**
 * cte-fiscal.ts — Regras fiscais para CT-e
 * Alíquotas ICMS 2026, CFOP automático, CST, cálculo de imposto
 */

// ============================================================
// ALÍQUOTAS ICMS INTERNAS POR UF (transporte dentro do estado)
// ============================================================
export const ICMS_INTERNO_POR_UF: Record<string, number> = {
  AC: 19,
  AL: 19,
  AP: 18,
  AM: 20,
  BA: 20.5,
  CE: 20,
  DF: 18,
  ES: 17,
  GO: 19,
  MA: 22,
  MT: 17,
  MS: 17,
  MG: 18,
  PA: 19,
  PB: 20,
  PR: 19,
  PE: 20.5,
  PI: 21,
  RJ: 20,
  RN: 20,
  RS: 17,
  RO: 17.5,
  RR: 17,
  SC: 17,
  SP: 18,
  SE: 19,
  TO: 18,
};

// ============================================================
// ALÍQUOTAS ICMS INTERESTADUAIS
// Regra nacional: Sul/Sudeste (exceto ES) → Norte/Nordeste/CO+ES = 7%
// Demais combinações = 12%
// Produtos importados (conteúdo > 40%) = 4%
// ============================================================
const SUL_SUDESTE = ["SP", "RJ", "MG", "ES", "PR", "SC", "RS"];
const NORTE_NORDESTE_CO_ES = [
  "AC","AL","AP","AM","BA","CE","DF","GO","MA","MT","MS",
  "PA","PB","PI","RN","RO","RR","SE","TO","PE","PB","ES",
];

export type TipoOperacaoICMS = "interno" | "interestadual" | "internacional" | "importado";

export function getAliquotaICMS(
  ufOrigem: string,
  ufDestino: string,
  tipoOperacao: TipoOperacaoICMS = "interestadual",
  importado = false
): number {
  if (tipoOperacao === "internacional") return 0; // isento / regra específica
  if (importado || tipoOperacao === "importado") return 4;

  const orig = (ufOrigem || "").toUpperCase().trim();
  const dest = (ufDestino || "").toUpperCase().trim();

  if (!orig || !dest) return 12;
  if (orig === dest) return ICMS_INTERNO_POR_UF[orig] ?? 12;

  // Sul/Sudeste → Norte/Nordeste/CO+ES = 7%
  if (SUL_SUDESTE.includes(orig) && NORTE_NORDESTE_CO_ES.includes(dest)) return 7;
  return 12;
}

// ============================================================
// CFOP AUTOMÁTICO
// ============================================================
export interface CFOPSugestao {
  cfop: string;
  descricao: string;
  motivo: string;
}

export function sugerirCFOP(
  ufOrigem: string,
  ufDestino: string,
  tipoServico?: string // "1"=subcontratacao "2"=redespacho "3"=redespacho_intermediario
): CFOPSugestao {
  const orig = (ufOrigem || "").toUpperCase().trim();
  const dest = (ufDestino || "").toUpperCase().trim();

  const interestadual = orig && dest && orig !== dest;

  if (tipoServico === "2") {
    return interestadual
      ? { cfop: "6.358", descricao: "Prestação de serviço de transporte a contribuinte/redespacho", motivo: "Redespacho interestadual" }
      : { cfop: "5.358", descricao: "Prestação de serviço de transporte a contribuinte/redespacho", motivo: "Redespacho dentro do estado" };
  }
  if (tipoServico === "3") {
    return interestadual
      ? { cfop: "6.359", descricao: "Redespacho intermediário", motivo: "Redespacho intermediário interestadual" }
      : { cfop: "5.359", descricao: "Redespacho intermediário", motivo: "Redespacho intermediário dentro do estado" };
  }
  if (tipoServico === "1") {
    return interestadual
      ? { cfop: "6.360", descricao: "Subcontratação para execução de transporte", motivo: "Subcontratação interestadual" }
      : { cfop: "5.360", descricao: "Subcontratação para execução de transporte", motivo: "Subcontratação dentro do estado" };
  }

  // Serviço padrão de transporte
  if (interestadual) {
    return { cfop: "6.353", descricao: "Prestação de serviço de transporte a estabelecimento comercial interestadual", motivo: "Transporte interestadual" };
  }
  return { cfop: "5.353", descricao: "Prestação de serviço de transporte a estabelecimento comercial", motivo: "Transporte dentro do estado" };
}

// Lista completa de CFOPs comuns para CT-e
export const CFOP_OPTIONS = [
  { value: "5353", label: "5353 — Transp. a estab. comercial (dentro do estado)" },
  { value: "5354", label: "5354 — Transp. a estab. de produtor rural (dentro do estado)" },
  { value: "5355", label: "5355 — Transp. a estab. não contribuinte (dentro do estado)" },
  { value: "5356", label: "5356 — Transp. a estab. industrial (dentro do estado)" },
  { value: "5357", label: "5357 — Transp. a pessoa física (dentro do estado)" },
  { value: "5358", label: "5358 — Redespacho (dentro do estado)" },
  { value: "5359", label: "5359 — Redespacho intermediário (dentro do estado)" },
  { value: "5360", label: "5360 — Subcontratação (dentro do estado)" },
  { value: "6353", label: "6353 — Transp. a estab. comercial interestadual" },
  { value: "6354", label: "6354 — Transp. a estab. de produtor rural interestadual" },
  { value: "6355", label: "6355 — Transp. a estab. não contribuinte interestadual" },
  { value: "6356", label: "6356 — Transp. a estab. industrial interestadual" },
  { value: "6357", label: "6357 — Transp. a pessoa física interestadual" },
  { value: "6358", label: "6358 — Redespacho interestadual" },
  { value: "6359", label: "6359 — Redespacho intermediário interestadual" },
  { value: "6360", label: "6360 — Subcontratação interestadual" },
  { value: "7353", label: "7353 — Prestação de serviço de transporte internacional" },
];

// ============================================================
// CST DE ICMS PARA TRANSPORTE
// ============================================================
export const CST_ICMS_TRANSPORTE = [
  { value: "00", label: "00 — Tributação plena" },
  { value: "20", label: "20 — Com redução de base de cálculo" },
  { value: "40", label: "40 — Isento" },
  { value: "41", label: "41 — Não tributado" },
  { value: "51", label: "51 — Diferimento" },
  { value: "60", label: "60 — ICMS cobrado anteriormente por substituição" },
  { value: "90", label: "90 — Outras" },
];

// CSOSN para Simples Nacional
export const CSOSN_OPTIONS = [
  { value: "101", label: "101 — Tributada com permissão de crédito" },
  { value: "102", label: "102 — Tributada sem permissão de crédito" },
  { value: "103", label: "103 — Isenção do ICMS no Simples Nacional" },
  { value: "300", label: "300 — Imune" },
  { value: "400", label: "400 — Não tributada" },
  { value: "500", label: "500 — ICMS cobrado por substituição tributária" },
  { value: "900", label: "900 — Outros" },
];

// ============================================================
// REGIMES TRIBUTÁRIOS
// ============================================================
export const REGIME_TRIBUTARIO_OPTIONS = [
  { value: "1", label: "1 — Simples Nacional" },
  { value: "2", label: "2 — Simples Nacional — excesso" },
  { value: "3", label: "3 — Regime Normal (Lucro Presumido / Real)" },
];

// ============================================================
// CÁLCULO DO ICMS
// ============================================================
export interface CalculoICMS {
  modalidade: "interno" | "interestadual" | "isento" | "diferimento";
  baseCalculo: number;
  aliquota: number;
  valorICMS: number;
  reducaoBase: number; // %
  baseCalculoReduzida: number;
  observacao: string;
}

export function calcularICMS(params: {
  valorPrestacao: number;
  ufOrigem: string;
  ufDestino: string;
  cst?: string;
  csosn?: string;
  reducaoBase?: number; // % de redução
  regime?: string; // "1" simples, "3" normal
  importado?: boolean;
}): CalculoICMS {
  const { valorPrestacao, ufOrigem, ufDestino, cst, csosn, reducaoBase = 0, regime = "3", importado = false } = params;

  const orig = (ufOrigem || "").toUpperCase().trim();
  const dest = (ufDestino || "").toUpperCase().trim();

  // Simples Nacional — ICMS incluído no DAS
  if (regime === "1" || regime === "2") {
    return {
      modalidade: "interno",
      baseCalculo: valorPrestacao,
      aliquota: 0,
      valorICMS: 0,
      reducaoBase: 0,
      baseCalculoReduzida: valorPrestacao,
      observacao: "Simples Nacional — ICMS incluído no DAS. Destaque não obrigatório.",
    };
  }

  // Isenção / Não tributado
  if (cst === "40" || cst === "41" || csosn === "400" || csosn === "300") {
    return {
      modalidade: "isento",
      baseCalculo: valorPrestacao,
      aliquota: 0,
      valorICMS: 0,
      reducaoBase: 0,
      baseCalculoReduzida: valorPrestacao,
      observacao: "Operação isenta ou não tributada de ICMS.",
    };
  }

  // Diferimento
  if (cst === "51") {
    return {
      modalidade: "diferimento",
      baseCalculo: valorPrestacao,
      aliquota: 0,
      valorICMS: 0,
      reducaoBase: 0,
      baseCalculoReduzida: valorPrestacao,
      observacao: "ICMS com diferimento — imposto será recolhido posteriormente.",
    };
  }

  const aliquota = getAliquotaICMS(orig, dest, orig === dest ? "interno" : "interestadual", importado);
  const modalidade: CalculoICMS["modalidade"] = orig === dest ? "interno" : "interestadual";

  // Redução de base
  const reducao = Math.max(0, Math.min(100, reducaoBase));
  const baseCalculoReduzida = valorPrestacao * (1 - reducao / 100);
  const valorICMS = Number(((baseCalculoReduzida * aliquota) / 100).toFixed(2));

  let observacao = `Alíquota ${modalidade === "interno" ? "interna" : "interestadual"} ${orig}→${dest}: ${aliquota}%`;
  if (reducao > 0) observacao += ` com redução de base de ${reducao}%`;
  if (cst === "20") observacao += " (CST 20 — base reduzida)";

  return {
    modalidade,
    baseCalculo: valorPrestacao,
    aliquota,
    valorICMS,
    reducaoBase: reducao,
    baseCalculoReduzida: Number(baseCalculoReduzida.toFixed(2)),
    observacao,
  };
}

// ============================================================
// FCP — FUNDO DE COMBATE À POBREZA (alguns estados cobram)
// ============================================================
export const FCP_POR_UF: Record<string, number> = {
  BA: 2,
  MA: 2,
  CE: 2,
  RJ: 2,
  MG: 0,
  SP: 0,
};

export function getFCP(uf: string): number {
  return FCP_POR_UF[(uf || "").toUpperCase().trim()] ?? 0;
}

// ============================================================
// HELPER: label do tipo de operação
// ============================================================
export function labelTipoOperacao(ufOrigem: string, ufDestino: string): string {
  const orig = (ufOrigem || "").toUpperCase().trim();
  const dest = (ufDestino || "").toUpperCase().trim();
  if (!orig || !dest) return "—";
  if (orig === dest) return `Interna (${orig})`;
  return `Interestadual (${orig} → ${dest})`;
}
