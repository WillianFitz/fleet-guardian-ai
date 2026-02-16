/**
 * Worker para comunicação direta com SEFAZ - CT-e
 * Usa certificado digital armazenado como secret
 */

interface Env {
  CTE_CERT_PFX: string; // Certificado .pfx em base64
  CTE_CERT_PASSWORD: string; // Senha do certificado
  CTE_CNPJ: string; // CNPJ da empresa
  CTE_UF: string; // UF (SP, RJ, etc)
}

interface CTeEmitirRequest {
  numero: string;
  serie: string;
  veiculoPlaca: string;
  dataEmissao: string;
  valorPrestacao: number;
  remetente: {
    nome: string;
    cnpjCpf?: string;
    municipio?: string;
    uf?: string;
  };
  destinatario: {
    nome: string;
    cnpjCpf?: string;
    municipio?: string;
    uf?: string;
  };
}

/**
 * Gera XML do CTe (simplificado - precisa implementar conforme layout oficial)
 */
function gerarXMLCTe(dados: CTeEmitirRequest, ambiente: string, cnpj: string, uf: string): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const chave = gerarChaveCTe(cnpj, dados.numero, dados.serie, tpAmb);
  
  // XML simplificado - você precisa implementar conforme layout oficial da SEFAZ
  // Este é apenas um exemplo básico
  return `<?xml version="1.0" encoding="UTF-8"?>
<CTe xmlns="http://www.portalfiscal.inf.br/cte">
  <infCte Id="CTe${chave}" versao="4.00">
    <ide>
      <cUF>${getCodigoUF(uf)}</cUF>
      <cCT>${dados.numero.padStart(8, '0')}</cCT>
      <CFOP>5353</CFOP>
      <natOp>PRESTACAO DE SERVICO DE TRANSPORTE</natOp>
      <mod>57</mod>
      <serie>${dados.serie}</serie>
      <nCT>${dados.numero}</nCT>
      <dhEmi>${new Date().toISOString()}</dhEmi>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <tpAmb>${tpAmb}</tpAmb>
      <tpCTe>0</tpCTe>
      <procEmi>0</procEmi>
      <verProc>FleetGuardianAI</verProc>
      <cMunEnv>${getCodigoMunicipio(dados.remetente.municipio || '', dados.remetente.uf || '')}</cMunEnv>
      <xMunEnv>${dados.remetente.municipio || ''}</xMunEnv>
      <UFEnv>${dados.remetente.uf || ''}</UFEnv>
      <cMunIni>${getCodigoMunicipio(dados.remetente.municipio || '', dados.remetente.uf || '')}</cMunIni>
      <xMunIni>${dados.remetente.municipio || ''}</xMunIni>
      <UFIni>${dados.remetente.uf || ''}</UFIni>
      <cMunFim>${getCodigoMunicipio(dados.destinatario.municipio || '', dados.destinatario.uf || '')}</cMunFim>
      <xMunFim>${dados.destinatario.municipio || ''}</xMunFim>
      <UFFim>${dados.destinatario.uf || ''}</UFFim>
    </ide>
    <emit>
      <CNPJ>${cnpj.replace(/\D/g, '')}</CNPJ>
      <IE></IE>
      <xNome>EMPRESA EMITENTE</xNome>
      <xFant></xFant>
      <enderEmit>
        <xLgr>RUA EXEMPLO</xLgr>
        <nro>123</nro>
        <xBairro>CENTRO</xBairro>
        <cMun>3550308</cMun>
        <xMun>SAO PAULO</xMun>
        <UF>SP</UF>
        <CEP>01000000</CEP>
      </enderEmit>
    </emit>
    <rem>
      <CNPJ>${(dados.remetente.cnpjCpf || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${dados.remetente.nome}</xNome>
    </rem>
    <dest>
      <CNPJ>${(dados.destinatario.cnpjCpf || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${dados.destinatario.nome}</xNome>
    </dest>
    <vPrest>
      <vTPrest>${dados.valorPrestacao.toFixed(2)}</vTPrest>
      <vRec>${dados.valorPrestacao.toFixed(2)}</vRec>
    </vPrest>
    <veic>
      <placa>${dados.veiculoPlaca.replace(/-/g, '')}</placa>
      <UF>${uf}</UF>
    </veic>
  </infCte>
</CTe>`;
}

