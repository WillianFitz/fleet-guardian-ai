# 🚀 Guia Passo a Passo - Configurar API PHP no Railway

## 📋 Pré-requisitos

- ✅ Conta no GitHub (seu código já está lá)
- ✅ Conta no Railway (grátis, vamos criar agora)
- ✅ 10 minutos do seu tempo

---

## 🎯 Passo 1: Criar Conta no Railway

1. Acesse: **https://railway.app**
2. Clique em **"Start a New Project"** ou **"Login"**
3. Escolha **"Login with GitHub"**
4. Autorize o Railway a acessar seus repositórios
5. ✅ Pronto! Você está logado

---

## 🎯 Passo 2: Criar Novo Projeto

1. No painel do Railway, clique em **"New Project"**
2. Escolha **"Deploy from GitHub repo"**
3. Se aparecer lista de repositórios, procure por **`fleet-guardian-ai`**
4. Se não aparecer, clique em **"Configure GitHub App"** e autorize
5. Selecione o repositório **`fleet-guardian-ai`**
6. ✅ Railway vai criar o projeto automaticamente

---

## 🎯 Passo 3: Configurar Root Directory

**IMPORTANTE:** Railway precisa saber que a API PHP está na pasta `api-php-cte`, não na raiz!

1. No projeto criado, clique em **"Settings"** (engrenagem)
2. Role até **"Root Directory"**
3. Digite: **`api-php-cte`**
4. Clique em **"Save"**
5. ✅ Railway agora sabe onde está o código PHP

---

## 🎯 Passo 4: Configurar Build e Start

Railway geralmente detecta PHP automaticamente, mas vamos garantir:

1. Ainda em **Settings**, procure por **"Build Command"**
2. Se estiver vazio, adicione:
   ```
   composer install --no-dev --optimize-autoloader
   ```
3. Procure por **"Start Command"**
4. Se estiver vazio, adicione:
   ```
   php -S 0.0.0.0:$PORT -t .
   ```
5. Clique em **"Save"**
6. ✅ Configuração pronta!

**OU** se preferir, Railway já tem um arquivo `railway.json` na pasta `api-php-cte` que faz isso automaticamente! Então pode pular este passo se já existir.

---

## 🎯 Passo 5: Fazer Deploy

1. Volte para a aba **"Deployments"** ou **"Overview"**
2. Railway vai começar a fazer deploy automaticamente
3. Você verá logs aparecendo:
   ```
   Installing dependencies...
   composer install...
   Starting application...
   ```
4. Aguarde alguns minutos (primeira vez pode demorar)
5. ✅ Quando aparecer **"Deployed"** ou **"Active"**, está pronto!

---

## 🎯 Passo 6: Obter URL da API

1. No painel do projeto, procure por **"Domains"** ou **"Settings"**
2. Você verá uma URL tipo:
   ```
   https://seu-projeto-production.up.railway.app
   ```
   ou
   ```
   https://fleet-guardian-ai-production.railway.app
   ```
3. **COPIE ESSA URL!** Você vai precisar dela
4. ✅ URL obtida!

---

## 🎯 Passo 7: Testar se API está Funcionando

1. Abra uma nova aba no navegador
2. Cole a URL + `/health`:
   ```
   https://sua-url.railway.app/health
   ```
3. Deve aparecer algo como:
   ```json
   {"status":"ok","timestamp":"2026-02-16T..."}
   ```
4. ✅ Se aparecer isso, API está funcionando!

---

## 🎯 Passo 8: Configurar no Worker (Cloudflare)

Agora você precisa dizer pro Worker onde está a API PHP:

1. Abra o terminal/PowerShell
2. Navegue até a pasta do projeto:
   ```bash
   cd "C:\Users\SERVIDORSHOP\Documents\GitHub\fleet-guardian-ai"
   ```
3. Configure o secret:
   ```bash
   npx wrangler secret put CTE_API_URL
   ```
4. Quando pedir o valor, cole a URL do Railway:
   ```
   https://sua-url.railway.app
   ```
   (sem `/health` no final, só a URL base)
5. Pressione Enter
6. ✅ Configurado!

---

## 🎯 Passo 9: Fazer Deploy do Worker

1. Ainda no terminal, rode:
   ```bash
   npx wrangler deploy
   ```
2. Aguarde o deploy terminar
3. ✅ Worker atualizado!

---

## 🎯 Passo 10: Rodar Migração do Banco

Para adicionar o campo `uf` na tabela `tenants`:

1. No terminal, rode:
   ```bash
   npx wrangler d1 execute <NOME_DO_BANCO> --remote --file=./d1-migration-tenant-uf.sql
   ```
   
   **Substitua `<NOME_DO_BANCO>` pelo nome real do seu banco D1!**
   
   Exemplo:
   ```bash
   npx wrangler d1 execute fleet-guardian-db --remote --file=./d1-migration-tenant-uf.sql
   ```

2. ✅ Migração aplicada!

---

## ✅ Pronto! Agora é só usar

1. Abra seu sistema Fleet Guardian
2. Vá em **Configurações da Empresa**
3. Preencha:
   - Razão Social
   - CNPJ
   - **UF** (novo campo!)
   - Upload do certificado
4. Vá em **CT-es** → **Novo CTe** → **Emitir**
5. ✅ CT-e autorizado na SEFAZ!

---

## 🐛 Problemas Comuns

### Erro: "Root Directory not found"
**Solução:** Verifique se digitou `api-php-cte` corretamente (sem barra no final)

### Erro: "composer install failed"
**Solução:** Verifique se o arquivo `composer.json` existe na pasta `api-php-cte`

### Erro: "Port already in use"
**Solução:** Railway usa variável `$PORT` automaticamente, não precisa mudar nada

### API não responde
**Solução:** 
1. Verifique os logs no Railway (aba "Deployments" → clique no deploy → "View Logs")
2. Verifique se a URL está correta
3. Teste `/health` primeiro

### Worker não encontra API
**Solução:**
1. Verifique se `CTE_API_URL` está configurada: `npx wrangler secret list`
2. Teste a URL diretamente no navegador
3. Verifique se não tem `/` no final da URL

---

## 📸 Screenshots (Referência)

### Railway - New Project
```
[New Project] → [Deploy from GitHub repo] → [Selecionar fleet-guardian-ai]
```

### Railway - Settings
```
Settings → Root Directory: api-php-cte → Save
```

### Railway - Domains
```
Settings → Domains → Copiar URL
```

---

## 🎉 Pronto!

Agora você tem:
- ✅ API PHP rodando no Railway
- ✅ Worker configurado para usar a API
- ✅ Banco de dados atualizado
- ✅ Sistema pronto para emitir CT-e!

**Qualquer dúvida, me avise!** 😊
