# Guia: Hospedar API PHP no Cloudflare

## ⚠️ IMPORTANTE: Cloudflare NÃO hospeda PHP diretamente

**Cloudflare oferece:**
- ✅ Workers (JavaScript/TypeScript)
- ✅ Pages (JavaScript/TypeScript)
- ✅ Durable Objects (JavaScript/TypeScript)
- ❌ **NÃO suporta PHP nativamente**

## ✅ Soluções Possíveis

### Opção 1: Usar Outro Serviço + Cloudflare na Frente (RECOMENDADO)

**Como funciona:**
```
Frontend → Cloudflare (CDN/Proxy) → Serviço PHP → SEFAZ
```

**Serviços que hospedam PHP grátis/barato:**
1. **Railway** (grátis com limites)
2. **Render** (grátis com limites)
3. **Fly.io** (suporta PHP)
4. **Heroku** (pago)
5. **VPS próprio** (DigitalOcean, Linode, etc)

**Passo a passo:**

1. **Deploy PHP em Railway:**
```bash
# Criar projeto Railway
railway init
railway up

# Configurar variáveis:
# - CERT_PFX_BASE64 (certificado em base64)
# - CERT_PASSWORD (senha)
# - PORT (Railway define automaticamente)
```

2. **Configurar Cloudflare como Proxy:**
- Adicionar domínio no Cloudflare
- Configurar DNS apontando para Railway
- Ativar Proxy (nuvem laranja)
- Cloudflare fica na frente automaticamente

3. **Configurar Worker:**
```bash
npx wrangler secret put CTE_API_URL
# Digite: https://sua-api.railway.app (ou seu domínio)
```

### Opção 2: Worker Direto (SEM PHP) - LIMITADO

**Criei arquivo `workers/cte-direct.ts`** que tenta fazer tudo em TypeScript.

**Problemas:**
- ❌ Não pode assinar XML sem biblioteca externa
- ❌ Precisa de serviço de assinatura terceiro
- ❌ Complexidade alta

**Como usar:**
```bash
# Adicionar ao wrangler.jsonc
{
  "workers": [
    {
      "name": "cte-direct",
      "main": "workers/cte-direct.ts",
      "routes": ["cte.yourdomain.com/*"]
    }
  ]
}

# Configurar secrets:
npx wrangler secret put CTE_CNPJ
npx wrangler secret put CTE_UF
npx wrangler secret put CTE_SIGNING_SERVICE_URL  # Opcional
```

### Opção 3: Cloudflare Pages Functions (NÃO FUNCIONA)

Pages Functions só suporta JavaScript/TypeScript, não PHP.

## 🚀 Solução Recomendada: Railway + Cloudflare

### Passo a Passo Completo

#### 1. Criar API PHP no Railway

```bash
# No seu computador
cd api-php-cte

# Criar arquivo railway.json
cat > railway.json << EOF
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "php -S 0.0.0.0:\$PORT -t ."
  }
}
EOF

# Criar Procfile (alternativa)
echo "web: php -S 0.0.0.0:\$PORT -t ." > Procfile

# Fazer commit
git init
git add .
git commit -m "API PHP CT-e"

# Deploy no Railway
railway login
railway init
railway up
```

#### 2. Configurar Variáveis no Railway

No painel Railway:
- `CERT_PFX_BASE64` = certificado em base64
- `CERT_PASSWORD` = senha do certificado
- `CTE_CNPJ` = seu CNPJ
- `CTE_UF` = sua UF

#### 3. Obter URL do Railway

Railway fornece URL tipo: `https://seu-projeto.up.railway.app`

#### 4. Configurar Cloudflare

1. Adicione domínio no Cloudflare
2. Crie registro DNS:
   - Tipo: CNAME
   - Nome: `cte-api`
   - Conteúdo: `seu-projeto.up.railway.app`
   - Proxy: ✅ Ativado (nuvem laranja)

3. Aguarde propagação DNS

#### 5. Configurar Worker

```bash
npx wrangler secret put CTE_API_URL
# Digite: https://cte-api.seudominio.com
# (ou use a URL direta do Railway)
```

## 📋 Comparação de Serviços

| Serviço | Grátis? | PHP? | Fácil? | Recomendado? |
|---------|---------|------|--------|--------------|
| Railway | ✅ Sim | ✅ Sim | ⭐⭐⭐ | ✅ SIM |
| Render | ✅ Sim | ✅ Sim | ⭐⭐⭐ | ✅ SIM |
| Fly.io | ✅ Sim | ✅ Sim | ⭐⭐ | ⚠️ Médio |
| Heroku | ❌ Pago | ✅ Sim | ⭐⭐⭐ | ⚠️ Pago |
| VPS | ❌ Pago | ✅ Sim | ⭐ | ⚠️ Complexo |

## 🎯 Recomendação Final

**Use Railway + Cloudflare:**

1. ✅ Railway hospeda PHP grátis
2. ✅ Cloudflare fica na frente (CDN + Proxy)
3. ✅ Worker apenas faz proxy interno
4. ✅ Tudo funciona perfeitamente

**Comandos rápidos:**

```bash
# 1. Deploy PHP no Railway
cd api-php-cte
railway init
railway up

# 2. Configurar Worker
npx wrangler secret put CTE_API_URL
# Digite URL do Railway

# 3. Pronto! ✅
```

## ❓ Dúvidas?

**P: Posso usar só Railway sem Cloudflare?**
R: Sim! Configure Worker com URL direta do Railway.

**P: Railway é grátis mesmo?**
R: Sim, com limites. Suficiente para começar.

**P: Preciso de domínio próprio?**
R: Não! Railway fornece URL grátis.

**P: Cloudflare melhora performance?**
R: Sim, CDN + cache + proteção DDoS.
