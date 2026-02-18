#!/bin/sh
set -e

# Ler PORT da variável de ambiente (Railway define isso automaticamente)
PORT=${PORT:-8080}

echo "=========================================="
echo "Starting PHP server..."
echo "Port: $PORT"
echo "PHP Version: $(php -v | head -n 1)"
echo "=========================================="

# Verificar extensões
echo "Checking extensions..."
php -m | grep -E "(soap|zip|openssl|xml)" || echo "WARNING: Some extensions may be missing"

# Verificar arquivos necessários
if [ ! -d "vendor" ]; then
    echo "ERROR: vendor directory not found!"
    exit 1
fi

if [ ! -f "index.php" ]; then
    echo "ERROR: index.php not found!"
    exit 1
fi

if [ ! -f "router.php" ]; then
    echo "ERROR: router.php not found!"
    exit 1
fi

echo "All checks passed. Starting server on 0.0.0.0:$PORT..."
exec php -S 0.0.0.0:$PORT router.php
