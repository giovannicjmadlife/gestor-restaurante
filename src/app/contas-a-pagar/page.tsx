"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type StatusSaida = "Pago" | "Pendente" | "Vencido";

type Saida = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  formaPagamento: string;
  valor: number;
  status: StatusSaida;
};

const STORAGE_KEY = "gestor-restaurante-saidas";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data: string) {
  if (!data) return "-";

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) return data;

  return `${dia}/${mes}/${ano}`;
}

function MenuLateral() {
  return (
    <aside className="w-full border-b border-slate-800 bg-slate-950 p-5 text-white lg:min-h-screen lg:w-72 lg:border-b-0">
      <div className="mb-8 flex flex-col items-start">
        <div className="mb-5 w-full rounded-2xl bg-black/20 p-3">
          <Image
            src="/logo-01.png"
            alt="Logo Samambaia Restaurante e Pizzaria"
            width={220}
            height={160}
            className="h-auto w-full object-contain"
            priority
          />
        </div>

        <p className="text-xs uppercase tracking-[0.35em] text-orange-400">
          Gestor
        </p>

        <h1 className="mt-2 text-2xl font-bold">Restaurante</h1>

        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Controle financeiro simples para acompanhar o caixa do seu negócio.
        </p>
      </div>

      <nav className="grid gap-2">
        <a
          href="/"
          className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Dashboard
        </a>

        <a
          href="/entradas"
          className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Entradas
        </a>

        <a
          href="/saidas"
          className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Saídas
        </a>

        <a
          href="/contas-a-pagar"
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
        >
          Contas a pagar
        </a>

        <a
          href="/contas-a-receber"
          className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Contas a receber
        </a>

        <button
          type="button"
          disabled
          className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500"
        >
          Folha de pagamento
        </button>

        <button
          type="button"
          disabled
          className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500"
        >
          Investimentos
        </button>

        <button
          type="button"
          disabled
          className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500"
        >
          Relatórios
        </button>

        <button
          type="button"
          disabled
          className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-500"
        >
          Configurações
        </button>
      </nav>
    </aside>
  );
}

export default function ContasAPagarPage() {
  const [saidas, setSaidas] = useState<Saida[]>([]);

  useEffect(() => {
    const dadosSalvos = localStorage.getItem(STORAGE_KEY);

    if (!dadosSalvos) return;

    try {
      const dadosConvertidos = JSON.parse(dadosSalvos) as Saida[];

      if (Array.isArray(dadosConvertidos)) {
        setSaidas(dadosConvertidos);
      }
    } catch {
      setSaidas([]);
    }
  }, []);

  const contas = useMemo(() => {
    return saidas
      .filter(
        (saida) => saida.status === "Pendente" || saida.status === "Vencido"
      )
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [saidas]);

  const resumo = useMemo(() => {
    const totalPendente = contas
      .filter((conta) => conta.status === "Pendente")
      .reduce((soma, conta) => soma + conta.valor, 0);

    const totalVencido = contas
      .filter((conta) => conta.status === "Vencido")
      .reduce((soma, conta) => soma + conta.valor, 0);

    const totalGeral = contas.reduce((soma, conta) => soma + conta.valor, 0);

    return {
      totalPendente,
      totalVencido,
      totalGeral,
      quantidade: contas.length,
    };
  }, [contas]);

  const resumoPorCategoria = useMemo(() => {
    const totais = contas.reduce<Record<string, number>>((acc, conta) => {
      acc[conta.categoria] = (acc[conta.categoria] || 0) + conta.valor;
      return acc;
    }, {});

    return Object.entries(totais)
      .map(([categoria, total]) => ({
        categoria,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [contas]);

  function marcarComoPago(id: string) {
    const confirmar = window.confirm("Deseja marcar esta conta como paga?");

    if (!confirmar) return;

    const novasSaidas = saidas.map((saida) => {
      if (saida.id === id) {
        return {
          ...saida,
          status: "Pago" as StatusSaida,
        };
      }

      return saida;
    });

    setSaidas(novasSaidas);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novasSaidas));
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <MenuLateral />

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.35em] text-orange-600">
                  Financeiro
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Contas a pagar
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Acompanhe todas as saídas lançadas como pendentes ou vencidas.
                  Quando uma conta for paga, você pode marcar como paga aqui.
                </p>
              </div>

              <a
                href="/saidas"
                className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                Nova saída
              </a>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Total a pagar
              </p>
              <strong className="mt-3 block text-2xl font-black text-red-700">
                {formatarMoeda(resumo.totalGeral)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Pendentes + vencidas
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Pendentes
              </p>
              <strong className="mt-3 block text-2xl font-black text-amber-700">
                {formatarMoeda(resumo.totalPendente)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Aguardando pagamento
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">Vencidas</p>
              <strong className="mt-3 block text-2xl font-black text-red-700">
                {formatarMoeda(resumo.totalVencido)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Precisam de atenção
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Quantidade
              </p>
              <strong className="mt-3 block text-2xl font-black">
                {resumo.quantidade}
              </strong>
              <p className="mt-2 text-xs text-slate-500">Contas em aberto</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Lista de contas</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Contas pendentes e vencidas cadastradas na tela de Saídas.
                </p>
              </div>

              {contas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    Nenhuma conta a pagar.
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Para aparecer aqui, cadastre uma saída com status Pendente ou
                    Vencido.
                  </p>

                  <a
                    href="/saidas"
                    className="mt-5 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-600"
                  >
                    Cadastrar saída
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="px-4 py-3 font-bold">Vencimento</th>
                        <th className="px-4 py-3 font-bold">Categoria</th>
                        <th className="px-4 py-3 font-bold">Descrição</th>
                        <th className="px-4 py-3 font-bold">Pagamento</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 text-right font-bold">
                          Valor
                        </th>
                        <th className="px-4 py-3 text-right font-bold">
                          Ação
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {contas.map((conta) => (
                        <tr
                          key={conta.id}
                          className="border-b border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-4 font-medium">
                            {formatarData(conta.data)}
                          </td>

                          <td className="px-4 py-4">{conta.categoria}</td>

                          <td className="px-4 py-4">{conta.descricao}</td>

                          <td className="px-4 py-4">{conta.formaPagamento}</td>

                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                conta.status === "Pendente"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {conta.status}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right font-black text-red-700">
                            {formatarMoeda(conta.valor)}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => marcarComoPago(conta.id)}
                              className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                            >
                              Marcar pago
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Resumo por categoria</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Veja quais categorias concentram mais contas em aberto.
                </p>
              </div>

              {resumoPorCategoria.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Nenhuma categoria com conta em aberto.
                </div>
              ) : (
                <div className="grid gap-4">
                  {resumoPorCategoria.map((item) => {
                    const percentual =
                      resumo.totalGeral > 0
                        ? (item.total / resumo.totalGeral) * 100
                        : 0;

                    return (
                      <div key={item.categoria}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-bold">
                            {item.categoria}
                          </span>

                          <span className="text-sm text-slate-600">
                            {formatarMoeda(item.total)}
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          {percentual.toFixed(1)}% do total em aberto
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
