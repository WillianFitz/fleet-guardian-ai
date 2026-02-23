# API Node MD-e (Distribuição DFe)

Microservice pequeno que usa `node-mde` para consultar a Distribuição DFe (SEFAZ) por chave e retornar `docZip` / `nfeProc`.

Endpoints:
- GET /health
- POST /nfe/consultar

Exemplo request `/nfe/consultar`:
```json
{
  "chave": "41260200040335577920550262302200093718469630",
  "ambiente": "producao",
  "empresa": { "cnpj": "28529248000163", "siglaUF": "PR" },
  "certificado": { "pfxBase64": "<BASE64_PFX>", "password": "123456" }
}
```

Resposta:
- `200` com JSON contendo `data` e `docZip` (cada item com `xml`/`json` quando disponível).
 - Caso erro, retorna 4xx/5xx com mensagem.

Deploy:
- Build Docker e faça deploy no Railway/Heroku/Cloud Run. Use a variável de ambiente `PORT` se necessário.

