Migration helpers — adiciona coluna updated_at quando ausente
===========================================================

Descrição
---------
Arquivos nesta pasta adicionam a coluna `updated_at` em tabelas comuns quando a coluna estiver ausente.

Como funcionam
--------------
Cada arquivo contém:
- um comentário com instrução de checagem (PRAGMA)
- um `ALTER TABLE <table> ADD COLUMN updated_at TEXT;`
- um `UPDATE <table> SET updated_at = datetime('now') WHERE updated_at IS NULL;`

ATENÇÃO
--------
- O comando `ALTER TABLE ADD COLUMN` falhará se a coluna já existir. Por isso **verifique** antes de executar.
- Para checar se a coluna existe (substitua <table>):
  - Crie um arquivo `check.sql` com:
    SELECT name FROM pragma_table_info('<table>') WHERE name='updated_at';
  - Execute via Wrangler D1. Se retornar linhas, a coluna existe; não execute a migration para essa tabela.

Exemplo de execução (remoto)
----------------------------
npx wrangler d1 execute <DB_NAME> --remote --file=./d1-migrations/015_add_updated_at_vehicles.sql

Sequência recomendada
---------------------
1. Verifique tabela por tabela conforme indicado acima.
2. Execute apenas as migrations necessárias.
3. Após todas, verifique se as aplicações atualizam `updated_at` corretamente.

Se quiser, posso automatizar a checagem e executar somente as migrations faltantes via script Node/Worker (mais seguro). Pergunte se deseja isso.

