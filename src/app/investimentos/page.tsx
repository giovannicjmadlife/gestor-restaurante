"use client";

import AdminSidebar from "@/components/AdminSidebar";
import FinancePeriodFilter, {
  dataNoPeriodo,
  descricaoPeriodo,
} from "@/components/FinancePeriodFilter";
import { useEffect, useMemo, useState } from "react";
import {
  LS_INVESTIMENTOS,
  buscarFinanceiroSupabase,
  deduplicarPorId,
  lerArrayLocalStorage,
  removerLancamentoFinanceiroSupabase,
  salvarArrayLocalStorage,
  salvarFinanceiroSupabase,
} from "@/lib/financeiroSupabase";

type StatusInvestimento = "Pago" | "Pendente" | "Planejado";

type CategoriaInvestimento =
  | "Equipamentos"
  | "Reforma"
  | "Móveis"
  | "Utensílios"
  | "Tecnologia/Sistema"
  | "Marketing estrutural"
  | "Manutenção grande"
  | "Treinamento"
  | "Outros";

type Investimento = {
  id: string;
  data: string;
  categoria: CategoriaInvestimento;
  descricao: string;
  fornecedor: string;
  status: StatusInvestimento;
  valor: number;
};

const STORAGE_KEY = LS_INVESTIMENTOS;

const categorias: CategoriaInvestimento[] = [
  "Equipamentos",
  "Reforma",
  "Móveis",
  "Utensílios",
  "Tecnologia/Sistema",
  "Marketing estrutural",
  "Manutenção grande",
  "Treinamento",
  "Outros",
];

