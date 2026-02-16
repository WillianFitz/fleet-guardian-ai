<?php
/**
 * API PHP para CT-e - Fleet Guardian AI
 * Endpoints:
 * POST /emitir?ambiente=homologacao|producao
 * GET /consultar?chave=...&ambiente=homologacao|producao
 */

require __DIR__ . '/vendor/autoload.php';

use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

$app = AppFactory::create();

// CORS headers
$app->add(function (Request $request, $handler): Response {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
});

// OPTIONS preflight
$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
    return $response;
});

/**
 * POST /emitir?ambiente=homologacao|producao
 * Recebe dados do CTe e emite na SEFAZ
 */
$app->post('/emitir', function (Request $request, Response $response): Response {
    $queryParams = $request->getQueryParams();
    $ambiente = $queryParams['ambiente'] ?? 'homologacao'; // homologacao ou producao
    
    $body = json_decode($request->getBody()->getContents(), true);
    
    if (!$body) {
        return $response->withStatus(400)->withJson(['error' => 'Body JSON inválido']);
    }
    
    // Certificado pode vir no body (por tenant) ou usar variável de ambiente (fallback)
    $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
    $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
    
    if (!$certPfxBase64 || !$certPassword) {
        return $response->withStatus(400)->withJson([
            'error' => 'Certificado digital não configurado. Faça upload do certificado nas configurações da empresa.'
        ]);
    }
    
    try {
        // Decodificar certificado base64
        $certPfx = base64_decode($certPfxBase64);
        
        // Salvar temporariamente para usar com nfephp-org/sped-cte
        $tempCertPath = sys_get_temp_dir() . '/cert_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        
        // TODO: Implementar emissão usando nfephp-org/sped-cte com certificado
        // $tools = new \NFePHP\CTe\Tools($config, \NFePHP\Common\Certificate::readPfx($tempCertPath, $certPassword));
        // $resp = $tools->sefazEnvia($xml, $ambiente === 'producao' ? '1' : '2');
        
        // Limpar arquivo temporário
        @unlink($tempCertPath);
        // TODO: Implementar emissão usando nfephp-org/sped-cte
        // Por enquanto retorna mock para teste
        
        // Exemplo de como seria:
        // $cte = new \NFePHP\CTe\Make();
        // $cte->taginfCte(...);
        // $cte->monta();
        // $xml = $cte->getXML();
        // 
        // $tools = new \NFePHP\CTe\Tools($config, \NFePHP\Common\Certificate::readPfx($certPfx, $certPass));
        // $resp = $tools->sefazEnvia($xml, $ambiente === 'producao' ? '1' : '2');
        
        // Mock response para teste
        $mockResponse = [
            'chave' => '352' . str_pad(rand(100000000, 999999999), 9, '0', STR_PAD_LEFT) . '57' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT) . rand(100, 999),
            'protocolo' => '123456789012345',
            'xml' => '<?xml version="1.0"?><CTe>...</CTe>',
            'ambiente' => $ambiente,
            'message' => 'CTe emitido com sucesso (MOCK - implementar com SPED-CTe)'
        ];
        
        return $response->withJson($mockResponse);
        
    } catch (\Exception $e) {
        return $response->withStatus(500)->withJson([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
    }
});

/**
 * POST /validar-certificado
 * Valida certificado digital e retorna informações
 */
$app->post('/validar-certificado', function (Request $request, Response $response): Response {
    $body = json_decode($request->getBody()->getContents(), true);
    
    if (!$body || !$body['certificadoPfxBase64'] || !$body['certificadoPassword']) {
        return $response->withStatus(400)->withJson(['error' => 'Certificado e senha são obrigatórios']);
    }
    
    try {
        $certPfx = base64_decode($body['certificadoPfxBase64']);
        $certPassword = $body['certificadoPassword'];
        $cnpjEsperado = $body['cnpj'] ?? null;
        
        // Salvar temporariamente
        $tempCertPath = sys_get_temp_dir() . '/cert_val_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        
        // Tentar ler certificado
        $cert = null;
        if (function_exists('openssl_pkcs12_read')) {
            $certData = [];
            if (openssl_pkcs12_read($certPfx, $certData, $certPassword)) {
                $cert = $certData;
            }
        }
        
        @unlink($tempCertPath);
        
        if (!$cert) {
            return $response->withJson([
                'valido' => false,
                'mensagem' => 'Senha incorreta ou certificado inválido'
            ]);
        }
        
        // Extrair informações do certificado
        $certInfo = openssl_x509_parse($cert['cert']);
        $validoAte = date('Y-m-d', $certInfo['validTo_time_t']);
        $valido = $certInfo['validTo_time_t'] > time();
        $cnpjCert = null;
        
        // Tentar extrair CNPJ do subject
        if (isset($certInfo['subject']['CN'])) {
            $cn = $certInfo['subject']['CN'];
            // Extrair CNPJ do CN (formato pode variar)
            preg_match('/\d{14}/', $cn, $matches);
            if ($matches) {
                $cnpjCert = $matches[0];
            }
        }
        
        return $response->withJson([
            'valido' => $valido,
            'expirado' => !$valido,
            'validoAte' => $validoAte,
            'cnpj' => $cnpjCert,
            'mensagem' => $valido ? 'Certificado válido' : 'Certificado expirado'
        ]);
        
    } catch (\Exception $e) {
        return $response->withStatus(500)->withJson([
            'error' => $e->getMessage()
        ]);
    }
});

/**
 * GET /consultar?chave=...&ambiente=homologacao|producao
 * Consulta status do CTe na SEFAZ
 */
$app->get('/consultar', function (Request $request, Response $response): Response {
    $queryParams = $request->getQueryParams();
    $chave = $queryParams['chave'] ?? null;
    $ambiente = $queryParams['ambiente'] ?? 'homologacao';
    
    if (!$chave) {
        return $response->withStatus(400)->withJson(['error' => 'Parâmetro chave é obrigatório']);
    }
    
    // Certificado vem do Worker no body (já processado)
    // Por enquanto usa mock
    
    try {
        // TODO: Implementar consulta usando nfephp-org/sped-cte
        // Por enquanto retorna mock para teste
        
        // Exemplo de como seria:
        // $tools = new \NFePHP\CTe\Tools($config, \NFePHP\Common\Certificate::readPfx($certPfx, $certPass));
        // $resp = $tools->sefazConsulta($chave, $ambiente === 'producao' ? '1' : '2');
        
        // Mock response para teste
        $mockResponse = [
            'status' => '100', // 100 = autorizado
            'protocolo' => '123456789012345',
            'xml' => '<?xml version="1.0"?><retConsSitCTe>...</retConsSitCTe>',
            'ambiente' => $ambiente,
            'message' => 'Consulta realizada (MOCK - implementar com SPED-CTe)'
        ];
        
        return $response->withJson($mockResponse);
        
    } catch (\Exception $e) {
        return $response->withStatus(500)->withJson([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
    }
});

// Health check
$app->get('/health', function (Request $request, Response $response): Response {
    return $response->withJson(['status' => 'ok', 'timestamp' => date('c')]);
});

// GET /consultar também pode receber certificado no body (POST)
$app->post('/consultar', function (Request $request, Response $response): Response {
    $queryParams = $request->getQueryParams();
    $body = json_decode($request->getBody()->getContents(), true);
    $chave = $queryParams['chave'] ?? $body['chave'] ?? null;
    $ambiente = $queryParams['ambiente'] ?? $body['ambiente'] ?? 'homologacao';
    
    if (!$chave) {
        return $response->withStatus(400)->withJson(['error' => 'Parâmetro chave é obrigatório']);
    }
    
    // Certificado pode vir no body
    $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
    $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
    
    try {
        // TODO: Implementar consulta real com certificado
        return $response->withJson([
            'status' => '100',
            'protocolo' => '123456789012345',
            'ambiente' => $ambiente
        ]);
    } catch (\Exception $e) {
        return $response->withStatus(500)->withJson(['error' => $e->getMessage()]);
    }
});

$app->run();
