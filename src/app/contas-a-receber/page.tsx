"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  LS_CONTAS_RECEBER,
  LS_ENTRADAS,
  buscarFinanceiroSupabase,
  deduplicarPorId,
  lerArrayLocalStorage,
  removerLancamentoFinanceiroSupabase,
  salvarArrayLocalStorage,
  salvarFinanceiroSupabase,
} from "@/lib/financeiroSupabase";

type StatusContaReceber = "Recebido" | "Pendente" | "Atrasado";

type ContaReceber = {
  id: string;
  data: string;
  origem: string;
  categoria: string;
  descricao: string;
  formaRecebimento: string;
  valor: number;
  status: StatusContaReceber;
  dataRecebimento?: string;
  recebidoEm?: string;
};

type EntradaRecebida = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  formaRecebimento: string;
  valor: number;
  valorBruto: number;
  valorTaxa: number;
  taxaDescontada: number;
  valorLiquido: number;
  valorCobrado: number;
  status: "Recebido";
  origem: string;
  contaReceberId: string;
  cliente: string;
  criadoEm: string;
  recebidoEm: string;
};

const STORAGE_KEY = LS_CONTAS_RECEBER;

const categoriasReceber = [
  "Cliente",
  "Delivery",
  "Evento",
  "Encomenda",
  "Cartão a receber",
  "Voucher",
  "Fiado",
  "Parceria",
  "Outros",
];

const formasRecebimento = [
  "Dinheiro",
  "Pix",
  "Cartão débito",
  "Cartão crédito",
  "Voucher",
  "Transferência",
  "Boleto",
  "Outros",
];

const statusConta: StatusContaReceber[] = ["Recebido", "Pendente", "Atrasado"];

function gerarDataHoje() {
  const agora = new Date();
  const dataLocal = new Date(
    agora.getTime() - agora.getTimezoneOffset() * 60000
  );

  return dataLocal.toISOString().slice(0, 10);
}

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


