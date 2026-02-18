FROM composer:2 AS deps
WORKDIR /app
COPY composer.json composer.lock* ./

# Instalar dependências com logs detalhados
RUN echo "Installing dependencies..." && \
    composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader --ignore-platform-req=ext-soap --verbose || \
    (echo "composer install failed, trying composer update..." && \
     composer update --no-dev --prefer-dist --no-interaction --optimize-autoloader --ignore-platform-req=ext-soap --verbose) && \
    echo "Checking if nfephp-org/sped-cte is installed..." && \
    composer show nfephp-org/sped-cte || (echo "ERROR: nfephp-org/sped-cte not found!" && exit 1)

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

COPY --from=deps /app/vendor /app/vendor
COPY . .

# Verificar se dependências estão instaladas
RUN php check-dependencies.php || (echo "Dependencies check failed!" && exit 1)

ENV PORT=8080
EXPOSE 8080

# O comando de start é definido no railway.json
# Fallback caso railway.json não seja usado
CMD ["php", "server.php"]

