# 📊 Diagrama do Fluxo - Emissão de CT-e

## 🔄 Fluxo Completo Simplificado

```
┌─────────────────────────────────────────────────────────────┐
│                    VOCÊ (Usuário)                            │
│                                                               │
│  1. Abre sistema Fleet Guardian                              │
│  2. Vai em "CT-es" → "Novo CTe"                             │
│  3. Preenche:                                                 │
│     - Número, série                                          │
│     - Remetente, destinatário                                │
│     - Valor, placa do veículo                                │
│  4. Clica em "Emitir"                                        │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ HTTP POST
                        │ /api/cte/emitir
                        │ { dados do CT-e }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              WORKER (Cloudflare Workers)                     │
│              workers/api.ts                                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Recebe requisição do frontend                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. Busca no Banco D1 (Cloudflare):                  │   │
│  │                                                     │   │
│  │    SELECT certificado_pfx_base64,                  │   │
│  │           certificado_password,                    │   │
│  │           cnpj, nome, uf                           │   │
│  │    FROM tenants                                     │   │
│  │    WHERE id = ?                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. Monta requisição completa:                       │   │
│  │                                                     │   │
│  │    {                                                │   │
│  │      certificado: {                                │   │
│  │        pfxBase64: "MIIJ...",                       │   │
│  │        password: "senha123"                        │   │
│  │      },                                             │   │
│  │      empresa: {                                     │   │
│  │        cnpj: "12345678000190",                     │   │
│  │        razaoSocial: "Minha Empresa LTDA",          │   │
│  │        siglaUF: "SP"                                │   │
│  │      },                                             │   │
│  │      numero: "000000001",                          │   │
│  │      remetente: {...},                              │   │
│  │      destinatario: {...}                            │   │
│  │    }                                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 4. Envia para API PHP (Railway)                     │   │
│  │                                                     │   │
│  │    POST https://sua-api.railway.app/emitir         │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ HTTPS POST
                        │ (com certificado + dados)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              API PHP (Railway)                              │
│              api-php-cte/index.php                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Recebe requisição do Worker                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. Decodifica certificado                           │   │
│  │                                                     │   │
│  │    Base64 → Arquivo .pfx                            │   │
│  │    Salva em: /tmp/cert_123.pfx                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. Cria CTeService                                  │   │
│  │                                                     │   │
│  │    $cteService = new CTeService(                    │   │
│  │      $tempCertPath,                                 │   │
│  │      $certPassword,                                 │   │
│  │      $empresaDados,                                 │   │
│  │      $ambiente                                      │   │
│  │    );                                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 4. Monta XML do CT-e                                │   │
│  │                                                     │   │
│  │    $make = new Make();                              │   │
│  │    $make->tagide(...);                              │   │
│  │    $make->tagemit(...);                             │   │
│  │    $make->tagrem(...);                              │   │
│  │    $make->tagdest(...);                             │   │
│  │    $make->monta();                                  │   │
│  │    $xml = $make->getXML();                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 5. Assina XML com certificado                       │   │
│  │                                                     │   │
│  │    (feito automaticamente pela biblioteca)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 6. Envia para SEFAZ                                 │   │
│  │                                                     │   │
│  │    $tools->sefazEnvia($xml, $tpAmb);               │   │
│  │                                                     │   │
│  │    POST https://cte.sefaz.sp.gov.br/...            │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 7. Deleta arquivo temporário                        │   │
│  │                                                     │   │
│  │    @unlink($tempCertPath);                         │   │
│  │    ✅ Certificado não fica salvo                    │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ HTTPS (SOAP)
                        │ XML assinado
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              SEFAZ (Receita Federal)                       │
│              Servidor oficial do governo                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Recebe XML assinado                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. Valida assinatura digital                        │   │
│  │    ✅ Certificado válido?                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. Valida dados do CT-e                             │   │
│  │    ✅ CNPJ válido?                                   │   │
│  │    ✅ Dados completos?                               │   │
│  │    ✅ Valores corretos?                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 4. Autoriza CT-e                                    │   │
│  │                                                     │   │
│  │    Retorna:                                         │   │
│  │    {                                                │   │
│  │      chave: "352...",                               │   │
│  │      protocolo: "123456789012345",                 │   │
│  │      xml: "<?xml...>"                               │   │
│  │    }                                                │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ Resposta JSON
                        │ { chave, protocolo, xml }
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              RESPOSTA (volta pelo mesmo caminho)            │
│                                                               │
│  SEFAZ → API PHP → Worker → Frontend                        │
│                                                               │
│  Frontend atualiza CT-e:                                     │
│  - status: "autorizado"                                      │
│  - chave: "352..."                                           │
│  - protocolo: "123456789012345"                              │
│                                                               │
│  ✅ CT-e emitido com sucesso!                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 ONDE O CERTIFICADO FICA EM CADA ETAPA

```
┌─────────────────────────────────────────────────────────────┐
│ ETAPA 1: Upload (Você)                                      │
│                                                               │
│  Certificado: Arquivo .pfx no seu computador                │
│  ↓                                                           │
│  Sistema converte para Base64 (texto)                       │
│  ↓                                                           │
│  Envia para Worker via HTTPS                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ETAPA 2: Armazenamento (Banco D1)                           │
│                                                               │
│  Certificado: Base64 no banco D1                            │
│  Campo: certificado_pfx_base64                              │
│  Senha: certificado_password                                │
│                                                               │
│  ✅ Fica aqui permanentemente                               │
│  ✅ Só o Worker tem acesso                                  │
│  ✅ Nunca é exposto publicamente                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ETAPA 3: Uso (API PHP)                                      │
│                                                               │
│  Certificado: Arquivo temporário /tmp/cert_xxx.pfx         │
│                                                               │
│  ✅ Usado apenas durante emissão                            │
│  ✅ Deletado após uso                                        │
│  ✅ Nunca fica salvo no servidor                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ETAPA 4: Assinatura (sped-cte)                              │
│                                                               │
│  Certificado: Usado pela biblioteca para assinar XML        │
│                                                               │
│  ✅ XML assinado enviado para SEFAZ                         │
│  ✅ Certificado não é enviado, só a assinatura              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ RESUMO FINAL

**Certificado:**
- ✅ **Armazenado**: Banco D1 (Cloudflare) - permanente
- ✅ **Usado**: API PHP (Railway) - temporário
- ✅ **Segurança**: Sempre via HTTPS, nunca exposto

**Fluxo:**
- ✅ **Você**: Preenche CT-e e clica "Emitir"
- ✅ **Sistema**: Busca certificado automaticamente
- ✅ **API**: Assina e envia para SEFAZ
- ✅ **SEFAZ**: Autoriza CT-e
- ✅ **Sistema**: Atualiza como "autorizado"

**Tudo automático!** 🎉
