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
    const entradasHoje = entradas
      .filter((entrada) => pertenceAoDiaAtual(entrada.data))
      .reduce((acc, entrada) => acc + entrada.valor, 0);

    const entradasMes = entradas
      .filter((entrada) => pertenceAoMesAtual(entrada.data))
      .reduce((acc, entrada) => acc + entrada.valor, 0);

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

    const lucroEstimado = entradasMes - despesasMes - folhaMes;

    const saldoPrevisto = lucroEstimado + contasAReceber - contasAPagar;

    const totalLancamentos =
      entradas.length + saidas.length + contasReceber.length + folhaPagamento.length;

    return {
      entradasHoje,
      entradasMes,
      despesasMes,
      folhaMes,
      contasAPagar,
      contasAReceber,
      lucroEstimado,
      saldoPrevisto,
      totalLancamentos,
    };
  }, [entradas, saidas, contasReceber, folhaPagamento]);

  const ultimosLancamentos = useMemo(() => {
    const listaEntradas = entradas.map((item) => ({
      id: `entrada-${item.id}`,
      data: item.data,
      tipo: "Entrada",
      descricao: item.descricao || item.categoria,
      categoria: item.categoria,
      valor: item.valor,
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
        <aside className="w-72 bg-slate-950 text-white">
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
              <p className="text-sm text-slate-500">Venda de hoje</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {formatarMoeda(resumo.entradasHoje)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Soma das entradas lançadas hoje.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Venda do mês</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(resumo.entradasMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Total de entradas do mês atual.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Despesas do mês</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {formatarMoeda(resumo.despesasMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Soma das saídas lançadas no mês.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Lucro estimado</p>
              <strong
                className={`mt-2 block text-2xl ${
                  resumo.lucroEstimado >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {formatarMoeda(resumo.lucroEstimado)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Venda do mês menos despesas e folha.
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
              <p className="text-sm text-slate-500">Contas a receber</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {formatarMoeda(resumo.contasAReceber)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Valores pendentes ou atrasados.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Folha do mês</p>
              <strong className="mt-2 block text-2xl text-purple-700">
                {formatarMoeda(resumo.folhaMes)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Total da folha cadastrada no mês.
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
                Lucro + receber - pagar.
              </p>
            </div>
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