# Correção de taxas — 18/06/2026

Esta versão mantém o layout e ajusta o cálculo financeiro das taxas.

Regra aplicada:

- Dinheiro: não desconta taxa.
- PIX: desconta a taxa cadastrada com nome contendo PIX.
- Débito: desconta a taxa cadastrada com nome contendo Débito/Debito.
- Crédito: desconta a taxa cadastrada com nome contendo Crédito/Credito.
- Delivery: se a venda for Delivery, também desconta a taxa de delivery ativa.
- Taxa de entrega: continua sendo valor cobrado do cliente, não é desconto de maquininha.

Fórmula:

Faturamento bruto = valor total vendido/cobrado do cliente.
Taxas = taxa de PIX/Débito/Crédito + taxa de delivery, quando aplicável.
Faturamento líquido = faturamento bruto - taxas.

A correção foi aplicada em:

- src/lib/financeiroSupabase.ts
- src/app/api/financeiro/route.ts
- src/app/page.tsx
- src/app/relatorios/page.tsx

Depois de copiar para o projeto, rodar:

npm install
npx tsc --noEmit
npm run build

Depois testar criando uma venda de R$ 100,00:

- Dinheiro deve ficar líquido R$ 100,00.
- PIX 0,49% deve ficar líquido R$ 99,51.
- Débito 1,03% deve ficar líquido R$ 98,97.
- Crédito 2,99% deve ficar líquido R$ 97,01.
