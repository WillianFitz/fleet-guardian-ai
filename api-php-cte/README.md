# API PHP CT-e - Fleet Guardian AI

API PHP para emissão e consulta de CT-e usando nfephp-org/sped-cte.

## Instalação

```bash
cd api-php-cte
composer install
```

## Configuração

1. **Certificado Digital**: Coloque seu certificado A1 (.pfx) na pasta `certs/`
2. **Configuração**: Edite `config/config.json` com seus dados:
   - CNPJ da empresa
   - UF
   - Ambiente (homologação/produção)
   - Caminho do certificado

## Endpoints

### POST /emitir?ambiente=homologacao|producao
Emite um CTe na SEFAZ.

**Body:**
```json
{
  "numero": "000000001",
  "serie": "1",
  "veiculoPlaca": "ABC-1234",
  "dataEmissao": "2026-02-16",
  "valorPrestacao": 1000.00,
  "remetente": {
    "nome": "Empresa Remetente",
    "cnpjCpf": "12.345.678/0001-90",
    "municipio": "São Paulo",
    "uf": "SP"
  },
  "destinatario": {
    "nome": "Empresa Destinatária",
    "cnpjCpf": "98.765.432/0001-10",
    "municipio": "Rio de Janeiro",
    "uf": "RJ"
  }
}
```

**Response:**
```json
{
  "chave": "352...",
  "protocolo": "123456789012345",
  "xml": "..."
}
```

### GET /consultar?chave=...&ambiente=homologacao|producao
Consulta status de um CTe na SEFAZ.

**Response:**
```json
{
  "status": "100",
  "protocolo": "123456789012345",
  "xml": "..."
}
```

## Certificado e OpenSSL 3

Se aparecer **"error:0308010C:digital envelope routines::unsupported"** ao ler o certificado .pfx, o servidor está com OpenSSL 3.x e o certificado usa algoritmos antigos. No **Docker** isso já está tratado: o `Dockerfile` define `OPENSSL_CONF=/app/openssl-legacy.cnf`, que ativa o provider legacy. Se rodar PHP **fora do Docker** (por exemplo localmente), defina no ambiente:

```bash
export OPENSSL_CONF=/caminho/para/api-php-cte/openssl-legacy.cnf
php -S localhost:8000 -t .
```

## Rodar localmente

```bash
php -S localhost:8000 -t .
```

## Deploy

Pode usar qualquer servidor PHP (Apache, Nginx, etc) ou plataformas como:
- Heroku
- Railway
- Render
- VPS com PHP

## Próximos passos

1. Implementar a emissão real usando nfephp-org/sped-cte
2. Implementar a consulta real
3. Adicionar autenticação (opcional)
4. Configurar certificado digital
