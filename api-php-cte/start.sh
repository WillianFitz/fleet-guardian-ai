#!/bin/sh
set -e

PORT=${PORT:-8080}

echo "Starting PHP server on port $PORT..."
echo "PHP Version: $(php -v | head -n 1)"
echo "Extensions loaded:"
php -m | grep -E "(soap|zip|openssl|xml)" || echo "Some extensions may be missing"

# Verificar se vendor existe
if [ ! -d "vendor" ]; then
    echo "ERROR: vendor directory not found!"
    exit 1
fi

# Verificar se index.php existe
if [ ! -f "index.php" ]; then
    echo "ERROR: index.php not found!"
    exit 1
fi

# Verificar se router.php existe
if [ ! -f "router.php" ]; then
    echo "ERROR: router.php not found!"
    exit 1
fi

echo "All files present. Starting server..."
exec php -S 0.0.0.0:$PORT router.php
