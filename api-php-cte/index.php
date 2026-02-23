<?php
/**
 * API PHP para CT-e - Fleet Guardian AI
 * Endpoints:
 * POST /emitir?ambiente=homologacao|producao
 * GET /consultar?chave=...&ambiente=homologacao|producao
 */

// Tratamento de erros para debug
error_reporting(E_ALL);
ini_set('display_errors', '0'); // Não mostrar erros na produção, mas logar
ini_set('log_errors', '1');

try {
    require __DIR__ . '/vendor/autoload.php';
    
    // Verificar se classes críticas estão disponíveis
    if (!class_exists('NFePHP\CTe\MakeCTe')) {
        throw new \Exception('Biblioteca nfephp-org/sped-cte não encontrada. Verifique se composer install foi executado corretamente.');
    }
    
    if (!class_exists('Slim\Factory\AppFactory')) {
        throw new \Exception('Biblioteca slim/slim não encontrada. Verifique se composer install foi executado corretamente.');
    }
} catch (\Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Erro ao carregar dependências',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'vendor_exists' => is_dir(__DIR__ . '/vendor'),
        'autoload_exists' => file_exists(__DIR__ . '/vendor/autoload.php')
    ]);
    exit;
}

use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\CTeService;
use App\NFeBuscaSefazService;

/** Helper: Slim 4 PSR-7 Response não tem withJson(), então criamos um */
function jsonResponse(Response $response, $data, int $status = 200): Response {
    $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
    return $response
        ->withHeader('Content-Type', 'application/json; charset=utf-8')
        ->withStatus($status);
}

