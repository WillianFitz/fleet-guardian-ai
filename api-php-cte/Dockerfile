FROM composer:2 AS deps
WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

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

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT} -t ."]

