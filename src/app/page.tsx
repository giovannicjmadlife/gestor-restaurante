"use client";

import { useEffect, useMemo, useState } from "react";

type Entrada = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  formaRecebimento: string;
  formaPagamento?: string;
  forma?: string;
  valor: number;
  valorBruto?: number;
  valorLiquido?: number;
  valorOriginal?: number;
  subtotalItens?: number;
  valorCobrado?: number;
  descontoValor?: number;
  taxaPercentual?: number;
  taxaDescontada?: number;
  taxaDeliveryDescontada?: number;
};

type Saida = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  formaPagamento: string;
  status: "Pago" | "Pendente" | "Vencido";
  valor: number;
};

type ContaReceber = {
  id: string;
  data: string;
  cliente: string;
  categoria: string;
  formaPrevista: string;
  descricao: string;
  status: "Recebido" | "Pendente" | "Atrasado";
  valor: number;
};

type FolhaPagamento = {
  id: string;
  data: string;
  nome: string;
  funcao: string;
  tipoPagamento: string;
  descricao: string;
  status: "Pago" | "Pendente" | "Atrasado";
  valor: number;
};

const ENTRADAS_KEY = "gestor-restaurante-entradas";
const SAIDAS_KEY = "gestor-restaurante-saidas";
const CONTAS_RECEBER_KEY = "gestor-restaurante-contas-receber";
const FOLHA_KEY = "gestor-restaurante-folha-pagamento";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function obterAnoMesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function pertenceAoMesAtual(data: string) {
  return data?.slice(0, 7) === obterAnoMesAtual();
}

function pertenceAoDiaAtual(data: string) {
  return data === hojeISO();
}

function lerLocalStorage<T>(chave: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const dados = localStorage.getItem(chave);

  if (!dados) {
    return [];
  }

  try {
    return JSON.parse(dados) as T[];
  } catch {
    return [];
  }
}

function numeroSeguro(valor: unknown) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor === "string") {
    const convertido = Number(valor.replace(",", "."));
    return Number.isFinite(convertido) ? convertido : 0;
  }

  return 0;
}

function valorBrutoEntrada(entrada: Entrada) {
  return (
    numeroSeguro(entrada.valorBruto) ||
    numeroSeguro(entrada.valorCobrado) ||
    numeroSeguro(entrada.valor)
  );
}

function taxaEntrada(entrada: Entrada) {
  const taxaMaquininha = numeroSeguro(entrada.taxaDescontada);
  const taxaDelivery = numeroSeguro(entrada.taxaDeliveryDescontada);

  if (taxaMaquininha || taxaDelivery) {
    return taxaMaquininha + taxaDelivery;
  }

  const bruto = numeroSeguro(entrada.valorBruto);
  const liquido = numeroSeguro(entrada.valorLiquido);

  if (bruto > 0 && liquido > 0 && bruto > liquido) {
    return Number((bruto - liquido).toFixed(2));
  }

  return 0;
}

function valorLiquidoEntrada(entrada: Entrada) {
  const liquido = numeroSeguro(entrada.valorLiquido);

  if (liquido > 0) {
    return liquido;
  }

  return Number((valorBrutoEntrada(entrada) - taxaEntrada(entrada)).toFixed(2));
}

function descontoEntrada(entrada: Entrada) {
  return numeroSeguro(entrada.descontoValor);
}

function formaPagamentoEntrada(entrada: Entrada) {
  const formaOriginal =
    entrada.formaRecebimento || entrada.formaPagamento || entrada.forma || "Não informado";

  const forma = formaOriginal
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (forma.includes("dinheiro")) return "Dinheiro";
  if (forma.includes("pix")) return "PIX";
  if (forma.includes("debito")) return "Débito";
  if (forma.includes("credito")) return "Crédito";
  if (forma.includes("correntista") || forma.includes("fiado") || forma.includes("conta")) {
    return "Correntista";
  }
  if (forma.includes("delivery")) return "Delivery";

  return formaOriginal || "Não informado";
}

