# 🔐 Fluxo Completo - Onde Fica o Certificado e Como Funciona

## 📍 ONDE FICA O CERTIFICADO?

### ✅ Resposta Curta: **No Banco de Dados D1 (Cloudflare)**

O certificado digital fica armazenado na tabela `tenants` do banco D1, no campo `certificado_pfx_base64`.

```
Banco D1 (Cloudflare)
└── Tabela: tenants
    └── Campo: certificado_pfx_base64 (TEXT)
    └── Campo: certificado_password (TEXT)
    └── Campo: certificado_status (TEXT)
```

**Como funciona:**
1. Você faz upload do certificado `.pfx` no sistema (frontend)
2. Sistema converte para Base64 (texto)
3. Sistema salva no banco D1 (Cloudflare)
4. Certificado fica seguro no banco, nunca é exposto publicamente

---

## 🔄 FLUXO COMPLETO DE EMISSÃO DE CT-e

### Passo a Passo Visual:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (Sistema Fleet Guardian)                            │
│    Você preenche os dados do CT-e e clica em "Emitir"          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST /api/cte/emitir
                        │ { numero, serie, remetente, destinatario, ... }
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. WORKER (Cloudflare Workers)                                  │
│    workers/api.ts                                                │
│                                                                  │
│    a) Recebe requisição do frontend                             │
│    b) Busca no banco D1:                                        │
│       - Certificado (certificado_pfx_base64)                   │
│       - Senha (certificado_password)                            │
│       - CNPJ da empresa (cnpj)                                  │
│       - Nome da empresa (nome)                                  │
│       - UF (uf)                                                  │
│    c) Monta requisição completa:                                │
│       {                                                          │
│         certificado: { pfxBase64: "...", password: "..." },    │
│         empresa: { cnpj: "...", razaoSocial: "...", siglaUF: "..." },
│         numero: "...",                                           │
│         remetente: {...},                                        │
│         destinatario: {...}                                      │
│       }                                                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST https://sua-api.railway.app/emitir
                        │ (com certificado + dados)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. API PHP (Railway)                                            │
│    api-php-cte/index.php                                        │
│                                                                  │
│    a) Recebe requisição do Worker                               │
│    b) Decodifica certificado (base64 → arquivo .pfx)           │
│    c) Salva temporariamente em /tmp/cert_xxx.pfx               │
│    d) Cria CTeService com certificado                           │
│    e) Monta XML do CT-e usando sped-cte                        │
│    f) Assina XML com certificado                                │
│    g) Envia para SEFAZ via HTTPS                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ HTTPS POST (SOAP)
                        │ XML assinado
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SEFAZ (Receita Federal)                                      │
│    Servidor oficial da Receita Federal                          │
│                                                                  │
│    a) Recebe XML assinado                                       │
│    b) Valida assinatura digital                                 │
│    c) Valida dados do CT-e                                      │
│    d) Autoriza ou rejeita                                       │
│    e) Retorna protocolo de autorização                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ { chave, protocolo, xml }
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. RESPOSTA (volta pelo mesmo caminho)                          │
│                                                                  │
│    SEFAZ → API PHP → Worker → Frontend                          │
│                                                                  │
│    Frontend atualiza CT-e como "autorizado" ✅                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 SEGURANÇA DO CERTIFICADO

### ✅ Onde o Certificado Fica:

1. **Upload (Frontend)**
   - Você faz upload do arquivo `.pfx`
   - Sistema converte para Base64 (texto seguro)
   - Envia para Worker via HTTPS

2. **Armazenamento (Banco D1)**
   - Fica armazenado como texto Base64 no banco
   - Campo: `certificado_pfx_base64`
   - Senha fica em campo separado: `certificado_password`
   - **Nunca é exposto publicamente**

3. **Uso (API PHP)**
   - Worker busca do banco quando precisa emitir
   - Envia para API PHP via HTTPS
   - API PHP decodifica e usa temporariamente
   - Arquivo temporário é deletado após uso

