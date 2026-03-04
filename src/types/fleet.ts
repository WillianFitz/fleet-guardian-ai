// ===== VEHICLES =====
export interface Vehicle {
  id: string;
  placa: string;
  modelo: string;
  tipo: string;
  categoria: string;
  ano: number;
  km: number;
  status: "operando" | "manutencao" | "parado" | "vendido";
  motorista: string;
  chassi: string;
  renavam: string;
  cor: string;
  combustivel: string;
  createdAt: string;
}

// ===== DRIVERS =====
export interface Driver {
  id: string;
  nome: string;
  cpf: string;
  cnh: string;
  categoriaCnh: string;
  vencimentoCnh: string;
  telefone: string;
  email: string;
  status: "ativo" | "inativo" | "ferias" | "afastado";
  dataAdmissao: string;
  vencimentoExameMedico: string;
}

// ===== MAINTENANCE =====
export interface MaintenanceOrder {
  id: string;
  numero: string;
  veiculoId: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  tipo: "preventiva" | "corretiva";
  descricao: string;
  status: "aberta" | "em_andamento" | "concluida" | "cancelada";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  data: string;
  dataConclusao?: string;
  custo: number;
  oficina: string;
  observacoes: string;
}

// ===== FUEL =====
export interface FuelEntry {
  id: string;
  veiculoPlaca: string;
  motorista: string;
  data: string;
  litros: number;
  valor: number;
  kmAtual: number;
  kmAnterior: number;
  consumo: number;
  posto: string;
  tipoCombustivel: string;
}

// ===== TIRES =====
export interface Tire {
  id: string;
  codigo: string;
  marca: string;
  modelo: string;
  medida: string;
  dot: string;
  status: "novo" | "em_uso" | "recapado" | "descartado";
  posicao: string;
  veiculoPlaca: string;
  kmInstalacao: number;
  kmAtual: number;
  sulco: number;
  reformas: number;
}

// ===== PARTS/INVENTORY =====
export interface Part {
  id: string;
  codigo: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
  custoUnitario: number;
  localizacao: string;
  fornecedor: string;
}

// ===== EXPENSES =====
export interface Expense {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  veiculoPlaca: string;
  fornecedor: string;
  notaFiscal: string;
  status: "pendente" | "pago" | "cancelado";
  centroCusto: string;
}

// ===== LICENSES =====
export interface License {
  id: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  tipo: "ipva" | "licenciamento" | "seguro_obrigatorio";
  anoReferencia: string;
  valor: number;
  dataVencimento: string;
  status: "pago" | "pendente" | "vencido" | "parcelado";
  parcelas: number;
  parcelasPagas: number;
}

// ===== INSURANCE =====
export interface Insurance {
  id: string;
  apolice: string;
  seguradora: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  tipo: string;
  valorPremio: number;
  valorFranquia: number;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: "ativa" | "vencida" | "cancelada";
  abrangencia: string;
}

// ===== INCIDENTS =====
export interface Incident {
  id: string;
  tipo: "multa" | "acidente" | "avaria" | "sinistro";
  data: string;
  veiculoPlaca: string;
  motorista: string;
  descricao: string;
  valor: number;
  status: "aberto" | "em_recurso" | "pago" | "resolvido";
  local: string;
  pontosCnh: number;
}

// ===== RECEITAS/FRETES =====
export interface Receita {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  veiculoPlaca: string;
  cliente: string;
  cteId?: string; // vinculado a um CTe
  cteChave?: string;
  cteNumero?: string;
  notaFiscal?: string;
  status: "pendente" | "recebido" | "cancelado";
  formaPagamento?: string;
  dataRecebimento?: string;
  observacoes?: string;
}

// Tipo de documento originário do CT-e (fluxo de criação)
export type FluxoOrigemCTe = "manual" | "nfe" | "cte_outro" | "nota_talao" | "outros";

// Dados para fluxo "outros documentos" (Declaração, CF-e, NFC-e, etc.)
export interface InfOutrosDoc {
  tpDoc: "00" | "04" | "05" | "99"; // 00=Declaração, 04=CF-e/SAT, 05=NFC-e, 99=Outros
  descOutros: string;
  nDoc: string;
  vDocFisc: number;
  dEmi: string;
}

