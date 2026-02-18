<?php
/**
 * Router para servidor PHP built-in
 * Redireciona todas as requisições para index.php
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Health check simples (não depende do Slim)
if ($uri === '/health' || $uri === '/health/') {
    header('Content-Type: application/json');
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'timestamp' => date('c'),
        'php_version' => PHP_VERSION
    ]);
    return true;
}

// Se o arquivo existe e não é um diretório, servir diretamente
if ($uri !== '/' && $uri !== '' && file_exists(__DIR__ . $uri) && !is_dir(__DIR__ . $uri)) {
    return false;
}

// Caso contrário, redirecionar para index.php
if (file_exists(__DIR__ . '/index.php')) {
    try {
        require __DIR__ . '/index.php';
    } catch (\Throwable $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Erro ao processar requisição',
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
    }
} else {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'index.php not found']);
}
