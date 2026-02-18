#!/bin/sh
set -e

# Ler PORT da variável de ambiente
PORT="${PORT:-8080}"

# Debug
echo "=========================================="
echo "Railway PHP Server Startup"
echo "PORT environment variable: $PORT"
echo "PHP Version: $(php -v | head -n 1)"
echo "=========================================="

# Executar server.php que lê PORT via getenv()
exec php server.php
