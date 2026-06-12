"use client";

import { useEffect, useMemo, useState } from "react";

type Entrada = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  formaRecebimento: string;
  valor: number;
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

type Investimento = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  fornecedor: string;
  status: "Pago" | "Pendente" | "Planejado";
  valor: number;
};

type LancamentoRelatorio = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  categoria: string;
  status: string;
  valor: number;
};

const ENTRADAS_KEY = "gestor-restaurante-entradas";
const SAIDAS_KEY = "gestor-restaurante-saidas";
const CONTAS_RECEBER_KEY = "gestor-restaurante-contas-receber";
const FOLHA_KEY = "gestor-restaurante-folha-pagamento";
const INVESTIMENTOS_KEY = "gestor-restaurante-investimentos";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data: string) {
  if (!data) {
    return "-";
  }

  return data.split("-").reverse().join("/");
}

function obterAnoMesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function pertenceAoMesAtual(data: string) {
  return data?.slice(0, 7) === obterAnoMesAtual();
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

export default function RelatoriosPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [folhaPagamento, setFolhaPagamento] = useState<FolhaPagamento[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);

  useEffect(() => {
    setEntradas(lerLocalStorage<Entrada>(ENTRADAS_KEY));
    setSaidas(lerLocalStorage<Saida>(SAIDAS_KEY));
    setContasReceber(lerLocalStorage<ContaReceber>(CONTAS_RECEBER_KEY));
    setFolhaPagamento(lerLocalStorage<FolhaPagamento>(FOLHA_KEY));
    setInvestimentos(lerLocalStorage<Investimento>(INVESTIMENTOS_KEY));
  }, []);

  const resumo = useMemo(() => {
    const entradasMes = entradas
      .filter((item) => pertenceAoMesAtual(item.data))
      .reduce((acc, item) => acc + item.valor, 0);

    const saidasMes = saidas
      .filter((item) => pertenceAoMesAtual(item.data))
      .reduce((acc, item) => acc + item.valor, 0);

    const folhaMes = folhaPagamento
      .filter((item) => pertenceAoMesAtual(item.data))
      .reduce((acc, item) => acc + item.valor, 0);

    const investimentosMes = investimentos
      .filter((item) => pertenceAoMesAtual(item.data))
      .reduce((acc, item) => acc + item.valor, 0);

    const contasAPagar = saidas
      .filter((item) => item.status === "Pendente" || item.status === "Vencido")
      .reduce((acc, item) => acc + item.valor, 0);

    const contasAReceber = contasReceber
      .filter((item) => item.status === "Pendente" || item.status === "Atrasado")
      .reduce((acc, item) => acc + item.valor, 0);

    const contasRecebidas = contasReceber
      .filter((item) => item.status === "Recebido")
      .reduce((acc, item) => acc + item.valor, 0);

    const folhaAberta = folhaPagamento
      .filter((item) => item.status === "Pendente" || item.status === "Atrasado")
      .reduce((acc, item) => acc + item.valor, 0);

    const investimentosPendentes = investimentos
      .filter((item) => item.status === "Pendente" || item.status === "Planejado")
      .reduce((acc, item) => acc + item.valor, 0);

    const lucroOperacional = entradasMes - saidasMes - folhaMes;

    const saldoPrevisto =
      lucroOperacional + contasAReceber - contasAPagar - investimentosPendentes;

    const totalLancamentos =
      entradas.length +
      saidas.length +
      contasReceber.length +
      folhaPagamento.length +
      investimentos.length;

    return {
      entradasMes,
      saidasMes,
      folhaMes,
      investimentosMes,
      contasAPagar,
      contasAReceber,
      contasRecebidas,
      folhaAberta,
      investimentosPendentes,
      lucroOperacional,
      saldoPrevisto,
      totalLancamentos,
    };
  }, [entradas, saidas, contasReceber, folhaPagamento, investimentos]);

  const margemLucro = useMemo(() => {
    if (resumo.entradasMes <= 0) {
      return 0;
    }

    return (resumo.lucroOperacional / resumo.entradasMes) * 100;
  }, [resumo.entradasMes, resumo.lucroOperacional]);

  const lancamentosRecentes = useMemo<LancamentoRelatorio[]>(() => {
    const listaEntradas: LancamentoRelatorio[] = entradas.map((item) => ({
      id: `entrada-${item.id}`,
      data: item.data,
      tipo: "Entrada",
      descricao: item.descricao || item.categoria,
      categoria: item.categoria,
      status: "Recebido",
      valor: item.valor,
    }));

    const listaSaidas: LancamentoRelatorio[] = saidas.map((item) => ({
      id: `saida-${item.id}`,
      data: item.data,
      tipo: "Saída",
      descricao: item.descricao || item.categoria,
      categoria: item.categoria,
      status: item.status,
      valor: item.valor,
    }));

    const listaReceber: LancamentoRelatorio[] = contasReceber.map((item) => ({
      id: `receber-${item.id}`,
      data: item.data,
      tipo: "Conta a receber",
      descricao: item.cliente || item.descricao || item.categoria,
      categoria: item.categoria,
      status: item.status,
      valor: item.valor,
    }));

    const listaFolha: LancamentoRelatorio[] = folhaPagamento.map((item) => ({
      id: `folha-${item.id}`,
      data: item.data,
      tipo: "Folha",
      descricao: item.nome || item.descricao || item.funcao,
      categoria: item.funcao,
      status: item.status,
      valor: item.valor,
    }));

    const listaInvestimentos: LancamentoRelatorio[] = investimentos.map(
      (item) => ({
        id: `investimento-${item.id}`,
        data: item.data,
        tipo: "Investimento",
        descricao: item.descricao || item.categoria,
        categoria: item.categoria,
        status: item.status,
        valor: item.valor,
      })
    );

    return [
      ...listaEntradas,
      ...listaSaidas,
      ...listaReceber,
      ...listaFolha,
      ...listaInvestimentos,
    ]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 12);
  }, [entradas, saidas, contasReceber, folhaPagamento, investimentos]);

  const rankingSaidas = useMemo(() => {
    const mapa = new Map<string, number>();

    saidas.forEach((item) => {
      mapa.set(item.categoria, (mapa.get(item.categoria) || 0) + item.valor);
    });

    return Array.from(mapa.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [saidas]);

  const rankingEntradas = useMemo(() => {
    const mapa = new Map<string, number>();

    entradas.forEach((item) => {
      mapa.set(item.categoria, (mapa.get(item.categoria) || 0) + item.valor);
    });

    return Array.from(mapa.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [entradas]);

  const diagnostico = useMemo(() => {
    if (resumo.totalLancamentos === 0) {
      return "Ainda não há dados suficientes para gerar um diagnóstico. Cadastre entradas, saídas, contas, folha e investimentos para acompanhar o desempenho.";
    }

    if (resumo.lucroOperacional < 0) {
      return "Atenção: o mês está com resultado negativo. Verifique despesas, folha de pagamento e investimentos planejados antes de assumir novos compromissos.";
    }

    if (resumo.contasAPagar > resumo.contasAReceber + resumo.entradasMes) {
      return "Atenção ao caixa: as contas a pagar estão altas em relação às entradas e valores a receber. É recomendado acompanhar os vencimentos de perto.";
    }

    if (margemLucro >= 20) {
      return "Resultado positivo: o restaurante apresenta boa margem operacional neste mês. Continue acompanhando despesas, folha e recebíveis.";
    }

    return "O restaurante está com resultado positivo, mas com margem moderada. Vale acompanhar custos por categoria e manter controle diário das entradas.";
  }, [resumo, margemLucro]);

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
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
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
              className="block rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
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
              Análise geral
            </p>

            <h1 className="text-3xl font-bold text-slate-950">Relatórios</h1>

            <p className="text-sm text-slate-600">
              Veja um resumo consolidado das entradas, saídas, contas, folha,
              investimentos e saldo previsto.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Receita do mês</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(resumo.entradasMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Entradas lançadas no mês atual.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Despesas do mês</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {formatarMoeda(resumo.saidasMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Saídas lançadas no mês atual.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Folha do mês</p>
              <strong className="mt-2 block text-2xl text-purple-700">
                {formatarMoeda(resumo.folhaMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Pagamentos cadastrados na folha.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Resultado operacional</p>
              <strong
                className={`mt-2 block text-2xl ${
                  resumo.lucroOperacional >= 0
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {formatarMoeda(resumo.lucroOperacional)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Receita menos despesas e folha.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Contas a receber</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {formatarMoeda(resumo.contasAReceber)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Pendentes ou atrasadas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Contas a pagar</p>
              <strong className="mt-2 block text-2xl text-orange-600">
                {formatarMoeda(resumo.contasAPagar)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Saídas pendentes ou vencidas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Investimentos em aberto</p>
              <strong className="mt-2 block text-2xl text-indigo-700">
                {formatarMoeda(resumo.investimentosPendentes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Pendentes ou planejados.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Saldo previsto</p>
              <strong
                className={`mt-2 block text-2xl ${
                  resumo.saldoPrevisto >= 0
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {formatarMoeda(resumo.saldoPrevisto)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Resultado + receber - pagar - investimentos.
              </p>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-500">Margem operacional</p>
              <strong
                className={`mt-2 block text-3xl ${
                  margemLucro >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {margemLucro.toFixed(1)}%
              </strong>
              <p className="mt-3 text-sm text-slate-600">
                Percentual aproximado de resultado sobre a receita do mês.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-500">Total de lançamentos</p>
              <strong className="mt-2 block text-3xl text-slate-950">
                {resumo.totalLancamentos}
              </strong>
              <p className="mt-3 text-sm text-slate-600">
                Soma de todos os registros cadastrados no sistema.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-500">Investimentos do mês</p>
              <strong className="mt-2 block text-3xl text-indigo-700">
                {formatarMoeda(resumo.investimentosMes)}
              </strong>
              <p className="mt-3 text-sm text-slate-600">
                Total de investimentos cadastrados no mês atual.
              </p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-950">
              Diagnóstico rápido
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-700">
              {diagnostico}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-5 text-xl font-bold text-slate-950">
                Maiores categorias de entrada
              </h2>

              {rankingEntradas.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma entrada cadastrada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {rankingEntradas.map((item) => (
                    <div
                      key={item.categoria}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {item.categoria}
                      </span>

                      <strong className="text-sm text-emerald-700">
                        {formatarMoeda(item.total)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-5 text-xl font-bold text-slate-950">
                Maiores categorias de saída
              </h2>

              {rankingSaidas.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma saída cadastrada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {rankingSaidas.map((item) => (
                    <div
                      key={item.categoria}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {item.categoria}
                      </span>

                      <strong className="text-sm text-red-600">
                        {formatarMoeda(item.total)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">
                Lançamentos recentes
              </h2>

              <p className="text-sm text-slate-500">
                Últimos registros consolidados de todos os módulos.
              </p>
            </div>

            {lancamentosRecentes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-medium text-slate-700">
                  Nenhum lançamento encontrado.
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre dados nas páginas do sistema para visualizar os
                  relatórios.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Data</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Descrição</th>
                      <th className="px-3 py-3">Categoria</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Valor</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lancamentosRecentes.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 text-sm"
                      >
                        <td className="px-3 py-4 text-slate-700">
                          {formatarData(item.data)}
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
                                : item.tipo === "Investimento"
                                ? "bg-indigo-100 text-indigo-700"
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

                        <td className="px-3 py-4 text-slate-700">
                          {item.status || "-"}
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
        </section>
      </div>
    </main>
  );
}