try {
    // Criar app Slim
    $app = AppFactory::create();
    
    // Configurar para capturar erros
    $errorMiddleware = $app->addErrorMiddleware(true, true, true);
    
} catch (\Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Erro ao inicializar aplicação',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
    exit;
}

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
        return jsonResponse($response, ['error' => 'Body JSON inválido'], 400);
    }
    
    // Certificado pode vir no body (por tenant) ou usar variável de ambiente (fallback)
    $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
    $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
    
    if (!$certPfxBase64 || !$certPassword) {
        return jsonResponse($response, [
            'error' => 'Certificado digital não configurado. Faça upload do certificado nas configurações da empresa.'
        ], 400);
    }
    
    try {
        // Decodificar certificado base64
        $certPfx = base64_decode($certPfxBase64);
        
        // Salvar temporariamente para usar com nfephp-org/sped-cte
        $tempCertPath = sys_get_temp_dir() . '/cert_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        
        // Dados da empresa vêm do Worker (banco de dados do sistema)
        // Variáveis de ambiente são apenas fallback (não necessário se Worker enviar)
        $empresaDados = [
            'cnpj' => $body['empresa']['cnpj'] ?? getenv('CTE_CNPJ') ?? '',
            'razaoSocial' => $body['empresa']['razaoSocial'] ?? getenv('CTE_RAZAO_SOCIAL') ?? '',
            'siglaUF' => $body['empresa']['siglaUF'] ?? getenv('CTE_UF') ?? 'SP'
        ];
        
        if (empty($empresaDados['cnpj']) || empty($empresaDados['razaoSocial'])) {
            @unlink($tempCertPath);
            return jsonResponse($response, [
                'error' => 'Dados da empresa não informados. Cadastre CNPJ e Nome da empresa nas Configurações do sistema.'
            ], 400);
        }
        
        // Criar serviço CTe
        $cteService = new CTeService($tempCertPath, $certPassword, $empresaDados, $ambiente);
        
        // Emitir CT-e
        $resultado = $cteService->emitir($body);
        
        // Limpar arquivo temporário
        @unlink($tempCertPath);
        
        return jsonResponse($response, $resultado);
        
    } catch (\Exception $e) {
        return jsonResponse($response, [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});

/**
 * POST /validar-certificado
 * Valida certificado digital e retorna informações
 */
$app->post('/validar-certificado', function (Request $request, Response $response): Response {
    $body = json_decode($request->getBody()->getContents(), true);
    
    if (!$body || !$body['certificadoPfxBase64'] || !$body['certificadoPassword']) {
        return jsonResponse($response, ['error' => 'Certificado e senha são obrigatórios'], 400);
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
            $openSslError = function_exists('openssl_error_string') ? (openssl_error_string() ?: '') : '';
            $mensagem = 'Senha incorreta ou certificado inválido.';
            if (strpos($openSslError, '0308010C') !== false || stripos($openSslError, 'unsupported') !== false || stripos($openSslError, 'digital envelope') !== false) {
                $mensagem = 'Impossível ler o certificado (OpenSSL 3). Configure OPENSSL_CONF com o provider legacy (openssl-legacy.cnf) no servidor. Erro: ' . $openSslError;
            }
            return jsonResponse($response, [
                'valido' => false,
                'mensagem' => $mensagem
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
        
        return jsonResponse($response, [
            'valido' => $valido,
            'expirado' => !$valido,
            'validoAte' => $validoAte,
            'cnpj' => $cnpjCert,
            'mensagem' => $valido ? 'Certificado válido' : 'Certificado expirado'
        ]);
        
    } catch (\Exception $e) {
        return jsonResponse($response, [
            'error' => $e->getMessage()
        ], 500);
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
        return jsonResponse($response, ['error' => 'Parâmetro chave é obrigatório'], 400);
    }
    
    // Certificado vem do Worker no body (já processado)
    // Por enquanto usa mock
    
    try {
        // Certificado pode vir do body (POST) ou variável de ambiente
        $body = json_decode($request->getBody()->getContents(), true) ?? [];
        $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
        $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
        
        if (!$certPfxBase64 || !$certPassword) {
            return jsonResponse($response, [
                'error' => 'Certificado digital não configurado para consulta.'
            ], 400);
        }
        
        // Decodificar certificado
        $certPfx = base64_decode($certPfxBase64);
        $tempCertPath = sys_get_temp_dir() . '/cert_cons_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        
        // Dados da empresa vêm do Worker (banco de dados do sistema)
        $empresaDados = [
            'cnpj' => $body['empresa']['cnpj'] ?? getenv('CTE_CNPJ') ?? '',
            'razaoSocial' => $body['empresa']['razaoSocial'] ?? getenv('CTE_RAZAO_SOCIAL') ?? '',
            'siglaUF' => $body['empresa']['siglaUF'] ?? getenv('CTE_UF') ?? 'SP'
        ];
        
        if (empty($empresaDados['cnpj']) || empty($empresaDados['razaoSocial'])) {
            @unlink($tempCertPath);
            return jsonResponse($response, [
                'error' => 'Dados da empresa não informados. Cadastre CNPJ e Nome da empresa nas Configurações do sistema.'
            ], 400);
        }
        
        // Criar serviço CTe
        $cteService = new CTeService($tempCertPath, $certPassword, $empresaDados, $ambiente);
        
        // Consultar CT-e
        $resultado = $cteService->consultar($chave);
        
        // Limpar arquivo temporário
        @unlink($tempCertPath);
        
        return jsonResponse($response, $resultado);
        
    } catch (\Exception $e) {
        return jsonResponse($response, [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});

/**
 * POST /nfe-busca-sefaz
 * Busca NF-e na SEFAZ (Distribuição DFe) referentes ao CNPJ da empresa
 * Body: certificado (pfxBase64, password), empresa (cnpj, razaoSocial, siglaUF), ambiente, ultNSU (opcional)
 */
$app->post('/nfe-busca-sefaz', function (Request $request, Response $response): Response {
    $body = json_decode($request->getBody()->getContents(), true);
    if (!$body) {
        return jsonResponse($response, ['error' => 'Body JSON inválido'], 400);
    }
    $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
    $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
    if (!$certPfxBase64 || !$certPassword) {
        return jsonResponse($response, [
            'error' => 'Certificado digital não configurado. Faça upload nas configurações da empresa.'
        ], 400);
    }
    try {
        $certPfx = base64_decode($certPfxBase64);
        $tempCertPath = sys_get_temp_dir() . '/cert_busca_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        $empresaDados = [
            'cnpj' => $body['empresa']['cnpj'] ?? getenv('CTE_CNPJ') ?? '',
            'razaoSocial' => $body['empresa']['razaoSocial'] ?? getenv('CTE_RAZAO_SOCIAL') ?? '',
            'siglaUF' => $body['empresa']['siglaUF'] ?? getenv('CTE_UF') ?? 'SP'
        ];
        if (empty($empresaDados['cnpj']) || empty($empresaDados['razaoSocial'])) {
            @unlink($tempCertPath);
            return jsonResponse($response, [
                'error' => 'Dados da empresa não informados. Cadastre CNPJ e Nome nas Configurações.'
            ], 400);
        }
        $ambiente = $body['ambiente'] ?? 'homologacao';
        $ultNSU = (int)($body['ultNSU'] ?? 0);
        // fullScan: se true, permite varredura completa; senão, busca apenas 1 página (modo seguro)
        $fullScan = isset($body['fullScan']) ? (bool)$body['fullScan'] : false;
        $maxIter = $fullScan ? 50 : 1;
        $buscaService = new NFeBuscaSefazService($tempCertPath, $certPassword, $empresaDados, $ambiente);
        $resultado = $buscaService->buscar($ultNSU, $maxIter);
        @unlink($tempCertPath);
        return jsonResponse($response, $resultado);
    } catch (\Exception $e) {
        return jsonResponse($response, [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});

/**
 * POST /nfe/consultar
 * Consulta uma NF-e específica pela chave (chNFe) usando Distribuição DFe.
 * Body: { chave: string, certificado: { pfxBase64, password }, empresa: { cnpj, razaoSocial, siglaUF }, ambiente }
 */
$app->post('/nfe/consultar', function (Request $request, Response $response): Response {
    $body = json_decode($request->getBody()->getContents(), true);
    if (!$body || empty($body['chave'])) {
        return jsonResponse($response, ['error' => 'Body JSON inválido ou chave não informada'], 400);
    }
    $chave = $body['chave'];
    $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
    $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
    if (!$certPfxBase64 || !$certPassword) {
        return jsonResponse($response, [
            'error' => 'Certificado digital não configurado. Faça upload nas configurações da empresa.'
        ], 400);
    }

    try {
        $certPfx = base64_decode($certPfxBase64);
        $tempCertPath = sys_get_temp_dir() . '/cert_nfe_cons_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        $empresaDados = [
            'cnpj' => $body['empresa']['cnpj'] ?? getenv('CTE_CNPJ') ?? '',
            'razaoSocial' => $body['empresa']['razaoSocial'] ?? getenv('CTE_RAZAO_SOCIAL') ?? '',
            'siglaUF' => $body['empresa']['siglaUF'] ?? getenv('CTE_UF') ?? 'SP'
        ];
        if (empty($empresaDados['cnpj']) || empty($empresaDados['razaoSocial'])) {
            @unlink($tempCertPath);
            return jsonResponse($response, [
                'error' => 'Dados da empresa não informados. Cadastre CNPJ e Nome nas Configurações.'
            ], 400);
        }
        $ambiente = $body['ambiente'] ?? 'homologacao';
        $buscaService = new NFeBuscaSefazService($tempCertPath, $certPassword, $empresaDados, $ambiente);
        // 1) tentar buscar via Distribuição DFe (varredura)
        $item = $buscaService->buscarPorChave($chave, 50);
        if ($item) {
            @unlink($tempCertPath);
            return jsonResponse($response, ['nfe' => $item]);
        }

        // 2) fallback: tentar consulta direta por chave (sefazConsulta)
        try {
            $consult = $buscaService->consultarPorChave($chave);
            @unlink($tempCertPath);
            if (!empty($consult['parsed'])) {
                return jsonResponse(['nfe' => $consult['parsed']]);
            }
            // retornar raw se não houver parsed
            return jsonResponse(['raw' => $consult['raw']]);
        } catch (\Exception $e) {
            @unlink($tempCertPath);
            return jsonResponse($response, ['error' => 'NF-e não encontrada na Distribuição DFe para o CNPJ/empresa informada e consulta direta falhou: ' . $e->getMessage()], 404);
        }
    } catch (\Exception $e) {
        return jsonResponse($response, [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
});

// Health check
$app->get('/health', function (Request $request, Response $response): Response {
    return jsonResponse($response, ['status' => 'ok', 'timestamp' => date('c')]);
});

// GET /consultar também pode receber certificado no body (POST)
$app->post('/consultar', function (Request $request, Response $response): Response {
    $queryParams = $request->getQueryParams();
    $body = json_decode($request->getBody()->getContents(), true);
    $chave = $queryParams['chave'] ?? $body['chave'] ?? null;
    $ambiente = $queryParams['ambiente'] ?? $body['ambiente'] ?? 'homologacao';
    
    if (!$chave) {
        return jsonResponse($response, ['error' => 'Parâmetro chave é obrigatório'], 400);
    }
    
    // Certificado pode vir no body
    $certPfxBase64 = $body['certificado']['pfxBase64'] ?? getenv('CERT_PFX_BASE64');
    $certPassword = $body['certificado']['password'] ?? getenv('CERT_PASSWORD');
    
    try {
        // Certificado já vem no body
        if (!$certPfxBase64 || !$certPassword) {
            return jsonResponse($response, [
                'error' => 'Certificado digital não configurado para consulta.'
            ], 400);
        }
        
        // Decodificar certificado
        $certPfx = base64_decode($certPfxBase64);
        $tempCertPath = sys_get_temp_dir() . '/cert_cons_' . uniqid() . '.pfx';
        file_put_contents($tempCertPath, $certPfx);
        
        // Dados da empresa vêm do Worker (banco de dados do sistema)
        $empresaDados = [
            'cnpj' => $body['empresa']['cnpj'] ?? getenv('CTE_CNPJ') ?? '',
            'razaoSocial' => $body['empresa']['razaoSocial'] ?? getenv('CTE_RAZAO_SOCIAL') ?? '',
            'siglaUF' => $body['empresa']['siglaUF'] ?? getenv('CTE_UF') ?? 'SP'
        ];
        
        if (empty($empresaDados['cnpj']) || empty($empresaDados['razaoSocial'])) {
            @unlink($tempCertPath);
            return jsonResponse($response, [
                'error' => 'Dados da empresa não informados. Cadastre CNPJ e Nome da empresa nas Configurações do sistema.'
            ], 400);
        }
        
        // Criar serviço CTe
        $cteService = new CTeService($tempCertPath, $certPassword, $empresaDados, $ambiente);
        
        // Consultar CT-e
        $resultado = $cteService->consultar($chave);
        
        // Limpar arquivo temporário
        @unlink($tempCertPath);
        
        return jsonResponse($response, $resultado);
    } catch (\Exception $e) {
        return jsonResponse($response, ['error' => $e->getMessage()], 500);
    }
});

try {
    $app->run();
} catch (\Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Erro ao processar requisição',
        'message' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
