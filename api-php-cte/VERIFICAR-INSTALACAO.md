# ✅ Como Verificar se API PHP Está Configurada Corretamente

## 🔍 Checklist Rápido

### 1. Arquivos Necessários

Verifique se estes arquivos existem na pasta `api-php-cte/`:

- ✅ `index.php` (arquivo principal)
- ✅ `composer.json` (dependências)
- ✅ `src/CTeService.php` (classe de emissão)
- ✅ `railway.json` (config Railway - opcional mas recomendado)

### 2. Testar Localmente (Antes de Deploy)

```bash
cd api-php-cte
composer install
php -S localhost:8000 -t .
```

Abra no navegador: `http://localhost:8000/health`

**Deve retornar:**
```json
{"status":"ok","timestamp":"..."}
```

Se funcionar localmente, vai funcionar no Railway! ✅

---

## 🚀 Verificar Deploy no Railway

### 1. Logs do Railway

No painel Railway:
1. Vá em **Deployments**
2. Clique no último deploy
3. Veja os logs

**Logs esperados:**
```
Installing dependencies...
composer install...
Starting application...
Listening on port 3000
```

**Se aparecer erro:**
- Verifique se `Root Directory` está como `api-php-cte`
- Verifique se `composer.json` existe

### 2. Testar URL

Cole no navegador:
```
https://sua-url.railway.app/health
```

**Deve retornar:**
```json
{"status":"ok","timestamp":"..."}
```

Se retornar isso, API está funcionando! ✅

---

## 🔧 Verificar Configuração do Worker

### 1. Verificar Secret

```bash
npx wrangler secret list
```

**Deve aparecer:**
```
CTE_API_URL = https://sua-url.railway.app
```

### 2. Testar Worker

No código do Worker (`workers/api.ts`), quando você chama `/api/cte/emitir`, ele deve:
1. Buscar certificado do banco
2. Buscar dados da empresa (CNPJ, nome, UF)
3. Enviar para `${CTE_API_URL}/emitir`

---

## 🐛 Troubleshooting

### Erro: "CTE_API_URL não configurada"

**Solução:**
```bash
npx wrangler secret put CTE_API_URL
# Cole a URL do Railway
```

### Erro: "Certificado digital não configurado"

**Solução:**
1. Vá em Configurações da Empresa no sistema
2. Faça upload do certificado `.pfx`
3. Digite a senha

### Erro: "Dados da empresa incompletos"

**Solução:**
1. Vá em Configurações da Empresa
2. Preencha CNPJ, Nome e UF
3. Salve

### Erro: "Erro ao comunicar com API CTe"

**Solução:**
1. Teste a URL diretamente: `https://sua-url.railway.app/health`
2. Se não funcionar, verifique logs no Railway
3. Se funcionar, verifique se `CTE_API_URL` está correta no Worker

---

## ✅ Teste Completo

### 1. Testar API diretamente

```bash
curl https://sua-url.railway.app/health
```

**Deve retornar:** `{"status":"ok",...}`

### 2. Testar via Worker

No sistema, vá em CT-es e tente emitir um CT-e.

**Se funcionar:** ✅ Tudo configurado!

**Se der erro:** Veja a mensagem de erro e siga o troubleshooting acima.

---

## 📝 Resumo

- ✅ API PHP no Railway → Teste `/health`
- ✅ Worker configurado → Verifique `CTE_API_URL`
- ✅ Banco atualizado → Rode migração `d1-migration-tenant-uf.sql`
- ✅ Dados cadastrados → CNPJ, Nome, UF nas Configurações
- ✅ Certificado uploadado → Nas Configurações

**Tudo isso funcionando = Sistema pronto para emitir CT-e!** 🎉
