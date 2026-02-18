FROM composer:2 AS deps
WORKDIR /app
COPY composer.json composer.lock* ./

# Instalar dependências com logs detalhados
RUN echo "Installing dependencies..." && \
    composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader --ignore-platform-reqs --verbose 2>&1 | tee /tmp/composer.log && \
    echo "Checking if nfephp-org/sped-cte is installed..." && \
    composer show nfephp-org/sped-cte || (echo "ERROR: nfephp-org/sped-cte not found! Logs:" && cat /tmp/composer.log && exit 1) && \
    echo "Checking vendor directory..." && \
    ls -la vendor/nfephp-org/ || echo "WARNING: vendor/nfephp-org/ not found"

FROM php:8.2-cli
WORKDIR /app

# Extensions required by nfephp-org/sped-cte
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    unzip \
    libxml2-dev \
    libzip-dev \
  && docker-php-ext-install soap zip \
  && rm -rf /var/lib/apt/lists/*

# Instalar Composer no segundo estágio para poder regenerar autoloader
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY --from=deps /app/vendor /app/vendor
COPY composer.json composer.lock* ./

# Regenerar autoloader para garantir que está atualizado
RUN composer dump-autoload --optimize --no-dev || echo "Warning: composer dump-autoload failed"

COPY . .

# OpenSSL 3: ativar provider legacy para ler certificados .pfx com algoritmos antigos
# (evita error:0308010C:digital envelope routines::unsupported)
ENV OPENSSL_CONF=/app/openssl-legacy.cnf

# Debug: Verificar o que foi instalado
RUN echo "=== Verificando instalação ===" && \
    php debug-autoload.php && \
    echo "=== Verificação concluída ==="

# Verificar se dependências estão instaladas (não falha o build, apenas avisa)
RUN php check-dependencies.php || echo "Dependencies check completed with warnings"

ENV PORT=8080
EXPOSE 8080

# O comando de start é definido no railway.json
# Fallback caso railway.json não seja usado
CMD ["php", "server.php"]

