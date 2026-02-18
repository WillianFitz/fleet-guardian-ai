<?php
/**
 * Router para servidor PHP built-in
 * Redireciona todas as requisições para index.php
 */

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Se o arquivo existe e não é um diretório, servir diretamente
if ($uri !== '/' && file_exists(__DIR__ . $uri) && !is_dir(__DIR__ . $uri)) {
    return false;
}

// Caso contrário, redirecionar para index.php
require __DIR__ . '/index.php';
