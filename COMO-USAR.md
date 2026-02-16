# 🎯 Como Usar - Tudo no Sistema!

## ✅ **IMPORTANTE: Você só cadastra no sistema (frontend)!**

Não precisa cadastrar em vários lugares. Tudo é automático! 🎉

---

## 📋 Passo a Passo

### 1. Deploy no Railway (só uma vez, no início)

1. Acesse [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Selecione `fleet-guardian-ai`
4. Configure **Root Directory**: `api-php-cte`
5. Copie a URL que o Railway fornece (ex: `https://seu-projeto.up.railway.app`)

### 2. Configurar Worker (só uma vez, no início)

```bash
npx wrangler secret put CTE_API_URL
# Cole a URL do Railway quando pedir
```

```bash
npx wrangler deploy
```

### 3. Rodar migração do banco (só uma vez, no início)

```bash
npx wrangler d1 execute <NOME_DO_BANCO> --remote --file=./d1-migration-tenant-uf.sql
```

---

## 🎯 **CADASTRO NO SISTEMA (Aqui você faz tudo!)**

### Vá em **Configurações da Empresa** e preencha:

1. ✅ **Razão Social** (ex: Transportadora Exemplo LTDA)
2. ✅ **CNPJ** (ex: 12.345.678/0001-90)
3. ✅ **UF** (selecione seu estado: SP, RJ, MG, etc.)
4. ✅ **Telefone** (opcional)
5. ✅ **E-mail** (opcional)
6. ✅ **Endereço** (opcional)

### Upload do Certificado Digital:

Na mesma tela:
- Faça upload do arquivo `.pfx` do certificado
- Digite a senha do certificado
- Sistema valida automaticamente ✅

### Escolher Ambiente:

- **Homologação**: Para testes (comece aqui!)
- **Produção**: Para emissões reais

---

## ✅ Pronto! Agora é só usar

1. Vá em **CT-es** → **Novo CTe**
2. Preencha os dados do CT-e
3. Clique em **Emitir**
4. ✅ CT-e autorizado na SEFAZ!

---

## 🔍 Como Funciona (Automático!)

```
Você cadastra no sistema (Configurações)
    ↓
Sistema salva no banco D1
    ↓
Quando você emite CT-e:
    ↓
Worker busca automaticamente:
  - CNPJ da empresa
  - Razão Social
  - UF
  - Certificado digital
    ↓
Worker envia tudo para API PHP (Railway)
    ↓
API PHP emite na SEFAZ
    ↓
✅ CT-e autorizado!
```

**Você não precisa fazer nada manualmente!** Tudo é automático. 🎉

---

## ⚠️ Se der erro

### "Dados da empresa incompletos"
- **Solução**: Vá em Configurações e preencha CNPJ, Nome e UF

### "Certificado digital não configurado"
- **Solução**: Faça upload do certificado nas Configurações

### "Erro ao comunicar com API CTe"
- **Solução**: Verifique se `CTE_API_URL` está configurada no Worker

---

## 📝 Resumo

- ✅ **Railway**: Deploy automático (só uma vez)
- ✅ **Worker**: Configurar URL (só uma vez)
- ✅ **Sistema**: Cadastrar empresa e certificado (aqui você faz tudo!)

**Fácil, né?** 😊
