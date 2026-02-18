<?php
/**
 * Script de inicialização do servidor PHP
 * Lê PORT diretamente das variáveis de ambiente
 */

$port = getenv('PORT') ?: 8080;
$host = '0.0.0.0';

echo "Starting PHP server on {$host}:{$port}...\n";
echo "PHP Version: " . PHP_VERSION . "\n";

// Verificar extensões necessárias
$requiredExtensions = ['soap', 'zip', 'openssl', 'xml'];
$missing = [];
foreach ($requiredExtensions as $ext) {
    if (!extension_loaded($ext)) {
        $missing[] = $ext;
    }
}

if (!empty($missing)) {
    echo "WARNING: Missing extensions: " . implode(', ', $missing) . "\n";
}

// Verificar se router.php existe
if (!file_exists(__DIR__ . '/router.php')) {
    echo "ERROR: router.php not found!\n";
    exit(1);
}

// Verificar se vendor existe
if (!is_dir(__DIR__ . '/vendor')) {
    echo "ERROR: vendor directory not found!\n";
    exit(1);
}

echo "All checks passed. Starting server...\n";

// Iniciar servidor usando exec para substituir o processo atual
exec("php -S {$host}:{$port} router.php");
