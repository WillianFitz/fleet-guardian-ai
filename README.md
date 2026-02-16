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

## Produção

- Frontend: faça build com `npm run build` e sirva em qualquer host estático.
- Backend: publique o Worker com `npx wrangler deploy`.