const statusInvestimento: StatusInvestimento[] = [
  "Pago",
  "Pendente",
  "Planejado",
];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function InvestimentosPage() {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [data, setData] = useState(hojeISO());
  const [categoria, setCategoria] =
    useState<CategoriaInvestimento>("Equipamentos");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [status, setStatus] = useState<StatusInvestimento>("Planejado");
  const [valor, setValor] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarInvestimentos() {
      const investimentosLocais = lerArrayLocalStorage<Investimento>(STORAGE_KEY);

      if (ativo) {
        setInvestimentos(investimentosLocais);
      }

      try {
        const dados = await buscarFinanceiroSupabase();
        const investimentosSupabase = (dados.investimentos || []) as Investimento[];
        const listaFinal = investimentosSupabase.length > 0
          ? (deduplicarPorId(investimentosSupabase) as Investimento[])
          : investimentosLocais;

        if (!ativo) return;

        setInvestimentos(listaFinal);
        salvarArrayLocalStorage(STORAGE_KEY, listaFinal);
      } catch (erro) {
        console.warn("Não foi possível carregar investimentos do Supabase.", erro);
      } finally {
        if (ativo) setDadosCarregados(true);
      }
    }

    carregarInvestimentos();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!dadosCarregados) return;
    salvarArrayLocalStorage(STORAGE_KEY, investimentos);
  }, [investimentos, dadosCarregados]);

  const investimentosFiltrados = useMemo(
    () => investimentos.filter((item) => dataNoPeriodo(item.data, dataInicial, dataFinal)),
    [investimentos, dataInicial, dataFinal]
  );

  const resumo = useMemo(() => {
    const totalGeral = investimentosFiltrados.reduce(
      (acc, item) => acc + item.valor,
      0
    );

    const totalPago = investimentosFiltrados
      .filter((item) => item.status === "Pago")
      .reduce((acc, item) => acc + item.valor, 0);

    const totalPendente = investimentosFiltrados
      .filter((item) => item.status === "Pendente")
      .reduce((acc, item) => acc + item.valor, 0);

    const totalPlanejado = investimentosFiltrados
      .filter((item) => item.status === "Planejado")
      .reduce((acc, item) => acc + item.valor, 0);

    return {
      totalGeral,
      totalPago,
      totalPendente,
      totalPlanejado,
      quantidade: investimentosFiltrados.length,
    };
  }, [investimentosFiltrados]);

  const resumoPorCategoria = useMemo(() => {
    return categorias
      .map((categoriaAtual) => {
        const total = investimentosFiltrados
          .filter((item) => item.categoria === categoriaAtual)
          .reduce((acc, item) => acc + item.valor, 0);

        return {
          categoria: categoriaAtual,
          total,
        };
      })
      .filter((item) => item.total > 0);
  }, [investimentosFiltrados]);

  function limparFormulario() {
    setData(hojeISO());
    setCategoria("Equipamentos");
    setDescricao("");
    setFornecedor("");
    setStatus("Planejado");
    setValor("");
  }

  async function cadastrarInvestimento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valor.replace(",", "."));

    if (!data || !descricao.trim() || !valor || valorNumerico <= 0) {
      alert("Preencha data, descrição e valor corretamente.");
      return;
    }

    const novoInvestimento: Investimento = {
      id: criarId(),
      data,
      categoria,
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim(),
      status,
      valor: valorNumerico,
      ...(status === "Pago" ? { dataPagamento: data, pagoEm: new Date().toISOString() } : {}),
    } as Investimento;

    setInvestimentos((listaAtual) => [novoInvestimento, ...listaAtual]);

    try {
      await salvarFinanceiroSupabase({ investimento: novoInvestimento });
    } catch (erro) {
      console.warn("Investimento salvo localmente, mas não sincronizou com o Supabase.", erro);
      alert("Salvei no navegador, mas não consegui sincronizar com o Supabase agora.");
    }

    limparFormulario();
  }

  async function excluirInvestimento(id: string) {
    const confirmar = confirm("Deseja realmente excluir este investimento?");

    if (!confirmar) {
      return;
    }

    setInvestimentos((listaAtual) =>
      listaAtual.filter((item) => item.id !== id)
    );

    try {
      await removerLancamentoFinanceiroSupabase("investimento", id);
    } catch (erro) {
      console.warn("Investimento excluído localmente, mas não sincronizou com o Supabase.", erro);
      alert("Excluí no navegador, mas não consegui excluir do Supabase agora.");
    }
  }

  async function marcarComoPago(id: string) {
    const investimentoOriginal = investimentos.find((item) => item.id === id);

    if (!investimentoOriginal) return;

    const atualizado = {
      ...investimentoOriginal,
      status: "Pago" as StatusInvestimento,
      dataPagamento: hojeISO(),
      pagoEm: new Date().toISOString(),
    };

    setInvestimentos((listaAtual) =>
      listaAtual.map((item) => (item.id === id ? atualizado : item))
    );

    try {
      await salvarFinanceiroSupabase({ investimento: atualizado });
    } catch (erro) {
      console.warn("Pagamento do investimento salvo localmente, mas não sincronizou com o Supabase.", erro);
      alert("Marquei como pago no navegador, mas não consegui sincronizar com o Supabase agora.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="investimentos" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Controle administrativo
            </p>

            <h1 className="text-3xl font-bold text-slate-950">
              Investimentos
            </h1>

            <p className="text-sm text-slate-600">
              Registre melhorias, compras grandes, reformas, equipamentos e
              investimentos estruturais do restaurante.
            </p>
          </div>

          <FinancePeriodFilter
            dataInicial={dataInicial}
            dataFinal={dataFinal}
            onDataInicialChange={setDataInicial}
            onDataFinalChange={setDataFinal}
            titulo="Filtros de investimentos"
            descricao={`Os valores e investimentos mostram o período ${descricaoPeriodo(dataInicial, dataFinal)}.`}
          />

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total investido</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {formatarMoeda(resumo.totalGeral)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Pago</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(resumo.totalPago)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Pendente</p>
              <strong className="mt-2 block text-2xl text-orange-600">
                {formatarMoeda(resumo.totalPendente)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Planejado</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {formatarMoeda(resumo.totalPlanejado)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Lançamentos</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumo.quantidade}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-5 text-xl font-bold text-slate-950">
                Novo investimento
              </h2>

              <form onSubmit={cadastrarInvestimento} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Data
                  </label>
                  <input
                    type="date"
                    value={data}
                    onChange={(event) => setData(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Categoria
                  </label>
                  <select
                    value={categoria}
                    onChange={(event) =>
                      setCategoria(
                        event.target.value as CategoriaInvestimento
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {categorias.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    placeholder="Ex: forno novo, reforma da cozinha..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fornecedor ou responsável
                  </label>
                  <input
                    type="text"
                    value={fornecedor}
                    onChange={(event) => setFornecedor(event.target.value)}
                    placeholder="Ex: Loja, pedreiro, técnico, empresa..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as StatusInvestimento)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {statusInvestimento.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Valor
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valor}
                    onChange={(event) => setValor(event.target.value)}
                    placeholder="Ex: 2500"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                >
                  Cadastrar investimento
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-950">
                    Lista de investimentos
                  </h2>

                  <p className="text-sm text-slate-500">
                    Todos os investimentos ficam salvos no Supabase com cache local.
                  </p>
                </div>

                {investimentosFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhum investimento encontrado no período selecionado.
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Use o formulário ao lado para lançar o primeiro
                      investimento.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3">Data</th>
                          <th className="px-3 py-3">Descrição</th>
                          <th className="px-3 py-3">Categoria</th>
                          <th className="px-3 py-3">Fornecedor</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Valor</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {investimentosFiltrados.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 text-sm"
                          >
                            <td className="px-3 py-4 text-slate-700">
                              {item.data.split("-").reverse().join("/")}
                            </td>

                            <td className="px-3 py-4 font-semibold text-slate-950">
                              {item.descricao}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.categoria}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.fornecedor || "-"}
                            </td>

                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  item.status === "Pago"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "Pendente"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-slate-950">
                              {formatarMoeda(item.valor)}
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end gap-2">
                                {item.status !== "Pago" && (
                                  <button
                                    type="button"
                                    onClick={() => marcarComoPago(item.id)}
                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                                  >
                                    Marcar pago
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    excluirInvestimento(item.id)
                                  }
                                  className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300"
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

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Resumo por categoria
                </h2>

                {resumoPorCategoria.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum resumo disponível ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {resumoPorCategoria.map((item) => (
                      <div
                        key={item.categoria}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-slate-700">
                          {item.categoria}
                        </span>

                        <strong className="text-sm text-slate-950">
                          {formatarMoeda(item.total)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}