export default function ContasAReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [dadosCarregados, setDadosCarregados] = useState(false);

  const [data, setData] = useState(gerarDataHoje());
  const [origem, setOrigem] = useState("");
  const [categoria, setCategoria] = useState(categoriasReceber[0]);
  const [descricao, setDescricao] = useState("");
  const [formaRecebimento, setFormaRecebimento] = useState(
    formasRecebimento[1]
  );
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<StatusContaReceber>("Pendente");

  useEffect(() => {
    let ativo = true;

    async function carregarContas() {
      const contasLocais = lerArrayLocalStorage<ContaReceber>(STORAGE_KEY);

      if (ativo) {
        setContas(contasLocais);
      }

      try {
        const dados = await buscarFinanceiroSupabase();
        const contasSupabase = (dados.contasReceber || []) as ContaReceber[];
        const listaFinal = contasSupabase.length > 0
          ? (deduplicarPorId(contasSupabase) as ContaReceber[])
          : contasLocais;

        if (!ativo) return;

        setContas(listaFinal);
        salvarArrayLocalStorage(STORAGE_KEY, listaFinal);
      } catch (erro) {
        console.warn("Não foi possível carregar contas a receber do Supabase.", erro);
      } finally {
        if (ativo) setDadosCarregados(true);
      }
    }

    carregarContas();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!dadosCarregados) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(contas));
  }, [contas, dadosCarregados]);

  const contasOrdenadas = useMemo(() => {
    return [...contas].sort((a, b) => {
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });
  }, [contas]);

  const resumo = useMemo(() => {
    const totalRecebido = contas
      .filter((conta) => conta.status === "Recebido")
      .reduce((soma, conta) => soma + conta.valor, 0);

    const totalPendente = contas
      .filter((conta) => conta.status === "Pendente")
      .reduce((soma, conta) => soma + conta.valor, 0);

    const totalAtrasado = contas
      .filter((conta) => conta.status === "Atrasado")
      .reduce((soma, conta) => soma + conta.valor, 0);

    const totalAReceber = totalPendente + totalAtrasado;

    const totalGeral = contas.reduce((soma, conta) => soma + conta.valor, 0);

    return {
      totalRecebido,
      totalPendente,
      totalAtrasado,
      totalAReceber,
      totalGeral,
      quantidade: contas.length,
    };
  }, [contas]);

  const resumoPorCategoria = useMemo(() => {
    const totais = categoriasReceber.map((nome) => {
      const total = contas
        .filter((conta) => conta.categoria === nome && conta.status !== "Recebido")
        .reduce((soma, conta) => soma + conta.valor, 0);

      return {
        nome,
        total,
      };
    });

    return totais;
  }, [contas]);

  function criarEntradaRecebida(conta: ContaReceber): EntradaRecebida {
    const agora = new Date().toISOString();
    const dataRecebimento = conta.dataRecebimento || gerarDataHoje();

    return {
      id: `entrada-conta-receber-${conta.id}`,
      data: dataRecebimento,
      categoria: "Conta recebida",
      descricao: `Recebimento de conta: ${conta.descricao}`,
      formaRecebimento: conta.formaRecebimento || "Pix",
      valor: conta.valor,
      valorBruto: conta.valor,
      valorTaxa: 0,
      taxaDescontada: 0,
      valorLiquido: conta.valor,
      valorCobrado: conta.valor,
      status: "Recebido",
      origem: "Contas a receber",
      contaReceberId: conta.id,
      cliente: conta.origem,
      criadoEm: agora,
      recebidoEm: agora,
    };
  }

  function salvarEntradaRecebidaLocal(entrada: EntradaRecebida) {
    const entradasAtuais = lerArrayLocalStorage<EntradaRecebida>(LS_ENTRADAS);
    const entradasAtualizadas = [
      entrada,
      ...entradasAtuais.filter((item) => item.id !== entrada.id),
    ];

    salvarArrayLocalStorage(LS_ENTRADAS, entradasAtualizadas);
  }

  function removerEntradaRecebidaLocal(contaId: string) {
    const entradaId = `entrada-conta-receber-${contaId}`;
    const entradasAtuais = lerArrayLocalStorage<EntradaRecebida>(LS_ENTRADAS);
    salvarArrayLocalStorage(
      LS_ENTRADAS,
      entradasAtuais.filter((item) => item.id !== entradaId)
    );
  }

  async function cadastrarConta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valor.replace(",", "."));

    if (!data) {
      alert("Informe a data prevista para receber.");
      return;
    }

    if (!origem.trim()) {
      alert("Informe o cliente ou origem do recebimento.");
      return;
    }

    if (!descricao.trim()) {
      alert("Informe uma descrição.");
      return;
    }

    if (!valorNumerico || valorNumerico <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const agora = new Date().toISOString();
    const novaConta: ContaReceber = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      data,
      origem: origem.trim(),
      categoria,
      descricao: descricao.trim(),
      formaRecebimento,
      valor: valorNumerico,
      status,
      dataRecebimento: status === "Recebido" ? gerarDataHoje() : undefined,
      recebidoEm: status === "Recebido" ? agora : undefined,
    };

    const entradaRecebida = status === "Recebido" ? criarEntradaRecebida(novaConta) : null;

    setContas((listaAtual) => [novaConta, ...listaAtual]);
    if (entradaRecebida) salvarEntradaRecebidaLocal(entradaRecebida);

    try {
      await salvarFinanceiroSupabase({
        contaReceber: novaConta,
        ...(entradaRecebida ? { entrada: entradaRecebida } : {}),
      });
    } catch (erro) {
      console.warn("Conta salva no cache local, mas não sincronizou com o Supabase.", erro);
      alert("Salvei no navegador, mas não consegui sincronizar com o Supabase agora.");
    }

    setData(gerarDataHoje());
    setOrigem("");
    setCategoria(categoriasReceber[0]);
    setDescricao("");
    setFormaRecebimento(formasRecebimento[1]);
    setValor("");
    setStatus("Pendente");
  }

  async function excluirConta(id: string) {
    const confirmar = window.confirm("Deseja excluir esta conta a receber? Se ela já foi recebida, a entrada gerada também será removida.");

    if (!confirmar) return;

    setContas((listaAtual) => listaAtual.filter((conta) => conta.id !== id));
    removerEntradaRecebidaLocal(id);

    try {
      await Promise.all([
        removerLancamentoFinanceiroSupabase("conta_receber", id),
        removerLancamentoFinanceiroSupabase("entrada", `entrada-conta-receber-${id}`),
      ]);
    } catch (erro) {
      console.warn("Conta removida localmente, mas não sincronizou a exclusão no Supabase.", erro);
      alert("Removi do navegador, mas não consegui excluir do Supabase agora.");
    }
  }

  async function marcarComoRecebido(id: string) {
    const contaOriginal = contas.find((conta) => conta.id === id);

    if (!contaOriginal) {
      alert("Conta a receber não encontrada.");
      return;
    }

    const confirmar = window.confirm("Deseja marcar esta conta como recebida e lançar o valor no faturamento?");

    if (!confirmar) return;

    const agora = new Date().toISOString();
    const contaAtualizada: ContaReceber = {
      ...contaOriginal,
      status: "Recebido",
      dataRecebimento: gerarDataHoje(),
      recebidoEm: agora,
    };
    const entradaRecebida = criarEntradaRecebida(contaAtualizada);

    setContas((listaAtual) =>
      listaAtual.map((conta) => (conta.id === id ? contaAtualizada : conta))
    );
    salvarEntradaRecebidaLocal(entradaRecebida);

    try {
      await salvarFinanceiroSupabase({
        contaReceber: contaAtualizada,
        entrada: entradaRecebida,
      });
    } catch (erro) {
      console.warn("Recebimento salvo localmente, mas não sincronizou com o Supabase.", erro);
      alert("Marquei como recebido no navegador, mas não consegui sincronizar com o Supabase agora.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <AdminSidebar active="contas-a-receber" />

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.35em] text-orange-600">
                  Financeiro
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Contas a receber
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Cadastre valores que o restaurante ainda precisa receber, como
                  encomendas, eventos, fiado, delivery, cartões e parcerias.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 px-6 py-5 text-white">
                <p className="text-sm text-slate-300">Total a receber</p>
                <strong className="mt-1 block text-2xl font-black">
                  {formatarMoeda(resumo.totalAReceber)}
                </strong>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Total a receber
              </p>
              <strong className="mt-3 block text-2xl font-black text-emerald-700">
                {formatarMoeda(resumo.totalAReceber)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Pendentes + atrasados
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Recebido
              </p>
              <strong className="mt-3 block text-2xl font-black text-emerald-700">
                {formatarMoeda(resumo.totalRecebido)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">Já entrou no caixa</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Pendente
              </p>
              <strong className="mt-3 block text-2xl font-black text-amber-700">
                {formatarMoeda(resumo.totalPendente)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Ainda precisa receber
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">Atrasado</p>
              <strong className="mt-3 block text-2xl font-black text-red-700">
                {formatarMoeda(resumo.totalAtrasado)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Precisa de cobrança
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Lançamentos
              </p>
              <strong className="mt-3 block text-2xl font-black">
                {resumo.quantidade}
              </strong>
              <p className="mt-2 text-xs text-slate-500">Contas cadastradas</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">
                  Cadastrar conta a receber
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Use este formulário para registrar valores que ainda vão
                  entrar.
                </p>
              </div>

              <form onSubmit={cadastrarConta} className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold">
                    Data prevista
                    <input
                      type="date"
                      value={data}
                      onChange={(event) => setData(event.target.value)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Cliente ou origem
                    <input
                      type="text"
                      value={origem}
                      onChange={(event) => setOrigem(event.target.value)}
                      placeholder="Ex: João, iFood, evento, encomenda..."
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold">
                    Categoria
                    <select
                      value={categoria}
                      onChange={(event) => setCategoria(event.target.value)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    >
                      {categoriasReceber.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Forma prevista
                    <select
                      value={formaRecebimento}
                      onChange={(event) =>
                        setFormaRecebimento(event.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    >
                      {formasRecebimento.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-bold">
                  Descrição
                  <input
                    type="text"
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    placeholder="Ex: Encomenda de pizza, almoço fiado, evento..."
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold">
                    Status
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as StatusContaReceber)
                      }
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    >
                      {statusConta.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Valor
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valor}
                      onChange={(event) => setValor(event.target.value)}
                      placeholder="0,00"
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-600"
                >
                  Salvar conta a receber
                </button>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Resumo por categoria</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Veja de onde vêm os valores a receber.
                </p>
              </div>

              <div className="grid gap-4">
                {resumoPorCategoria.map((item) => {
                  const percentual =
                    resumo.totalGeral > 0
                      ? (item.total / resumo.totalGeral) * 100
                      : 0;

                  return (
                    <div key={item.nome}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold">{item.nome}</span>

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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black">
                  Contas a receber cadastradas
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Histórico dos valores previstos para entrar.
                </p>
              </div>

              <p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                Total geral: {formatarMoeda(resumo.totalGeral)}
              </p>
            </div>

            {contasOrdenadas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-bold text-slate-700">
                  Nenhuma conta a receber cadastrada.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Cadastre o primeiro valor previsto para receber.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 font-bold">Data</th>
                      <th className="px-4 py-3 font-bold">Origem</th>
                      <th className="px-4 py-3 font-bold">Categoria</th>
                      <th className="px-4 py-3 font-bold">Descrição</th>
                      <th className="px-4 py-3 font-bold">Forma</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-right font-bold">Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {contasOrdenadas.map((conta) => (
                      <tr
                        key={conta.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 font-medium">
                          {formatarData(conta.data)}
                        </td>

                        <td className="px-4 py-4">{conta.origem}</td>

                        <td className="px-4 py-4">{conta.categoria}</td>

                        <td className="px-4 py-4">{conta.descricao}</td>

                        <td className="px-4 py-4">
                          {conta.formaRecebimento}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              conta.status === "Recebido"
                                ? "bg-emerald-100 text-emerald-700"
                                : conta.status === "Pendente"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {conta.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right font-black text-emerald-700">
                          {formatarMoeda(conta.valor)}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {conta.status !== "Recebido" && (
                              <button
                                type="button"
                                onClick={() => marcarComoRecebido(conta.id)}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Recebido
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => excluirConta(conta.id)}
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                            >
                              Excluir
                            </button>
                          </div>
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