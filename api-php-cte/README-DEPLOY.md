# Guia Completo de Deploy - API CT-e com sped-cte

## ✅ O que foi implementado

- ✅ Classe `CTeService` que usa `nfephp-org/sped-cte` para emissão e consulta real
- ✅ Endpoints `/emitir` e `/consultar` funcionando com SEFAZ
- ✅ Validação de certificado digital
- ✅ Suporte a ambiente homologação e produção

## 📋 Pré-requisitos

1. **Certificado Digital A1 (.pfx)** válido
2. **CNPJ** da empresa cadastrado no sistema
3. **Conta Railway** (grátis) ou outro serviço PHP

## 🚀 Deploy no Railway (Passo a Passo)

### 1. Preparar o código

Certifique-se de que o código está no GitHub:

```bash
cd api-php-cte
git add .
git commit -m "Implementação completa sped-cte"
git push
```

### 2. Criar projeto no Railway

1. Acesse [https://railway.app](https://railway.app)
2. Faça login com GitHub
3. Clique em **"New Project"** → **"Deploy from GitHub repo"**
4. Selecione seu repositório `fleet-guardian-ai`
5. Nas configurações:
   - **Root Directory**: `api-php-cte`
   - Railway detecta automaticamente PHP e roda `composer install`

### 3. Configurar Variáveis de Ambiente

No painel do Railway, vá em **Variables** e adicione:

```
CTE_CNPJ=12345678000190
CTE_RAZAO_SOCIAL=SUA EMPRESA LTDA
CTE_UF=SP
```

**Opcional** (se não enviar certificado pelo Worker):
```
CERT_PFX_BASE64=<seu_certificado_em_base64>
CERT_PASSWORD=<senha_do_certificado>
```

### 4. Obter URL da API

Railway fornece uma URL tipo:
```
https://seu-projeto.up.railway.app
```

**Guarde essa URL!**

### 5. Configurar Worker (Cloudflare)

No terminal, configure o secret:

```bash
npx wrangler secret put CTE_API_URL
# Quando pedir, cole a URL do Railway:
# https://seu-projeto.up.railway.app
```

Depois faça deploy:

```bash
npx wrangler deploy
```

## 🔧 Configuração no Sistema

### 1. Cadastrar Empresa

No sistema Fleet Guardian, vá em **Configurações da Empresa** e preencha:
- **CNPJ**: Seu CNPJ (ex: 12.345.678/0001-90)
- **Nome**: Razão Social da empresa
- **UF**: Estado (SP, RJ, MG, etc.)

### 2. Upload do Certificado Digital

Na mesma tela de **Configurações**:
1. Faça upload do arquivo `.pfx` do certificado
2. Digite a senha do certificado
3. O sistema valida automaticamente

### 3. Escolher Ambiente

- **Homologação**: Para testes (recomendado começar aqui)
- **Produção**: Para emissões reais (só depois de testar!)

## 🧪 Testar Emissão

1. Vá em **CT-es** → **Novo CTe**
2. Preencha os dados:
   - Número, série, placa do veículo
   - Remetente e destinatário
   - Valor da prestação
3. Clique em **Emitir**
4. Aguarde alguns segundos
5. Se tudo estiver OK, o CT-e será autorizado na SEFAZ!

## ⚠️ Problemas Comuns

### Erro: "Certificado digital não configurado"
- **Solução**: Faça upload do certificado nas Configurações da Empresa

### Erro: "CNPJ da empresa não informado"
- **Solução**: Certifique-se de que o CNPJ está cadastrado na tabela `tenants`

### Erro: "CT-e rejeitado"
- **Causa**: Dados incorretos ou incompletos
- **Solução**: Verifique se todos os campos obrigatórios estão preenchidos

### Erro: "Erro ao comunicar com API CTe"
- **Causa**: URL da API incorreta ou API offline
- **Solução**: Verifique se `CTE_API_URL` está configurada corretamente no Worker

## 📝 Notas Importantes

1. **Código de Município**: A função `getCodigoMunicipio()` está simplificada. Para produção, você deve usar uma tabela completa de códigos IBGE.

2. **Endereço do Emitente**: Atualmente está hardcoded como "RUA EXEMPLO". Você deve atualizar na classe `CTeService.php` com os dados reais da empresa.

3. **UF do Tenant**: O código atual assume UF = 'SP'. Se sua empresa for de outro estado, atualize o campo `siglaUF` no código do Worker ou adicione campo `uf` na tabela `tenants`.

## 🔒 Segurança

- ✅ Certificado nunca é commitado no Git
- ✅ Certificado é enviado via HTTPS
- ✅ Certificado é armazenado temporariamente apenas durante processamento
- ✅ Senha do certificado nunca é logada

## 📚 Próximos Passos

1. Expandir tabela de códigos IBGE de municípios
2. Adicionar campo `uf` na tabela `tenants`
3. Implementar geração de PDF do CT-e
4. Adicionar mais validações de dados

## 🆘 Suporte

Se tiver problemas:
1. Verifique os logs no Railway
2. Verifique os logs do Worker (Cloudflare Dashboard)
3. Teste a API diretamente: `POST https://sua-api.railway.app/health`