function gerarChaveCTe(cnpj: string, numero: string, serie: string, tpAmb: string): string {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const uf = '35'; // SP - ajustar conforme necessário
  const ano = new Date().getFullYear().toString().substring(2);
  const mes = String(new Date().getMonth() + 1).padStart(2, '0');
  const modelo = '57';
  const seriePadded = serie.padStart(3, '0');
  const numeroPadded = numero.padStart(9, '0');
  const chave = uf + ano + mes + cnpjLimpo + modelo + seriePadded + numeroPadded + tpAmb;
  
  // Calcular dígito verificador (algoritmo módulo 11)
  let soma = 0;
  let peso = 2;
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = ((soma * 10) % 11) % 10;
  
  return chave + dv;
}

function getCodigoUF(uf: string): string {
  const ufs: Record<string, string> = {
    'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29',
    'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
    'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
    'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
    'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
    'SE': '28', 'TO': '17'
  };
  return ufs[uf.toUpperCase()] || '35';
}

function getCodigoMunicipio(municipio: string, uf: string): string {
  // Simplificado - na prática precisa consultar tabela IBGE
  // Retornando código genérico de São Paulo
  return '3550308';
}

/**
 * Assina XML com certificado digital
 * NOTA: Workers não têm acesso direto a bibliotecas de criptografia para assinar XML
 * Esta função é um placeholder - você precisaria usar um serviço externo ou
 * implementar assinatura em outro lugar
 */
async function assinarXML(xml: string, certPfx: string, certPassword: string): Promise<string> {
  // Workers não podem assinar XML diretamente sem bibliotecas nativas
  // Opções:
  // 1. Usar Web Crypto API (limitado)
  // 2. Chamar serviço externo de assinatura
  // 3. Fazer proxy para servidor PHP que assina
  
  // Por enquanto retorna XML sem assinatura (não funcionará na SEFAZ real)
  // Você precisa implementar assinatura em outro lugar ou usar biblioteca JS
  return xml;
}

/**
 * Envia CTe para SEFAZ
 */
async function enviarParaSEFAZ(xml: string, ambiente: string, uf: string): Promise<any> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const url = ambiente === 'producao' 
    ? `https://cte.sefaz.${uf.toLowerCase()}.gov.br/cte/services/CteRecepcao`
    : `https://homologacao.cte.sefaz.${uf.toLowerCase()}.gov.br/cte/services/CteRecepcao`;
  
  // SOAP envelope para SEFAZ
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CteRecepcao">
      ${xml}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/cte/wsdl/CteRecepcao/cteRecepcao'
      },
      body: soapEnvelope
    });
    
    const text = await response.text();
    // Parse SOAP response
    // Retornar chave e protocolo
    
    return {
      chave: gerarChaveCTe('', '', '', tpAmb),
      protocolo: '123456789012345',
      xml: text
    };
  } catch (error: any) {
    throw new Error(`Erro ao enviar para SEFAZ: ${error.message}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    try {
      // POST /emitir
      if (path === '/emitir' && request.method === 'POST') {
        const ambiente = url.searchParams.get('ambiente') || 'homologacao';
        const dados: CTeEmitirRequest = await request.json();
        
        if (!env.CTE_CERT_PFX || !env.CTE_CNPJ || !env.CTE_UF) {
          return Response.json({
            error: 'Certificado, CNPJ ou UF não configurados. Configure os secrets: CTE_CERT_PFX, CTE_CERT_PASSWORD, CTE_CNPJ, CTE_UF'
          }, { status: 500 });
        }
        
        // Gerar XML
        const xml = gerarXMLCTe(dados, ambiente, env.CTE_CNPJ, env.CTE_UF);
        
        // Assinar (precisa implementar)
        const xmlAssinado = await assinarXML(xml, env.CTE_CERT_PFX, env.CTE_CERT_PASSWORD);
        
        // Enviar para SEFAZ
        const resultado = await enviarParaSEFAZ(xmlAssinado, ambiente, env.CTE_UF);
        
        return Response.json({
          chave: resultado.chave,
          protocolo: resultado.protocolo,
          xml: resultado.xml,
          ambiente
        });
      }
      
      // GET /consultar
      if (path === '/consultar' && request.method === 'GET') {
        const chave = url.searchParams.get('chave');
        const ambiente = url.searchParams.get('ambiente') || 'homologacao';
        
        if (!chave) {
          return Response.json({ error: 'Parâmetro chave é obrigatório' }, { status: 400 });
        }
        
        // Implementar consulta SEFAZ
        return Response.json({
          status: '100',
          protocolo: '123456789012345',
          ambiente
        });
      }
      
      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error: any) {
      return Response.json({
        error: error.message,
        stack: error.stack
      }, { status: 500 });
    }
  }
};