### ✅ Segurança Garantida:

- ✅ Certificado nunca fica em arquivo público
- ✅ Certificado nunca é commitado no Git
- ✅ Certificado só é usado durante emissão
- ✅ Comunicação sempre via HTTPS
- ✅ Arquivo temporário sempre deletado

---

## 📋 DETALHAMENTO DE CADA ETAPA

### Etapa 1: Frontend (Você)

**O que você faz:**
- Preenche formulário de CT-e
- Clica em "Emitir"

**O que acontece:**
```javascript
// src/pages/Ctes.tsx
const handleEmitir = async (cte) => {
  const result = await cteApi.emitir(payload, ambienteAtual);
  // Envia para Worker
}
```

---

### Etapa 2: Worker (Cloudflare)

**O que o Worker faz:**

```typescript
// workers/api.ts

// 1. Recebe requisição do frontend
const body = await request.json();

// 2. Busca certificado e dados do banco D1
const tenant = await env.DB.prepare(`
  SELECT 
    certificado_pfx_base64,  // Certificado em Base64
    certificado_password,     // Senha
    cnpj,                    // CNPJ da empresa
    nome,                     // Razão Social
    uf                        // UF
  FROM tenants 
  WHERE id = ?
`).bind(tenantId).first();

// 3. Monta requisição completa
const phpBody = {
  ...body,  // Dados do CT-e
  certificado: {
    pfxBase64: tenant.certificado_pfx_base64,
    password: tenant.certificado_password
  },
  empresa: {
    cnpj: tenant.cnpj,
    razaoSocial: tenant.nome,
    siglaUF: tenant.uf
  }
};

// 4. Envia para API PHP
const response = await fetch(`${CTE_API_URL}/emitir`, {
  method: 'POST',
  body: JSON.stringify(phpBody)
});
```

**Onde o certificado está agora:** 
- ✅ No banco D1 (armazenado)
- ✅ Enviado para API PHP via HTTPS (em trânsito)

---

### Etapa 3: API PHP (Railway)

**O que a API PHP faz:**

```php
// api-php-cte/index.php

// 1. Recebe requisição do Worker
$body = json_decode($request->getBody()->getContents(), true);

// 2. Extrai certificado
$certPfxBase64 = $body['certificado']['pfxBase64'];
$certPassword = $body['certificado']['password'];

// 3. Decodifica certificado (Base64 → arquivo .pfx)
$certPfx = base64_decode($certPfxBase64);

// 4. Salva temporariamente
$tempCertPath = sys_get_temp_dir() . '/cert_' . uniqid() . '.pfx';
file_put_contents($tempCertPath, $certPfx);

// 5. Cria serviço CTe com certificado
$cteService = new CTeService(
    $tempCertPath,           // Arquivo temporário
    $certPassword,           // Senha
    $body['empresa'],        // Dados da empresa
    $ambiente                // Homologação ou Produção
);

// 6. Emite CT-e (monta XML, assina, envia para SEFAZ)
$resultado = $cteService->emitir($body);

// 7. Deleta arquivo temporário
@unlink($tempCertPath);

// 8. Retorna resultado para Worker
return $response->withJson($resultado);
```

**Onde o certificado está agora:**
- ✅ Arquivo temporário em `/tmp/cert_xxx.pfx` (durante processamento)
- ✅ Usado para assinar XML
- ✅ **DELETADO após uso** ✅

---

### Etapa 4: SEFAZ (Receita Federal)

**O que a SEFAZ faz:**

```php
// api-php-cte/src/CTeService.php

// 1. Monta XML do CT-e
$make = new Make();
$make->tagide(...);
$make->tagemit(...);
// ... monta todo XML
$xml = $make->getXML();

// 2. Assina XML com certificado
$tools = new Tools($config, $certificate);
// (assinatura acontece automaticamente)

// 3. Envia para SEFAZ
$response = $tools->sefazEnvia($xml, $tpAmb);

// 4. SEFAZ valida e autoriza
// Retorna: { chave, protocolo, xml }
```

