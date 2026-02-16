/**
 * Worker completo para emissão de CT-e - Cloudflare Workers
 * 
 * ⚠️ LIMITAÇÕES:
 * - Assinatura XML pode não funcionar completamente (Web Crypto API é limitada)
 * - Pode precisar de ajustes para SEFAZ aceitar
 * - Recomendado: usar PHP para produção
 * 
 * Este é um exemplo funcional, mas pode precisar de ajustes.
 */

interface Env {
  DB: D1Database;
  CTE_CNPJ?: string;
  CTE_UF?: string;
  CTE_RAZAO_SOCIAL?: string;
}

interface CTeDados {
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
 * Gera chave do CT-e (44 dígitos)
 */
function gerarChaveCTe(cnpj: string, numero: string, serie: string, tpAmb: string, uf: string): string {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const codigoUF = getCodigoUF(uf);
  const ano = new Date().getFullYear().toString().substring(2);
  const mes = String(new Date().getMonth() + 1).padStart(2, '0');
  const modelo = '57';
  const seriePadded = serie.padStart(3, '0');
  const numeroPadded = numero.padStart(9, '0');
  
  const chave = codigoUF + ano + mes + cnpjLimpo + modelo + seriePadded + numeroPadded + tpAmb;
  
  // Calcular dígito verificador
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
  // Simplificado - em produção precisa tabela IBGE completa
  const codigos: Record<string, Record<string, string>> = {
    'SP': { 'SAO PAULO': '3550308', 'CAMPINAS': '3509502' },
    'RJ': { 'RIO DE JANEIRO': '3304557' },
    'MG': { 'BELO HORIZONTE': '3106200' }
  };
  return codigos[uf]?.[municipio.toUpperCase()] || '3550308';
}

/**
 * Monta XML do CT-e
 */
function montarXMLCTe(dados: CTeDados, empresa: { cnpj: string; razaoSocial: string; uf: string }, ambiente: string): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');
  const chave = gerarChaveCTe(empresa.cnpj, dados.numero, dados.serie, tpAmb, empresa.uf);
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CTe xmlns="http://www.portalfiscal.inf.br/cte">
  <infCte Id="CTe${chave}" versao="4.00">
    <ide>
      <cUF>${getCodigoUF(empresa.uf)}</cUF>
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
      <verProc>FleetGuardianAI-Worker</verProc>
      <cMunEnv>${getCodigoMunicipio(dados.remetente.municipio || '', dados.remetente.uf || empresa.uf)}</cMunEnv>
      <xMunEnv>${dados.remetente.municipio || ''}</xMunEnv>
      <UFEnv>${dados.remetente.uf || empresa.uf}</UFEnv>
      <cMunIni>${getCodigoMunicipio(dados.remetente.municipio || '', dados.remetente.uf || empresa.uf)}</cMunIni>
      <xMunIni>${dados.remetente.municipio || ''}</xMunIni>
      <UFIni>${dados.remetente.uf || empresa.uf}</UFIni>
      <cMunFim>${getCodigoMunicipio(dados.destinatario.municipio || '', dados.destinatario.uf || '')}</cMunFim>
      <xMunFim>${dados.destinatario.municipio || ''}</xMunFim>
      <UFFim>${dados.destinatario.uf || ''}</UFFim>
    </ide>
    <emit>
      <CNPJ>${cnpjLimpo}</CNPJ>
      <IE></IE>
      <xNome>${empresa.razaoSocial}</xNome>
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
      <CNPJ>${(dados.remetente.cnpjCpf || '').replace(/\D/g, '').length === 14 ? (dados.remetente.cnpjCpf || '').replace(/\D/g, '') : ''}</CNPJ>
      <CPF>${(dados.remetente.cnpjCpf || '').replace(/\D/g, '').length === 11 ? (dados.remetente.cnpjCpf || '').replace(/\D/g, '') : ''}</CPF>
      <xNome>${dados.remetente.nome}</xNome>
    </rem>
    <dest>
      <CNPJ>${(dados.destinatario.cnpjCpf || '').replace(/\D/g, '').length === 14 ? (dados.destinatario.cnpjCpf || '').replace(/\D/g, '') : ''}</CNPJ>
      <CPF>${(dados.destinatario.cnpjCpf || '').replace(/\D/g, '').length === 11 ? (dados.destinatario.cnpjCpf || '').replace(/\D/g, '') : ''}</CPF>
      <xNome>${dados.destinatario.nome}</xNome>
    </dest>
    <vPrest>
      <vTPrest>${dados.valorPrestacao.toFixed(2)}</vTPrest>
      <vRec>${dados.valorPrestacao.toFixed(2)}</vRec>
    </vPrest>
    <veic>
      <placa>${dados.veiculoPlaca.replace(/\D/g, '')}</placa>
      <UF>${empresa.uf}</UF>
    </veic>
  </infCte>
</CTe>`;
  
  return xml;
}

/**
 * ⚠️ ASSINATURA XML - LIMITADA
 * 
 * Workers não têm bibliotecas completas de assinatura XML.
 * Esta função é um placeholder - pode não funcionar completamente.
 * 
 * Para produção, recomendo usar PHP ou serviço externo de assinatura.
 */
async function assinarXML(xml: string, certPfxBase64: string, certPassword: string): Promise<string> {
  // ⚠️ IMPLEMENTAÇÃO SIMPLIFICADA - PODE NÃO FUNCIONAR
  // 
  // Para assinar XML corretamente, você precisaria:
  // 1. Decodificar certificado .pfx (precisa biblioteca como node-forge)
  // 2. Extrair chave privada
  // 3. Criar assinatura XML conforme padrão XML-DSig
  // 4. Inserir assinatura no XML
  //
  // Web Crypto API não suporta tudo isso diretamente.
  //
  // Por enquanto, retorna XML sem assinatura (não funcionará na SEFAZ real)
  
  console.warn('⚠️ Assinatura XML não implementada completamente em Workers');
  console.warn('⚠️ XML será enviado sem assinatura - SEFAZ pode rejeitar');
  
  return xml; // ⚠️ XML não assinado
}

/**
 * Envia CT-e para SEFAZ via SOAP
 */
async function enviarParaSEFAZ(xmlAssinado: string, ambiente: string, uf: string): Promise<any> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  
  // URLs da SEFAZ (exemplo para SP)
  const urls: Record<string, { prod: string; hom: string }> = {
    'SP': {
      prod: 'https://cte.sefaz.sp.gov.br/cte/services/CteRecepcao',
      hom: 'https://homologacao.cte.sefaz.sp.gov.br/cte/services/CteRecepcao'
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
    
    // ⚠️ Parse SOAP response (simplificado)
    // Em produção, precisa parser XML completo
    
    return {
      chave: '',
      protocolo: '',
      xml: text,
      raw: text
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
      // POST /api/cte/emitir
      if (path === '/api/cte/emitir' && request.method === 'POST') {
        const body = await request.json();
        const ambiente = body.ambiente || 'homologacao';
        
        // Buscar dados do tenant
        const authHeader = request.headers.get('Authorization');
        // ... lógica de autenticação ...
        
        // Por enquanto, usar dados do env ou body
        const empresa = {
          cnpj: body.empresa?.cnpj || env.CTE_CNPJ || '',
          razaoSocial: body.empresa?.razaoSocial || env.CTE_RAZAO_SOCIAL || 'EMPRESA LTDA',
          uf: body.empresa?.siglaUF || env.CTE_UF || 'SP'
        };
        
        if (!empresa.cnpj) {
          return Response.json({
            error: 'CNPJ da empresa não informado'
          }, { status: 400 });
        }
        
        // Buscar certificado do banco (se autenticado)
        const certPfxBase64 = body.certificado?.pfxBase64 || '';
        const certPassword = body.certificado?.password || '';
        
        if (!certPfxBase64 || !certPassword) {
          return Response.json({
            error: 'Certificado digital não configurado'
          }, { status: 400 });
        }
        
        // Montar XML
        const xml = montarXMLCTe(body, empresa, ambiente);
        
        // ⚠️ Assinar (limitado)
        const xmlAssinado = await assinarXML(xml, certPfxBase64, certPassword);
        
        // Enviar para SEFAZ
        const resultado = await enviarParaSEFAZ(xmlAssinado, ambiente, empresa.uf);
        
        return Response.json({
          chave: gerarChaveCTe(empresa.cnpj, body.numero, body.serie, ambiente === 'producao' ? '1' : '2', empresa.uf),
          protocolo: resultado.protocolo || '',
          xml: resultado.xml,
          ambiente,
          warning: '⚠️ Assinatura XML pode não estar completa - use PHP para produção'
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
