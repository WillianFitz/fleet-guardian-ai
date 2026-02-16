# 🚀 Guia Simplificado - Deploy API CT-e

## ✅ Tudo é feito no sistema, sem cadastrar em vários lugares!

---

## 📋 O que você precisa fazer

### 1. Deploy no Railway (só uma vez)

1. Acesse [railway.app](https://railway.app) e faça login
2. **New Project** → **Deploy from GitHub repo**
3. Selecione seu repositório `fleet-guardian-ai`
4. Configure **Root Directory**: `api-php-cte`
5. Railway faz o resto automaticamente! ✅

### 2. Obter URL da API

Railway fornece uma URL tipo:
```
https://seu-projeto.up.railway.app
```

**Guarde essa URL!**

### 3. Configurar Worker (só uma vez)

```bash
npx wrangler secret put CTE_API_URL
# Cole a URL do Railway quando pedir
```

```bash
npx wrangler deploy
```

### 4. Rodar migração do banco (só uma vez)

```bash
npx wrangler d1 execute <NOME_DO_BANCO> --remote --file=./d1-migration-tenant-uf.sql
```

Isso adiciona o campo `uf` na tabela `tenants`.

---

## 🎯 Cadastrar no Sistema (Frontend)

**TUDO é feito aqui, só aqui!** Não precisa cadastrar em mais nenhum lugar.

### 1. Configurações da Empresa

Vá em **Configurações da Empresa** e preencha:

- ✅ **CNPJ**: Seu CNPJ (ex: 12.345.678/0001-90)
- ✅ **Nome**: Razão Social da empresa  
- ✅ **UF**: Estado (SP, RJ, MG, etc.)

### 2. Upload do Certificado

Na mesma tela:
- Faça upload do arquivo `.pfx` do certificado
- Digite a senha do certificado
- Sistema valida automaticamente ✅

### 3. Escolher Ambiente

- **Homologação**: Para testes (comece aqui!)
- **Produção**: Para emissões reais

---

## ✅ Pronto!

Agora é só usar:

1. Vá em **CT-es** → **Novo CTe**
2. Preencha os dados
3. Clique em **Emitir**
4. ✅ CT-e autorizado na SEFAZ!

---

## 🔍 Como funciona

```
Você cadastra no sistema (frontend)
    ↓
Sistema salva no banco D1
    ↓
Worker busca automaticamente do banco
    ↓
Worker envia para API PHP (Railway)
    ↓
API PHP emite na SEFAZ
    ↓
✅ CT-e autorizado!
```

**Você não precisa fazer nada manualmente!** Tudo é automático. 🎉

---

## ⚠️ Se der erro

### "Dados da empresa incompletos"
- **Solução**: Cadastre CNPJ e Nome nas Configurações da Empresa

### "Certificado digital não configurado"
- **Solução**: Faça upload do certificado nas Configurações

### "Erro ao comunicar com API CTe"
- **Solução**: Verifique se `CTE_API_URL` está configurada no Worker

---

## 📝 Resumo

- ✅ **Railway**: Só deploy (automático)
- ✅ **Worker**: Só configurar URL (uma vez)
- ✅ **Sistema**: Cadastrar empresa e certificado (aqui que você faz tudo!)

**Fácil, né?** 😊
