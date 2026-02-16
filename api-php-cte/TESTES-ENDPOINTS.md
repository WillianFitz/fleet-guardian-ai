# 🧪 Como Testar os Endpoints da API CT-e

Base URL: `http://192.168.99.97:8114` (ou use sua URL)

---

## 1. Health (já funcionando ✅)

```bash
curl http://192.168.99.97:8114/health
```

**Resposta esperada:**
```json
{"status":"ok","timestamp":"2026-02-16T17:19:21-03:00"}
```

---

## 2. Validar Certificado – POST /validar-certificado

Envia o certificado em Base64 e a senha. O servidor valida e retorna se está válido e a data de validade.

**Sem certificado (teste de erro):**
```bash
curl -X POST http://192.168.99.97:8114/validar-certificado \
  -H "Content-Type: application/json" \
  -d '{"certificadoPfxBase64":"","certificadoPassword":""}'
```
**Resposta esperada:** `400` + mensagem de erro.

**Com certificado real:**

Primeiro gere o Base64 do seu `.pfx` (no Linux):
```bash
base64 -w 0 seu-certificado.pfx > cert_base64.txt
```

Depois chame a API (substitua `SEU_BASE64` e `SUA_SENHA`):
```bash
curl -X POST http://192.168.99.97:8114/validar-certificado \
  -H "Content-Type: application/json" \
  -d '{
    "certificadoPfxBase64": "SEU_BASE64_AQUI",
    "certificadoPassword": "SUA_SENHA"
  }'
```

**Resposta esperada (certificado válido):**
```json
{
  "valido": true,
  "expirado": false,
  "validoAte": "2027-01-15",
  "cnpj": "12345678000190",
  "mensagem": "Certificado válido"
}
```

---

## 3. Emitir CT-e – POST /emitir

**Sem certificado (teste de erro):**
```bash
curl -X POST "http://192.168.99.97:8114/emitir?ambiente=homologacao" \
  -H "Content-Type: application/json" \
  -d '{
    "numero": "1",
    "serie": "1",
    "veiculoPlaca": "ABC1234",
    "dataEmissao": "2026-02-16",
    "valorPrestacao": 1000,
    "remetente": {
      "nome": "Remetente LTDA",
      "cnpjCpf": "12345678000190",
      "municipio": "São Paulo",
      "uf": "SP"
    },
    "destinatario": {
      "nome": "Destinatário LTDA",
      "cnpjCpf": "98765432000110",
      "municipio": "Rio de Janeiro",
      "uf": "RJ"
    }
  }'
```
**Resposta esperada:** `400` – "Certificado digital não configurado".

**Com certificado e dados da empresa (emissão real):**

Você precisa enviar no body:
- `certificado.pfxBase64` e `certificado.password`
- `empresa.cnpj`, `empresa.razaoSocial`, `empresa.siglaUF`
- + todos os dados do CT-e (numero, serie, remetente, destinatario, etc.)

Exemplo completo (substitua BASE64_CERT, SENHA_CERT, CNPJ, RAZAO, UF):
```bash
curl -X POST "http://192.168.99.97:8114/emitir?ambiente=homologacao" \
  -H "Content-Type: application/json" \
  -d '{
    "certificado": {
      "pfxBase64": "BASE64_DO_SEU_CERTIFICADO",
      "password": "SENHA_DO_CERTIFICADO"
    },
    "empresa": {
      "cnpj": "12.345.678/0001-90",
      "razaoSocial": "SUA EMPRESA LTDA",
      "siglaUF": "SP"
    },
    "numero": "1",
    "serie": "1",
    "veiculoPlaca": "ABC1234",
    "dataEmissao": "2026-02-16",
    "valorPrestacao": 1000,
    "remetente": {
      "nome": "Remetente LTDA",
      "cnpjCpf": "12345678000190",
      "municipio": "São Paulo",
      "uf": "SP"
    },
    "destinatario": {
      "nome": "Destinatário LTDA",
      "cnpjCpf": "98765432000110",
      "municipio": "Rio de Janeiro",
      "uf": "RJ"
    }
  }'
```

Em homologação, se tudo estiver certo, a SEFAZ pode autorizar e você recebe `chave`, `protocolo`, `xml`.

---

## 4. Consultar CT-e – GET e POST /consultar

**GET (sem certificado – usado pelo Worker com certificado no body):**
```bash
curl "http://192.168.99.97:8114/consultar?chave=35260212345678000190570010000000011234567890&ambiente=homologacao"
```
Se a API esperar certificado no body, vai retornar erro 400. O Worker usa **POST** /consultar enviando certificado + empresa no body.

**POST (com certificado e empresa):**
```bash
curl -X POST "http://192.168.99.97:8114/consultar?chave=CHAVE_44_DIGITOS&ambiente=homologacao" \
  -H "Content-Type: application/json" \
  -d '{
    "certificado": {
      "pfxBase64": "BASE64_DO_CERTIFICADO",
      "password": "SENHA"
    },
    "empresa": {
      "cnpj": "12.345.678/0001-90",
      "razaoSocial": "SUA EMPRESA LTDA",
      "siglaUF": "SP"
    }
  }'
```

Substitua `CHAVE_44_DIGITOS` pela chave do CT-e (44 dígitos) que você obteve na emissão.

---

## Resumo rápido

| Endpoint | Método | O que testar |
|----------|--------|----------------|
| `/health` | GET | ✅ Já testado |
| `/validar-certificado` | POST | Body: certificadoPfxBase64, certificadoPassword |
| `/emitir?ambiente=homologacao` | POST | Body: certificado + empresa + dados do CT-e |
| `/consultar?chave=...&ambiente=homologacao` | GET ou POST | GET só chave; POST com certificado + empresa no body |

---

## Testar direto pelo sistema (recomendado)

Depois que a API estiver no ar e o Worker estiver com `CTE_API_URL` apontando para ela:

1. No sistema: **Configurações** → preencher CNPJ, Nome, UF e fazer upload do certificado.
2. **CT-es** → **Novo CTe** → preencher e clicar em **Emitir**.

O front chama o Worker, que envia certificado + empresa + dados para a API. Assim você testa o fluxo completo.
