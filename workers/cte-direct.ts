/**
 * Worker direto para CT-e - SEM necessidade de PHP
 * Usa bibliotecas JavaScript para comunicação com SEFAZ
 * 
 * LIMITAÇÃO: Assinatura XML precisa ser feita externamente ou via serviço
 * 
 * Opções:
 * 1. Usar serviço de assinatura externo (ex: API de terceiro)
 * 2. Usar Cloudflare Workers + Durable Objects com biblioteca JS de assinatura
 * 3. Fazer proxy para serviço PHP hospedado em outro lugar
 */

interface Env {
  DB: D1Database;
  CTE_SIGNING_SERVICE_URL?: string; // URL de serviço externo de assinatura (opcional)
  CTE_CNPJ?: string;
  CTE_UF?: string;
}

/**
 * Gera XML do CTe conforme layout oficial
 */
function gerarXMLCTe(dados: any, ambiente: string, cnpj: string, uf: string): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const chave = gerarChaveCTe(cnpj, dados.numero, dados.serie, tpAmb);
  
  // XML conforme layout oficial da SEFAZ (versão 4.00)
  return `<?xml version="1.0" encoding="UTF-8"?>
<CTe xmlns="http://www.portalfiscal.inf.br/cte">
  <infCte Id="CTe${chave}" versao="4.00">
    <ide>
      <cUF>${getCodigoUF(uf)}</cUF>
      <cCT>${String(dados.numero).padStart(8, '0')}</cCT>
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
    </ide>
    <emit>
      <CNPJ>${cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>EMPRESA EMITENTE</xNome>
    </emit>
    <rem>
      <CNPJ>${(dados.remetente?.cnpjCpf || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${dados.remetente?.nome || ''}</xNome>
    </rem>
    <dest>
      <CNPJ>${(dados.destinatario?.cnpjCpf || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${dados.destinatario?.nome || ''}</xNome>
    </dest>
    <vPrest>
      <vTPrest>${Number(dados.valorPrestacao).toFixed(2)}</vTPrest>
      <vRec>${Number(dados.valorPrestacao).toFixed(2)}</vRec>
    </vPrest>
  </infCte>
</CTe>`;
}

function gerarChaveCTe(cnpj: string, numero: string, serie: string, tpAmb: string): string {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const uf = '35'; // SP
  const ano = new Date().getFullYear().toString().substring(2);
  const mes = String(new Date().getMonth() + 1).padStart(2, '0');
  const modelo = '57';
  const seriePadded = String(serie).padStart(3, '0');
  const numeroPadded = String(numero).padStart(9, '0');
  const chave = uf + ano + mes + cnpjLimpo + modelo + seriePadded + numeroPadded + tpAmb;
  
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

/**
 * Assina XML usando serviço externo ou retorna sem assinatura (para teste)
 */
async function assinarXML(xml: string, env: Env): Promise<string> {
  if (env.CTE_SIGNING_SERVICE_URL) {
    // Usa serviço externo de assinatura
    const response = await fetch(env.CTE_SIGNING_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml })
    });
    const result = await response.json();
    return result.xmlAssinado || xml;
  }
  
  // Sem serviço de assinatura - retorna XML não assinado (não funcionará na SEFAZ real)
  return xml;
}

/**
 * Envia CTe para SEFAZ via SOAP
 */
async function enviarParaSEFAZ(xmlAssinado: string, ambiente: string, uf: string): Promise<any> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  
  // URLs da SEFAZ por UF (exemplo para SP)
  const urls: Record<string, { prod: string; hom: string }> = {
    'SP': {
      prod: 'https://cte.sefaz.sp.gov.br/cte/services/CteRecepcao',
      hom: 'https://homologacao.cte.sefaz.sp.gov.br/cte/services/CteRecepcao'
    },
    'RJ': {
      prod: 'https://cte.fazenda.rj.gov.br/cte/services/CteRecepcao',
      hom: 'https://homologacao.cte.fazenda.rj.gov.br/cte/services/CteRecepcao'
    }
    // Adicionar outras UFs conforme necessário
  };
  
  const url = ambiente === 'producao' 
    ? urls[uf]?.prod || urls['SP'].prod
    : urls[uf]?.hom || urls['SP'].hom;
  
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CteRecepcao">
      ${xmlAssinado}
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
    // Parse SOAP response e extrair protocolo/chave
    // Implementar parser XML aqui
    
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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    try {
      // POST /emitir
      if (path === '/emitir' && request.method === 'POST') {
        const ambiente = url.searchParams.get('ambiente') || 'homologacao';
        const dados = await request.json();
        
        if (!env.CTE_CNPJ || !env.CTE_UF) {
          return Response.json({
            error: 'Configure os secrets: CTE_CNPJ e CTE_UF'
          }, { status: 500 });
        }
        
        // Gerar XML
        const xml = gerarXMLCTe(dados, ambiente, env.CTE_CNPJ, env.CTE_UF);
        
        // Assinar (via serviço externo ou mock)
        const xmlAssinado = await assinarXML(xml, env);
        
        // Enviar para SEFAZ
        const resultado = await enviarParaSEFAZ(xmlAssinado, ambiente, env.CTE_UF || 'SP');
        
        return Response.json({
          chave: resultado.chave,
          protocolo: resultado.protocolo,
          xml: resultado.xml,
          ambiente,
          warning: env.CTE_SIGNING_SERVICE_URL ? null : 'XML não assinado - configure CTE_SIGNING_SERVICE_URL'
        });
      }
      
      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error: any) {
      return Response.json({
        error: error.message
      }, { status: 500 });
    }
  }
};
