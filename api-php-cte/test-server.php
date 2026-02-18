<?php
/**
 * Script de teste simples para verificar se o servidor está funcionando
 * Acesse: http://localhost:PORT/test-server.php
 */

header('Content-Type: application/json');
echo json_encode([
    'status' => 'ok',
    'message' => 'Servidor PHP está funcionando',
    'php_version' => PHP_VERSION,
    'extensions' => [
        'soap' => extension_loaded('soap'),
        'zip' => extension_loaded('zip'),
        'openssl' => extension_loaded('openssl'),
        'xml' => extension_loaded('xml')
    ],
    'vendor_exists' => file_exists(__DIR__ . '/vendor/autoload.php'),
    'timestamp' => date('c')
]);
