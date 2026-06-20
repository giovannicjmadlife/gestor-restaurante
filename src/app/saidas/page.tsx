"use client";

import AdminSidebar from "@/components/AdminSidebar";
import FinancePeriodFilter, {
  dataNoPeriodo,
  descricaoPeriodo,
} from "@/components/FinancePeriodFilter";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  LS_SAIDAS,
  buscarFinanceiroSupabase,
  deduplicarPorId,
  lerArrayLocalStorage,
  removerLancamentoFinanceiroSupabase,
  salvarArrayLocalStorage,
  salvarFinanceiroSupabase,
} from "@/lib/financeiroSupabase";

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

const STORAGE_KEY = LS_SAIDAS;

const categoriasSaida = [
  "Fornecedores",
  "Funcionários",
  "Aluguel",
  "Energia",
  "Água",
  "Gás",
  "Internet",
  "Embalagens",
  "Marketing",
  "Manutenção",
  "Impostos",
  "Maquininha/cartão",
  "Delivery/taxas",
  "Outros",
];

const formasPagamento = [
  "Dinheiro",
  "Pix",
  "Cartão débito",
  "Cartão crédito",
  "Boleto",
  "Transferência",
  "Débito automático",
  "Outros",
];

const statusSaida: StatusSaida[] = ["Pago", "Pendente", "Vencido"];

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


