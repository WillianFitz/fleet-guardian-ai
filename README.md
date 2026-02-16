# Fleet Guardian AI

Sistema completo de **gestão de frotas** com:

- Veículos, motoristas e pneus
- Manutenção, abastecimento, licenças, seguros e despesas
- Ocorrências, garagem, KPIs e insights
- Multiempresa (dados isolados por `tenant_id`) com login e cadastro

## Tecnologias

- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- React Query
- Cloudflare Workers + D1

## Como rodar localmente

```sh
npm install

# Frontend
npm run dev

# Backend (Cloudflare Worker)
npx wrangler dev
```

Certifique-se de ter o banco D1 criado e migrado com `d1-schema.sql`.

## CT-e e Receitas/Fretes

O sistema inclui módulo completo de **CT-e** (Conhecimento de Transporte Eletrônico) e **Receitas/Fretes**:

- **Página CT-e** (`/ctes`): cadastro de CTes (rascunho), filtros por veículo e período, e botões para emitir/consultar na SEFAZ via backend PHP.
- **Página Receitas/Fretes** (`/receitas`): controle de receitas de frete. Botão **"Importar do CTe"** preenche a receita com dados do CTe autorizado e vincula automaticamente.

### Emissão e consulta na SEFAZ

A emissão e a consulta de CT-e na SEFAZ são feitas via **proxy no Worker** que se comunica com o backend PHP [nfephp-org/sped-cte](https://github.com/nfephp-org/sped-cte).

**Configuração:**

1. Suba uma **API PHP** usando `sped-cte` com endpoints:
   - `POST /emitir` - recebe dados do CTe e retorna `{ chave, protocolo, xml? }`
   - `GET /consultar?chave=...` - consulta CTe na SEFAZ e retorna `{ status, protocolo, xml? }`

2. Configure no **Cloudflare Worker** a variável de ambiente:
   ```sh
   npx wrangler secret put CTE_API_URL
   # Digite a URL base da sua API PHP (ex: https://sua-api-cte.com)
   ```

3. O Worker expõe os endpoints:
   - `POST /api/cte/emitir` - proxy para a API PHP
   - `GET /api/cte/consultar?chave=...` - proxy para a API PHP

O frontend chama esses endpoints via Worker automaticamente. Se `CTE_API_URL` não estiver configurada, os endpoints retornam erro 503.

### Ambiente CT-e (Produção/Homologação)

O sistema permite escolher entre **Homologação** (para testes) e **Produção** (emissões reais) nas **Configurações da Empresa**.

- **Homologação**: Ambiente de testes da Receita Federal. CTes emitidos aqui são apenas para validação.
- **Produção**: Ambiente real. CTes emitidos têm efeito fiscal e são válidos oficialmente.

⚠️ **Atenção**: Ao mudar para Produção, certifique-se de que todos os dados estão corretos antes de emitir CTes.

O ambiente escolhido é passado automaticamente para a API PHP SPED-CTe via parâmetro `ambiente` nas requisições.

### Migração do banco

Se o banco D1 já existia antes da inclusão dos módulos, execute as migrações:

```sh
# Campo ambiente_cte na tabela tenants
npx wrangler d1 execute <NOME_DO_BANCO> --remote --file=./d1-migration-ambiente-cte.sql

# Tabela CTes
npx wrangler d1 execute <NOME_DO_BANCO> --remote --file=./d1-migration-ctes.sql

# Tabela Receitas
npx wrangler d1 execute <NOME_DO_BANCO> --remote --file=./d1-migration-receitas.sql
```

## Produção

- Frontend: faça build com `npm run build` e sirva em qualquer host estático.
- Backend: publique o Worker com `npx wrangler deploy`.
