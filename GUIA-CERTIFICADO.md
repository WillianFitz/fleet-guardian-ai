# Guia: Como Configurar Certificado Digital para CT-e

## ⚠️ IMPORTANTE: Limitação dos Workers

**Cloudflare Workers NÃO podem assinar XML diretamente** porque:
- Não têm acesso a bibliotecas de criptografia XML (como OpenSSL)
- Não podem processar certificados .pfx nativamente
- A assinatura XML requer operações criptográficas complexas

## ✅ Soluções Possíveis

### Opção 1: Worker + Servidor PHP (RECOMENDADO)

**Como funciona:**
1. Worker recebe requisição do frontend
2. Worker faz proxy para servidor PHP
3. Servidor PHP assina XML e envia para SEFAZ
4. PHP retorna resultado para Worker
5. Worker retorna para frontend

**Vantagens:**
- Usa biblioteca oficial nfephp-org/sped-cte
- Assinatura XML funcionando
- Certificado seguro no servidor PHP

**Configuração:**
```bash
# 1. No Worker, configure apenas a URL do PHP:
npx wrangler secret put CTE_API_URL
# Digite: https://sua-api-php.com

# 2. No servidor PHP, configure certificado:
# - Coloque certificado.pfx em pasta segura
# - Configure senha em variável de ambiente
# - API PHP assina e envia para SEFAZ
```

### Opção 2: Worker + Serviço de Assinatura Externa

**Como funciona:**
1. Worker gera XML
2. Worker envia XML para serviço de assinatura (ex: API externa)
3. Serviço assina e retorna XML assinado
4. Worker envia para SEFAZ

**Vantagens:**
- Não precisa servidor PHP próprio
- Certificado fica em serviço especializado

**Desvantagens:**
- Custo adicional
- Dependência de terceiro

### Opção 3: Worker com Web Crypto API (LIMITADO)

**Como funciona:**
1. Worker usa Web Crypto API do navegador
2. Tenta assinar XML (limitado)

**Problemas:**
- Web Crypto API não suporta assinatura XML completa
- Não funciona para certificados A1 (.pfx)
- SEFAZ pode rejeitar

## 📋 Passo a Passo - Opção 1 (Recomendada)

### 1. Obter Certificado Digital

Você precisa de um **Certificado Digital A1** (.pfx):
- E-CPF ou E-CNPJ
- Válido e não expirado
- Pode ser de qualquer autoridade certificadora (AC)

### 2. Criar Servidor PHP

```bash
# Criar pasta
mkdir ~/api-cte-php
cd ~/api-cte-php

# Instalar dependências
composer require nfephp-org/sped-cte

# Criar estrutura básica (já criamos em api-php-cte/)
```

### 3. Configurar Certificado no PHP

```php
// config.php
$config = [
    'certificado' => [
        'pfx' => '/caminho/seguro/certificado.pfx',
        'password' => getenv('CERT_PASSWORD') // senha do certificado
    ],
    'cnpj' => '12.345.678/0001-90',
    'uf' => 'SP'
];
```

### 4. Upload do Certificado

**Opções seguras:**

**A) Via SFTP/SSH:**
```bash
# No seu computador
scp certificado.pfx usuario@servidor:/caminho/seguro/

# No servidor, proteger arquivo
chmod 600 /caminho/seguro/certificado.pfx
```

**B) Via Variável de Ambiente (Base64):**
```bash
# Converter certificado para base64
base64 -i certificado.pfx > cert_base64.txt

# No servidor PHP, decodificar:
$certPfx = base64_decode(getenv('CERT_PFX_BASE64'));
```

**C) Via Secrets (Railway/Render):**
- Upload via painel da plataforma
- Acessar via variável de ambiente

### 5. Configurar Worker

```bash
# Apenas configure a URL do PHP
npx wrangler secret put CTE_API_URL
# Digite: https://sua-api-php.com
```

## 🔒 Segurança do Certificado

**NUNCA:**
- ❌ Commitar certificado no Git
- ❌ Enviar certificado em requisições HTTP
- ❌ Armazenar certificado em localStorage
- ❌ Deixar certificado acessível publicamente

**SEMPRE:**
- ✅ Armazenar em pasta segura (fora web root)
- ✅ Usar permissões restritas (chmod 600)
- ✅ Usar variáveis de ambiente para senha
- ✅ Usar HTTPS para comunicação
- ✅ Rotacionar certificado antes de expirar

## 📝 Exemplo Completo - API PHP

Veja os arquivos em `api-php-cte/` que já criamos:
- `index.php` - Endpoints básicos
- `composer.json` - Dependências
- `README.md` - Instruções

## 🚀 Próximos Passos

1. **Escolha a Opção 1** (Worker + PHP) - mais confiável
2. **Obtenha certificado digital** se ainda não tem
3. **Configure servidor PHP** com certificado
4. **Configure Worker** apenas com URL do PHP
5. **Teste em homologação** primeiro!

## ❓ Dúvidas Comuns

**P: Posso usar certificado A3 (token)?**
R: Sim, mas precisa de servidor físico com leitora. A1 (.pfx) é mais prático.

**P: Preciso de certificado para cada ambiente?**
R: Não, o mesmo certificado funciona em homologação e produção.

**P: O certificado expira?**
R: Sim, geralmente 1-3 anos. Renove antes de expirar.

**P: Posso testar sem certificado?**
R: Sim, use MOCK mode (já implementado) para testar integração.