export default function SaidasPage() {
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  const [data, setData] = useState(gerarDataHoje());
  const [categoria, setCategoria] = useState(categoriasSaida[0]);
  const [descricao, setDescricao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(formasPagamento[0]);
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<StatusSaida>("Pago");

  useEffect(() => {
    let ativo = true;

    async function carregarSaidas() {
      const saidasLocais = lerArrayLocalStorage<Saida>(STORAGE_KEY);

      if (ativo) {
        setSaidas(saidasLocais);
      }

      try {
        const dados = await buscarFinanceiroSupabase();
        const saidasSupabase = (dados.saidas || []) as Saida[];
        const listaFinal = saidasSupabase.length > 0
          ? (deduplicarPorId(saidasSupabase) as Saida[])
          : saidasLocais;

        if (!ativo) return;

        setSaidas(listaFinal);
        salvarArrayLocalStorage(STORAGE_KEY, listaFinal);
      } catch (erro) {
        console.warn("Não foi possível carregar saídas do Supabase.", erro);
      } finally {
        if (ativo) setDadosCarregados(true);
      }
    }

    carregarSaidas();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!dadosCarregados) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saidas));
  }, [saidas, dadosCarregados]);

  const saidasFiltradas = useMemo(
    () => saidas.filter((item) => dataNoPeriodo(item.data, dataInicial, dataFinal)),
    [saidas, dataInicial, dataFinal]
  );

  const saidasOrdenadas = useMemo(() => {
    return [...saidasFiltradas].sort((a, b) => {
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  }, [saidasFiltradas]);

  const resumo = useMemo(() => {
    const totalGeral = saidasFiltradas.reduce((soma, saida) => soma + saida.valor, 0);

    const totalPago = saidasFiltradas.reduce((soma, saida) => {
      if (saida.status === "Pago") return soma + saida.valor;
      return soma;
    }, 0);

    const totalPendente = saidasFiltradas.reduce((soma, saida) => {
      if (saida.status === "Pendente") return soma + saida.valor;
      return soma;
    }, 0);

    const totalVencido = saidasFiltradas.reduce((soma, saida) => {
      if (saida.status === "Vencido") return soma + saida.valor;
      return soma;
    }, 0);

    return {
      totalGeral,
      totalPago,
      totalPendente,
      totalVencido,
      quantidade: saidasFiltradas.length,
    };
  }, [saidasFiltradas]);

  const resumoPorCategoria = useMemo(() => {
    const totais = categoriasSaida.map((nome) => {
      const total = saidasFiltradas
        .filter((saida) => saida.categoria === nome)
        .reduce((soma, saida) => soma + saida.valor, 0);

      return {
        nome,
        total,
      };
    });

    return totais;
  }, [saidasFiltradas]);

  async function cadastrarSaida(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valor.replace(",", "."));

    if (!data) {
      alert("Informe a data da saída.");
      return;
    }

    if (!descricao.trim()) {
      alert("Informe uma descrição para a saída.");
      return;
    }

    if (!valorNumerico || valorNumerico <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const agora = new Date().toISOString();
    const novaSaida: Saida = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      data,
      categoria,
      descricao: descricao.trim(),
      formaPagamento,
      valor: valorNumerico,
      status,
      ...(status === "Pago" ? { dataPagamento: data, pagoEm: agora } : {}),
    } as Saida;

    setSaidas((listaAtual) => [novaSaida, ...listaAtual]);

    try {
      await salvarFinanceiroSupabase({ saida: novaSaida });
    } catch (erro) {
      console.warn("Saída salva localmente, mas não sincronizou com o Supabase.", erro);
      alert("Salvei no navegador, mas não consegui sincronizar com o Supabase agora.");
    }

    setData(gerarDataHoje());
    setCategoria(categoriasSaida[0]);
    setDescricao("");
    setFormaPagamento(formasPagamento[0]);
    setValor("");
    setStatus("Pago");
  }

  async function excluirSaida(id: string) {
    const confirmar = window.confirm("Deseja excluir esta saída?");

    if (!confirmar) return;

    setSaidas((listaAtual) => listaAtual.filter((saida) => saida.id !== id));

    try {
      await removerLancamentoFinanceiroSupabase("saida", id);
    } catch (erro) {
      console.warn("Saída excluída localmente, mas não sincronizou com o Supabase.", erro);
      alert("Excluí do navegador, mas não consegui excluir do Supabase agora.");
    }
  }

  async function marcarComoPago(id: string) {
    const saidaOriginal = saidas.find((saida) => saida.id === id);

    if (!saidaOriginal) return;

    const confirmar = window.confirm("Deseja marcar esta saída como paga e atualizar o saldo real?");

    if (!confirmar) return;

    const atualizada = {
      ...saidaOriginal,
      status: "Pago" as StatusSaida,
      dataPagamento: gerarDataHoje(),
      pagoEm: new Date().toISOString(),
    };

    setSaidas((listaAtual) => listaAtual.map((saida) => (saida.id === id ? atualizada : saida)));

    try {
      await salvarFinanceiroSupabase({ saida: atualizada });
    } catch (erro) {
      console.warn("Pagamento salvo localmente, mas não sincronizou com o Supabase.", erro);
      alert("Marquei como pago no navegador, mas não consegui sincronizar com o Supabase agora.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <AdminSidebar active="saidas" />

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.35em] text-orange-600">
                  Financeiro
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Saídas do restaurante
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Cadastre despesas como fornecedores, funcionários, aluguel,
                  energia, gás, embalagens, taxas de delivery e outros custos do
                  restaurante.
                </p>
              </div>

              <a
                href="/"
                className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                Voltar ao dashboard
              </a>
            </div>
          </div>

          <FinancePeriodFilter
            dataInicial={dataInicial}
            dataFinal={dataFinal}
            onDataInicialChange={setDataInicial}
            onDataFinalChange={setDataFinal}
            titulo="Filtros de saídas"
            descricao={`Os valores e a lista mostram o período ${descricaoPeriodo(dataInicial, dataFinal)}.`}
          />

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Saídas no período
              </p>
              <strong className="mt-3 block text-2xl font-black">
                {formatarMoeda(resumo.totalGeral)}
              </strong>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">Total pago</p>
              <strong className="mt-3 block text-2xl font-black text-emerald-700">
                {formatarMoeda(resumo.totalPago)}
              </strong>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Total pendente
              </p>
              <strong className="mt-3 block text-2xl font-black text-amber-700">
                {formatarMoeda(resumo.totalPendente)}
              </strong>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Total vencido
              </p>
              <strong className="mt-3 block text-2xl font-black text-red-700">
                {formatarMoeda(resumo.totalVencido)}
              </strong>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">
                Lançamentos
              </p>
              <strong className="mt-3 block text-2xl font-black">
                {resumo.quantidade}
              </strong>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Cadastrar nova saída</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Use este formulário para registrar qualquer dinheiro que saiu
                  do restaurante.
                </p>
              </div>

              <form onSubmit={cadastrarSaida} className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold">
                    Data
                    <input
                      type="date"
                      value={data}
                      onChange={(event) => setData(event.target.value)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Categoria
                    <select
                      value={categoria}
                      onChange={(event) => setCategoria(event.target.value)}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    >
                      {categoriasSaida.map((item) => (
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
                    placeholder="Ex: Compra de carne, pagamento de funcionário, conta de energia..."
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2 text-sm font-bold">
                    Forma de pagamento
                    <select
                      value={formaPagamento}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    >
                      {formasPagamento.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-bold">
                    Status
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as StatusSaida)
                      }
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    >
                      {statusSaida.map((item) => (
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
                  className="mt-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-600"
                >
                  Salvar saída
                </button>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Resumo por categoria</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Veja onde o restaurante está gastando mais.
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
                <h3 className="text-xl font-black">Saídas cadastradas</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Histórico das despesas do período selecionado, carregadas do Supabase com cache local.
                </p>
              </div>

              <p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                Total geral: {formatarMoeda(resumo.totalGeral)}
              </p>
            </div>

            {saidasOrdenadas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm font-bold text-slate-700">
                  Nenhuma saída encontrada no período selecionado.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Cadastre a primeira despesa para começar o controle.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-3 font-bold">Data</th>
                      <th className="px-4 py-3 font-bold">Categoria</th>
                      <th className="px-4 py-3 font-bold">Descrição</th>
                      <th className="px-4 py-3 font-bold">Pagamento</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Valor</th>
                      <th className="px-4 py-3 text-right font-bold">Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {saidasOrdenadas.map((saida) => (
                      <tr
                        key={saida.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 font-medium">
                          {formatarData(saida.data)}
                        </td>

                        <td className="px-4 py-4">{saida.categoria}</td>

                        <td className="px-4 py-4">{saida.descricao}</td>

                        <td className="px-4 py-4">{saida.formaPagamento}</td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              saida.status === "Pago"
                                ? "bg-emerald-100 text-emerald-700"
                                : saida.status === "Pendente"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {saida.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right font-black text-red-700">
                          {formatarMoeda(saida.valor)}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {saida.status !== "Pago" && (
                              <button
                                type="button"
                                onClick={() => marcarComoPago(saida.id)}
                                className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Marcar pago
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => excluirSaida(saida.id)}
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