export default function DashboardPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [folhaPagamento, setFolhaPagamento] = useState<FolhaPagamento[]>([]);

  useEffect(() => {
    setEntradas(lerLocalStorage<Entrada>(ENTRADAS_KEY));
    setSaidas(lerLocalStorage<Saida>(SAIDAS_KEY));
    setContasReceber(lerLocalStorage<ContaReceber>(CONTAS_RECEBER_KEY));
    setFolhaPagamento(lerLocalStorage<FolhaPagamento>(FOLHA_KEY));
  }, []);

  const resumo = useMemo(() => {
    const entradasDeHoje = entradas.filter((entrada) =>
      pertenceAoDiaAtual(entrada.data)
    );

    const entradasDoMes = entradas.filter((entrada) =>
      pertenceAoMesAtual(entrada.data)
    );

    const faturamentoHoje = entradasDeHoje.reduce(
      (acc, entrada) => acc + valorBrutoEntrada(entrada),
      0
    );

    const liquidoHoje = entradasDeHoje.reduce(
      (acc, entrada) => acc + valorLiquidoEntrada(entrada),
      0
    );

    const taxasHoje = entradasDeHoje.reduce(
      (acc, entrada) => acc + taxaEntrada(entrada),
      0
    );

    const descontosHoje = entradasDeHoje.reduce(
      (acc, entrada) => acc + descontoEntrada(entrada),
      0
    );

    const faturamentoMes = entradasDoMes.reduce(
      (acc, entrada) => acc + valorBrutoEntrada(entrada),
      0
    );

    const liquidoMes = entradasDoMes.reduce(
      (acc, entrada) => acc + valorLiquidoEntrada(entrada),
      0
    );

    const taxasMes = entradasDoMes.reduce(
      (acc, entrada) => acc + taxaEntrada(entrada),
      0
    );

    const descontosMes = entradasDoMes.reduce(
      (acc, entrada) => acc + descontoEntrada(entrada),
      0
    );

    const despesasMes = saidas
      .filter((saida) => pertenceAoMesAtual(saida.data))
      .reduce((acc, saida) => acc + saida.valor, 0);

    const folhaMes = folhaPagamento
      .filter((item) => pertenceAoMesAtual(item.data))
      .reduce((acc, item) => acc + item.valor, 0);

    const contasAPagar = saidas
      .filter((saida) => saida.status === "Pendente" || saida.status === "Vencido")
      .reduce((acc, saida) => acc + saida.valor, 0);

    const contasAReceber = contasReceber
      .filter(
        (conta) => conta.status === "Pendente" || conta.status === "Atrasado"
      )
      .reduce((acc, conta) => acc + conta.valor, 0);

    const lucroEstimado = liquidoMes - despesasMes - folhaMes;

    const saldoPrevisto = lucroEstimado + contasAReceber - contasAPagar;

    const totalLancamentos =
      entradas.length + saidas.length + contasReceber.length + folhaPagamento.length;

    return {
      faturamentoHoje,
      liquidoHoje,
      taxasHoje,
      descontosHoje,
      faturamentoMes,
      liquidoMes,
      taxasMes,
      descontosMes,
      despesasMes,
      folhaMes,
      contasAPagar,
      contasAReceber,
      lucroEstimado,
      saldoPrevisto,
      totalLancamentos,
    };
  }, [entradas, saidas, contasReceber, folhaPagamento]);

  const formasPagamentoMes = useMemo(() => {
    const entradasDoMes = entradas.filter((entrada) =>
      pertenceAoMesAtual(entrada.data)
    );

    const agrupado = new Map<
      string,
      { forma: string; quantidade: number; faturamento: number; liquido: number }
    >();

    entradasDoMes.forEach((entrada) => {
      const forma = formaPagamentoEntrada(entrada);
      const atual = agrupado.get(forma) || {
        forma,
        quantidade: 0,
        faturamento: 0,
        liquido: 0,
      };

      atual.quantidade += 1;
      atual.faturamento += valorBrutoEntrada(entrada);
      atual.liquido += valorLiquidoEntrada(entrada);

      agrupado.set(forma, atual);
    });

    const lista = Array.from(agrupado.values()).sort(
      (a, b) => b.faturamento - a.faturamento
    );

    const maiorValor = lista[0]?.faturamento || 0;

    return lista.map((item) => ({
      ...item,
      percentual:
        maiorValor > 0 ? Math.max((item.faturamento / maiorValor) * 100, 4) : 0,
    }));
  }, [entradas]);

  const ultimosLancamentos = useMemo(() => {
    const listaEntradas = entradas.map((item) => ({
      id: `entrada-${item.id}`,
      data: item.data,
      tipo: "Entrada",
      descricao: item.descricao || item.categoria,
      categoria: item.categoria,
      valor: valorLiquidoEntrada(item),
    }));

    const listaSaidas = saidas.map((item) => ({
      id: `saida-${item.id}`,
      data: item.data,
      tipo: "Saída",
      descricao: item.descricao || item.categoria,
      categoria: item.categoria,
      valor: item.valor,
    }));

    const listaReceber = contasReceber.map((item) => ({
      id: `receber-${item.id}`,
      data: item.data,
      tipo: "Conta a receber",
      descricao: item.cliente || item.descricao || item.categoria,
      categoria: item.categoria,
      valor: item.valor,
    }));

    const listaFolha = folhaPagamento.map((item) => ({
      id: `folha-${item.id}`,
      data: item.data,
      tipo: "Folha",
      descricao: item.nome || item.descricao || item.funcao,
      categoria: item.funcao,
      valor: item.valor,
    }));

    return [...listaEntradas, ...listaSaidas, ...listaReceber, ...listaFolha]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 8);
  }, [entradas, saidas, contasReceber, folhaPagamento]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 shrink-0 bg-slate-950 text-white">
          <div className="border-b border-white/10 px-6 py-6">
            <img
              src="/logo-01.png"
              alt="Samambaia Restaurante e Pizzaria"
              className="max-h-20 w-auto"
            />
          </div>

          <nav className="space-y-2 px-4 py-6">
            <a
              href="/"
              className="block rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Dashboard
            </a>

            <a
              href="/pdv"
              className="block rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Acessar PDV
            </a>

            <a
              href="/entradas"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Entradas
            </a>

            <a
              href="/saidas"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Saídas
            </a>

            <a
              href="/contas-a-pagar"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Contas a pagar
            </a>

            <a
              href="/contas-a-receber"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Contas a receber
            </a>

            <a
              href="/folha-de-pagamento"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Folha de pagamento
            </a>

            <a
              href="/investimentos"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Investimentos
            </a>

            <a
              href="/relatorios"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Relatórios
            </a>

            <a
              href="/configuracoes"
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Configurações
            </a>

          </nav>
        </aside>

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Visão geral
            </p>

            <h1 className="text-3xl font-bold text-slate-950">
              Dashboard financeiro
            </h1>

            <p className="text-sm text-slate-600">
              Acompanhe vendas, despesas, contas, folha de pagamento e saldo
              previsto do restaurante.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Faturado hoje</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {formatarMoeda(resumo.faturamentoHoje)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Total vendido hoje antes das taxas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Líquido hoje</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(resumo.liquidoHoje)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Faturado hoje menos taxas internas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Faturamento do mês</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {formatarMoeda(resumo.faturamentoMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Soma bruta das entradas do mês.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Valor líquido vendido</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(resumo.liquidoMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Entradas menos taxas de maquininha e delivery.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Taxas descontadas</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {formatarMoeda(resumo.taxasMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Crédito, débito, Pix e taxas de delivery do mês.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Descontos concedidos</p>
              <strong className="mt-2 block text-2xl text-orange-600">
                {formatarMoeda(resumo.descontosMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Descontos em reais registrados nas vendas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Despesas + folha</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {formatarMoeda(resumo.despesasMes + resumo.folhaMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Saídas lançadas no mês somadas à folha.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Saldo previsto</p>
              <strong
                className={`mt-2 block text-2xl ${
                  resumo.saldoPrevisto >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {formatarMoeda(resumo.saldoPrevisto)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Líquido - despesas - folha + receber - pagar.
              </p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Formas de pagamento no mês
                </h2>
                <p className="text-sm text-slate-500">
                  Acompanhe qual forma de pagamento mais vendeu por faturamento bruto.
                </p>
              </div>

              {formasPagamentoMes.length > 0 && (
                <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                  Mais vendido: {formasPagamentoMes[0].forma}
                </div>
              )}
            </div>

            {formasPagamentoMes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhuma venda no mês para gerar o gráfico.
              </div>
            ) : (
              <div className="space-y-4">
                {formasPagamentoMes.map((item) => (
                  <div key={item.forma}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-slate-950">{item.forma}</span>
                      <span className="font-semibold text-slate-600">
                        {item.quantidade} venda(s) · {formatarMoeda(item.faturamento)} faturado · {formatarMoeda(item.liquido)} líquido
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${item.percentual}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    Últimos lançamentos
                  </h2>
                  <p className="text-sm text-slate-500">
                    Entradas, saídas, contas a receber e folha de pagamento.
                  </p>
                </div>
              </div>

              {ultimosLancamentos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="font-medium text-slate-700">
                    Nenhum lançamento encontrado.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cadastre entradas, saídas, contas ou folha para visualizar
                    aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-3">Data</th>
                        <th className="px-3 py-3">Tipo</th>
                        <th className="px-3 py-3">Descrição</th>
                        <th className="px-3 py-3">Categoria</th>
                        <th className="px-3 py-3 text-right">Valor</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ultimosLancamentos.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 text-sm"
                        >
                          <td className="px-3 py-4 text-slate-700">
                            {item.data.split("-").reverse().join("/")}
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                item.tipo === "Entrada"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.tipo === "Saída"
                                  ? "bg-red-100 text-red-700"
                                  : item.tipo === "Folha"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {item.tipo}
                            </span>
                          </td>

                          <td className="px-3 py-4 font-medium text-slate-950">
                            {item.descricao || "-"}
                          </td>

                          <td className="px-3 py-4 text-slate-700">
                            {item.categoria || "-"}
                          </td>

                          <td className="px-3 py-4 text-right font-bold text-slate-950">
                            {formatarMoeda(item.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Atalhos rápidos
                </h2>

                <div className="mt-5 space-y-3">
                  <a
                    href="/pdv"
                    className="block rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-bold text-white hover:bg-orange-600"
                  >
                    Acessar PDV
                  </a>

                  <a
                    href="/entradas"
                    className="block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    Nova entrada
                  </a>

                  <a
                    href="/saidas"
                    className="block rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-red-700"
                  >
                    Nova saída
                  </a>

                  <a
                    href="/contas-a-receber"
                    className="block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Nova conta a receber
                  </a>

                  <a
                    href="/folha-de-pagamento"
                    className="block rounded-xl bg-purple-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-purple-700"
                  >
                    Novo pagamento da folha
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Resumo do sistema
                </h2>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm text-slate-600">Entradas</span>
                    <strong className="text-sm text-slate-950">
                      {entradas.length}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm text-slate-600">Saídas</span>
                    <strong className="text-sm text-slate-950">
                      {saidas.length}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm text-slate-600">
                      Contas a receber
                    </span>
                    <strong className="text-sm text-slate-950">
                      {contasReceber.length}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="text-sm text-slate-600">
                      Folha de pagamento
                    </span>
                    <strong className="text-sm text-slate-950">
                      {folhaPagamento.length}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">
                      Total de lançamentos
                    </span>
                    <strong className="text-sm text-slate-950">
                      {resumo.totalLancamentos}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}