// ===== CTe (Conhecimento de Transporte Eletrônico) =====
export interface CTe {
  id: string;
  chave: string;
  /** Fluxo de origem: manual, nfe, cte_outro, nota_talao, outros */
  fluxoOrigem?: FluxoOrigemCTe;
  numero: string;
  serie: string;
  veiculoPlaca: string;
  veiculoModelo?: string;
  dataEmissao: string;
  dataInicioViagem?: string;
  valorPrestacao: number;
  valorFrete?: number;
  remetenteNome: string;
  remetenteCnpjCpf?: string;
  remetenteCep?: string;
  remetenteLogradouro?: string;
  remetenteNumero?: string;
  remetenteBairro?: string;
  remetenteMunicipio?: string;
  remetenteUf?: string;
  destinatarioNome: string;
  destinatarioCnpjCpf?: string;
  destinatarioCep?: string;
  destinatarioLogradouro?: string;
  destinatarioNumero?: string;
  destinatarioBairro?: string;
  destinatarioMunicipio?: string;
  destinatarioUf?: string;
  municipioOrigem?: string;
  ufOrigem?: string;
  municipioDestino?: string;
  ufDestino?: string;
  status: "rascunho" | "autorizado" | "rejeitado" | "cancelado" | "erro";
  protocolo?: string;
  motivoRejeicao?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  receitaId?: string;
  /** Chave NFe (44 dígitos) - fluxo NFe */
  chaveNFe?: string;
  /** Chave CT-e (44 dígitos) - fluxo subcontratação/redespacho */
  chaveCTe?: string;
  /** Tipo de serviço quando CT-e de outra transportadora: 1=Subcontratação, 2=Redespacho, 3=Redespacho Intermediário */
  tpServ?: "1" | "2" | "3";
  /** Dados para fluxo "outros documentos" */
  infOutros?: InfOutrosDoc;
  /** Itens/cargas extraídas do XML ou adicionadas manualmente */
  infCarga?: Array<{ numero?: string; produto?: string; valor?: number; peso?: number; chave?: string }>;
  /** Informações adicionais livres */
  informacoesAdicionais?: string[];
  /** Quem paga o frete (tomador) */
  tomador?: string;
  /** Número da nota origem (quando aplicável) */
  numeroNota?: string;
  /** Indicadores de presença de expedidor / recebedor */
  hasExpedidor?: boolean;
  hasRecebedor?: boolean;
  /** CFOP */
  cfop?: string;
  /** Valor do frete */
  valorFrete?: number;
  /** Se deve emitir retroativo */
  emitirRetroativo?: boolean;
  /** Texto automático para nota / observações */
  textoNota?: string;

  // ===== TRIBUTAÇÃO / ICMS =====
  /** Regime tributário: "1"=Simples, "2"=Simples excesso, "3"=Normal */
  regimeTributario?: string;
  /** CST de ICMS (regime normal) */
  cstIcms?: string;
  /** CSOSN (Simples Nacional) */
  csosn?: string;
  /** Base de cálculo do ICMS */
  icmsBaseCalculo?: number;
  /** Alíquota ICMS (%) */
  icmsAliquota?: number;
  /** Valor do ICMS calculado */
  icmsValor?: number;
  /** Percentual de redução da base de cálculo */
  icmsReducaoBase?: number;
  /** Valor FCP (Fundo de Combate à Pobreza) */
  fcpValor?: number;
  /** RNTRC — Registro Nacional de Transportadores Rodoviários de Cargas */
  rntrc?: string;
  /** IE (Inscrição Estadual) do emitente */
  ieEmitente?: string;
  /** CNAE do emitente */
  cnae?: string;
  /** Produto predominante / descrição da carga */
  produtoPredominante?: string;
  /** Modal (01=Rodoviário, 02=Aéreo, etc.) */
  modal?: string;
}

// ===== CLIENTS =====
export interface Client {
  id: string;
  nome: string;
  cnpjCpf?: string;
  indicadorIE?: string;
  ie?: string;
  contato?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  createdAt?: string;
}

// ===== GARAGE =====
export interface GarageEntry {
  id: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  motorista: string;
  tipo: "entrada" | "saida";
  data: string;
  hora: string;
  km: number;
  destino: string;
  observacoes: string;
  status: "aprovado" | "pendente" | "negado";
}
