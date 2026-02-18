# Fluxos de Criação de CT-e — Mapeamento com nfephp-org/sped-cte

Este documento descreve como os 4 fluxos de criação de CT-e se mapeiam para a biblioteca [nfephp-org/sped-cte](https://github.com/nfephp-org/sped-cte).

## Suporte da biblioteca

O **sped-cte** suporta todos os fluxos necessários via:

| Fluxo | Tags MakeCTe | Observação |
|-------|--------------|------------|
| **1. NFe** | `taginfNFe()`, `taginfNF()` | Chave NFe 44 dígitos ou dados NF modelo 1/1A |
| **2. CT-e outra transportadora** | `tagdocAnt()`, `tagemiDocAnt()`, `tagidDocAntEle()`, `ide.tpServ` | tpServ: 1=Subcontratação, 2=Redespacho, 3=Redespacho Intermediário |
| **3. Nota de produtos (talão)** | `taginfNF()` | Nota fiscal de talão |
| **4. Outros documentos** | `taginfOutros()` | tpDoc: 00=Declaração, 04=CF-e/SAT, 05=NFC-e, 99=Outros |

## Detalhamento por fluxo

### Opção 1 — Tenho Nota Fiscal Eletrônica

- **Entrada**: Chave NFe (44 dígitos), XML da NFe, ou busca SEFAZ (Distribuição DFe)
- **Tags**: `taginfNFe($std)` com `chave`, `dPrev`, `PIN` (opcional)
- **infDoc**: É criado internamente com infNFe dentro de infCarga

### Opção 2 — Tenho CT-e de outra transportadora

- **Entrada**: Chave CT-e (44 dígitos), XML do CT-e, PDF
- **ide.tpServ**: 1 (Subcontratação), 2 (Redespacho), 3 (Redespacho Intermediário)
- **Tags**: `tagdocAnt()`, `tagemiDocAnt()`, `tagidDocAntEle()` com `chCTe`

### Opção 3 — Tenho Nota de produtos (talão)

- **Entrada**: Dados da nota fiscal de talão (série, número, modelo, etc.)
- **Tags**: `taginfNF()` com nRoma, nPed, mod, serie, nDoc, dEmi, vBC, vICMS, vNF, etc.

### Opção 4 — Tenho outro documento

- **Entrada**: Tipo (Declaração, CF-e, NFC-e, Outros), descrição, número, valor, data
- **Tags**: `taginfOutros()` com tpDoc, descOutros, nDoc, dEmi, vDocFisc, dPrev
- **tpDoc**: 00=Declaração de conteúdo, 04=CF-e SAT, 05=NFC-e, 99=Outros

## Ordem de chamadas MakeCTe (infCTeNorm)

Para CT-e normal com documentos:

1. `taginfCTe()`, `tagide()`, `tagtoma3()` ou `tagtoma4()`
2. `tagemit()`, `tagenderEmit()`
3. `tagrem()`, `tagenderReme()`
4. `tagexp()`, `tagenderExped()` (se houver)
5. `tagreceb()`, `tagenderReceb()` (se houver)
6. `tagdest()`, `tagenderDest()`
7. `tagvPrest()`, `tagComp()` (componentes)
8. `tagicms()`, `tagimp()`
9. `taginfCTeNorm()`, `taginfCarga()`, `taginfQ()`
10. **Documentos**: `taginfDoc()` + `taginfNF()` ou `taginfNFe()` ou `taginfOutros()` ou `tagdocAnt()` + ...
11. `taginfModal()`, `tagrodo()` (modal rodoviário)
12. `tagfat()`, `tagdup()` (cobrança)
13. `monta()`

## Implementação atual no Fleet Guardian AI

| Fluxo | Status | Observação |
|-------|--------|------------|
| **manual** | ✅ Completo | Formulário com remetente, destinatário, valor |
| **cte_outro** | ⚠️ Parcial | `tpServ` (1/2/3) aplicado no ide. `docAnt` com chave CT-e pendente (requer infCTeNorm) |
| **nfe** | 📋 Preparado | UI com chave NFe. Backend: usar `taginfNFe` + infCTeNorm/infDoc |
| **nota_talao** | 📋 Preparado | UI. Backend: usar `taginfNF` |
| **outros** | ⚠️ Parcial | UI com tpDoc, descOutros, nDoc, vDocFisc, dEmi. Backend: usar `taginfOutros` + infCTeNorm/infDoc |

Os fluxos nfe, nota_talao e outros requerem `taginfCTeNorm()`, `taginfCarga()`, `taginfDoc()` antes dos documentos. A estrutura atual do CTeService usa um CT-e simplificado sem infCTeNorm. Para implementação completa, refatorar para incluir esses blocos.
