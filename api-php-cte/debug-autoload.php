<?php
/**
 * Script de debug para verificar autoloader e classes instaladas
 */

echo "=== DEBUG AUTOLOAD ===\n\n";

// Verificar vendor
echo "1. Verificando vendor/autoload.php...\n";
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    echo "   ✓ vendor/autoload.php existe\n";
    require __DIR__ . '/vendor/autoload.php';
    echo "   ✓ Autoloader carregado\n";
} else {
    echo "   ✗ vendor/autoload.php NÃO existe!\n";
    exit(1);
}

// Verificar pacote instalado
echo "\n2. Verificando pacotes instalados...\n";
$composerLock = __DIR__ . '/vendor/composer/installed.json';
if (file_exists($composerLock)) {
    $installed = json_decode(file_get_contents($composerLock), true);
    echo "   Pacotes encontrados:\n";
    foreach ($installed['packages'] ?? [] as $pkg) {
        if (strpos($pkg['name'], 'nfephp') !== false || strpos($pkg['name'], 'slim') !== false) {
            echo "   - {$pkg['name']}: {$pkg['version']}\n";
        }
    }
} else {
    echo "   ⚠ composer/installed.json não encontrado\n";
}

// Verificar classes
echo "\n3. Verificando classes...\n";
$classes = [
    'NFePHP\CTe\Make',
    'NFePHP\CTe\Tools',
    'NFePHP\Common\Certificate',
    'NFePHP\CTe\Common\Standardize',
    'Slim\Factory\AppFactory'
];

foreach ($classes as $class) {
    if (class_exists($class) || interface_exists($class)) {
        echo "   ✓ $class existe\n";
    } else {
        echo "   ✗ $class NÃO encontrada\n";
        
        // Tentar encontrar arquivo
        $parts = explode('\\', $class);
        $className = array_pop($parts);
        $namespace = implode('\\', $parts);
        
        echo "      Namespace: $namespace\n";
        echo "      Class: $className\n";
    }
}

// Verificar estrutura de diretórios
echo "\n4. Verificando estrutura de diretórios vendor...\n";
$vendorDirs = [
    'vendor/nfephp-org',
    'vendor/nfephp-org/sped-cte',
    'vendor/nfephp-org/sped-common',
    'vendor/slim'
];

foreach ($vendorDirs as $dir) {
    $path = __DIR__ . '/' . $dir;
    if (is_dir($path)) {
        echo "   ✓ $dir existe\n";
        $files = scandir($path);
        echo "      Arquivos: " . implode(', ', array_slice($files, 0, 5)) . "...\n";
    } else {
        echo "   ✗ $dir NÃO existe\n";
    }
}

echo "\n=== FIM DEBUG ===\n";
