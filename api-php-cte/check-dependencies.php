<?php
/**
 * Script para verificar se todas as dependências estão instaladas
 */

echo "Checking dependencies...\n";

// Verificar se vendor existe
if (!is_dir(__DIR__ . '/vendor')) {
    echo "ERROR: vendor directory not found!\n";
    exit(1);
}

// Carregar autoloader
require __DIR__ . '/vendor/autoload.php';

// Verificar classes necessárias
$classes = [
    'NFePHP\CTe\Make',
    'NFePHP\CTe\Tools',
    'NFePHP\Common\Certificate',
    'NFePHP\CTe\Common\Standardize',
    'Slim\Factory\AppFactory',
    'Psr\Http\Message\ResponseInterface',
    'Psr\Http\Message\ServerRequestInterface'
];

$missing = [];
foreach ($classes as $class) {
    if (!class_exists($class) && !interface_exists($class)) {
        $missing[] = $class;
    }
}

if (!empty($missing)) {
    echo "ERROR: Missing classes/interfaces:\n";
    foreach ($missing as $class) {
        echo "  - $class\n";
    }
    exit(1);
}

echo "All dependencies OK!\n";
exit(0);
