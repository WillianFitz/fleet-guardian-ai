# Relatório de Análise — Fleet Guardian AI

Resumo executivo
- Escopo: inspeção read-only de todo o repositório.
- Principais achados: app frontend (Vite + React + TypeScript), Workers (Cloudflare), API PHP (sped-cte), dois Dockerfiles, testes mínimos (Vitest), ausência de CI, uso de secrets via env e fallback inseguro.

Inventário rápido
- Manifestos: `package.json` (frontend), `api-php-cte/composer.json` (API PHP).
- Infra: `api-php-cte/Dockerfile`, `api-node-mde/Dockerfile`.
- Tests: `src/test/*` (Vitest).
- Código principal: `src/`, `workers/`, `api-php-cte/`, `api-node-mde/`.

Dependências (principais)
- Frontend (package.json): React 18, Vite, TypeScript, Tailwind, React Query, Zod, Radix UI.

Evidências (trechos relevantes)

```61:64:workers/api.ts
function getAuthSecret(env: Env): string {
  // Fallback de desenvolvimento
  return env.AUTH_SECRET || "dev-secret-change-in-production";
}
```

```15:18:package.json
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
```

Achados de segurança (prioridade)
- Crítico: fallback de segredo em `workers/api.ts` (string `"dev-secret-change-in-production"`) permite bypass em ambiente de dev/produção se env não estiver configurado corretamente. Remediar imediatamente.
- Alto: tokens são armazenados em localStorage (`src/lib/api.ts`, `src/hooks/useAuth.tsx`) — considerar HttpOnly cookies ou mitigação XSS.
- Médio: variáveis sensíveis (CERT_PASSWORD, CTE_CERT_PFX, etc.) trafegam entre Worker → API PHP; certifique-se de usar secrets gerenciados (Wrangler secrets / Railway env) e nunca commitar valores.
- Baixo: ausência de CI/workflows públicos (.github/workflows) — pode faltar checks automatizados.

Qualidade e estilo
- ESLint configurado (`eslint.config.js`) e script `npm run lint` presente.
- TypeScript e Vitest configurados; cobertura de testes inexistente/baixa (exemplo: `src/test/example.test.ts` apenas valida true).

Infra / Deploy
- Existem Dockerfiles para os serviços PHP e Node. `api-node-mde/Dockerfile` copia `package-lock.json*` mas o repositório não contém `package-lock.json` — verificar build em CI.
- Não foram encontrados workflows CI no repositório.

Documentação
- `README.md` na raiz com instruções de execução e migrações D1 — bom início.
- Recomendo adicionar `CONTRIBUTING.md`, `SECURITY.md` e um `CHANGELOG.md`.

Recomendações priorizadas (ação imediata)
1) (Crítico) Remover fallback secreto e falhar if AUTH_SECRET não estiver definido em produção. Verifique `workers/api.ts` e `getAuthSecret`.
2) (Alto) Mover tokens de autenticação de localStorage para cookies HttpOnly ou aplicar mitigação XSS/CSRF e rotacionamento de tokens.
3) (Alto) Executar `npm audit` e `npm outdated`; para PHP, revisar dependências `nfephp-org/*` e atualizar conforme necessário.
4) (Médio) Adicionar CI básico (GitHub Actions) para lint, testes e build (frontend + containers).
5) (Médio) Criar processos para gerenciar secrets (Wrangler secrets, Railway/Cloud provider env, or HashiCorp Vault).
6) (Baixo) Expandir testes unitários e integrar coverage (Vitest config → coverage).
7) (Baixo) Adicionar CONTRIBUTING.md e SECURITY.md com instruções de divulgação de vulnerabilidades.

Comandos reproduzíveis recomendados
- Instalar e testar (frontend):
  - npm install
  - npm run lint
  - npm test
  - npm run build
- Segurança:
  - npm audit --audit-level=high
  - npm outdated
  - Para PHP: revisar composer.lock e atualizações (`composer outdated`)

Próximos passos que posso executar (escolha um)
- Gerar PRs com patches automáticos (ex: remover fallback secreto, adicionar CI) — preciso de permissão para commitar.
- Rodar scans automatizados (sem autenticação) e gerar relatório de CVEs — requer autorização para executar comandos externos.
- Implementar recomendações prioritárias (commits/PRs) — confirmar antes de aplicar.

Relatórios adicionais e evidências completas estão disponíveis sob demanda (posso incluir mais trechos de código referenciados).

