# 🔧 Como Instalar Extensão SOAP do PHP

## ⚠️ Problema

O `sped-cte` precisa da extensão SOAP do PHP para se comunicar com a SEFAZ.

**Erro:**
```
nfephp-org/sped-cte requires ext-soap * -> it is missing from your system
```

---

## ✅ Solução - Ubuntu/Debian

### 1. Instalar extensão SOAP

```bash
sudo apt update
sudo apt install php-soap
```

### 2. Verificar se instalou

```bash
php -m | grep soap
```

**Deve aparecer:** `soap`

### 3. Se não aparecer, reinicie PHP-FPM (se estiver usando)

```bash
sudo systemctl restart php8.1-fpm
# ou
sudo systemctl restart php-fpm
```

### 4. Agora instalar dependências

```bash
cd ~/fleet-guardian-ai/api-php-cte
composer install --no-dev --optimize-autoloader
```

---

## ✅ Solução - CentOS/RHEL

```bash
sudo yum install php-soap
# ou
sudo dnf install php-soap
```

---

## ✅ Solução - Outros Sistemas

### Via PECL:

```bash
sudo pecl install soap
```

### Ou compilar manualmente (não recomendado)

---

## 🔍 Verificar Extensões PHP Instaladas

```bash
php -m
```

**Deve aparecer na lista:** `soap`

---

## 🧪 Testar se Funcionou

```bash
php -r "echo extension_loaded('soap') ? 'SOAP OK' : 'SOAP FALTOU';"
```

**Deve aparecer:** `SOAP OK`

---

## 📝 Depois de Instalar SOAP

1. ✅ Instalar dependências:
   ```bash
   composer install --no-dev --optimize-autoloader
   ```

2. ✅ Testar servidor:
   ```bash
   php -S 0.0.0.0:8000 -t .
   ```

3. ✅ Testar endpoint:
   ```bash
   curl http://localhost:8000/health
   ```

---

## ⚠️ Se Ainda Não Funcionar

### Verificar arquivo php.ini:

```bash
php --ini
```

### Editar php.ini:

```bash
sudo nano /etc/php/8.1/cli/php.ini
```

Procure por:
```ini
;extension=soap
```

Descomente (remova o `;`):
```ini
extension=soap
```

Salve e teste novamente.

---

## 🎯 Comandos Rápidos (Copiar e Colar)

```bash
# Instalar SOAP
sudo apt update && sudo apt install php-soap -y

# Verificar
php -m | grep soap

# Instalar dependências
cd ~/fleet-guardian-ai/api-php-cte
composer install --no-dev --optimize-autoloader

# Testar
php -S 0.0.0.0:8000 -t .
```

---

## ✅ Pronto!

Depois disso, o `composer install` deve funcionar! 🎉