**Onde o certificado está agora:**
- ✅ Usado para assinar XML (dentro da biblioteca sped-cte)
- ✅ XML assinado enviado para SEFAZ
- ✅ SEFAZ valida assinatura e autoriza CT-e

---

## 🔍 RESUMO VISUAL DO FLUXO

```
┌─────────────┐
│   VOCÊ       │
│  (Frontend)  │
└──────┬───────┘
       │ 1. Preenche CT-e
       │ 2. Clica "Emitir"
       ▼
┌─────────────────────────────────┐
│   WORKER                         │
│   (Cloudflare Workers)           │
│                                  │
│   • Busca certificado do banco  │
│   • Busca dados da empresa       │
│   • Envia tudo para API PHP      │
└──────┬───────────────────────────┘
       │ HTTPS
       ▼
┌─────────────────────────────────┐
│   API PHP                       │
│   (Railway)                     │
│                                  │
│   • Recebe certificado           │
│   • Monta XML do CT-e            │
│   • Assina com certificado       │
│   • Envia para SEFAZ             │
└──────┬───────────────────────────┘
       │ HTTPS (SOAP)
       ▼
┌─────────────────────────────────┐
│   SEFAZ                         │
│   (Receita Federal)             │
│                                  │
│   • Valida assinatura            │
│   • Valida dados                 │
│   • Autoriza CT-e                │
└──────┬───────────────────────────┘
       │ Resposta
       ▼
┌─────────────────────────────────┐
│   RESPOSTA                       │
│                                  │
│   SEFAZ → API PHP → Worker      │
│   → Frontend                     │
│                                  │
│   CT-e marcado como "autorizado" │
└─────────────────────────────────┘
```

---

## ✅ ONDE CADA COISA FICA

| Item | Onde Fica | Como Acessa |
|------|-----------|-------------|
| **Certificado** | Banco D1 (Cloudflare) | Worker busca quando precisa |
| **Senha do Certificado** | Banco D1 (Cloudflare) | Worker busca quando precisa |
| **Dados da Empresa** | Banco D1 (Cloudflare) | Worker busca quando precisa |
| **API PHP** | Railway (servidor) | Worker chama via HTTPS |
| **Worker** | Cloudflare Workers | Frontend chama via HTTPS |
| **Frontend** | Onde você hospedar | Você acessa no navegador |

---

## 🔒 SEGURANÇA - RESUMO

### ✅ Certificado está seguro porque:

1. **Armazenamento**: Fica no banco D1 (Cloudflare), não em arquivo público
2. **Transmissão**: Sempre via HTTPS (criptografado)
3. **Uso**: Só é usado durante emissão, depois é deletado
4. **Acesso**: Só o Worker tem acesso ao banco, ninguém mais

### ✅ Dados estão seguros porque:

1. **Banco D1**: Banco privado do Cloudflare, não público
2. **Worker**: Roda em ambiente isolado do Cloudflare
3. **API PHP**: Comunica via HTTPS
4. **SEFAZ**: Servidor oficial do governo

---

## 🎯 RESUMO FINAL

**Certificado:**
- ✅ Fica no **banco D1** (Cloudflare)
- ✅ Você faz upload **uma vez** no sistema
- ✅ Sistema busca **automaticamente** quando precisa
- ✅ Nunca fica exposto publicamente

**Fluxo:**
- ✅ Você preenche CT-e no sistema
- ✅ Sistema busca certificado do banco
- ✅ Envia para API PHP
- ✅ API PHP assina e envia para SEFAZ
- ✅ SEFAZ autoriza
- ✅ CT-e fica autorizado no sistema

**Tudo automático!** Você só precisa:
1. Fazer upload do certificado (uma vez)
2. Preencher dados do CT-e
3. Clicar em "Emitir"

**Pronto!** 🎉
