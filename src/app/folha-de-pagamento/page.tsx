"use client";

import AdminSidebar from "@/components/AdminSidebar";
import FinancePeriodFilter, {
  dataNoPeriodo,
  descricaoPeriodo,
} from "@/components/FinancePeriodFilter";
import { useEffect, useMemo, useState } from "react";
import {
  Colaborador,
  LS_FOLHA,
  buscarFinanceiroSupabase,
  deduplicarPorId,
  lerArrayLocalStorage,
  numeroSeguro,
  removerLancamentoFinanceiroSupabase,
  salvarArrayLocalStorage,
  salvarFinanceiroSupabase,
} from "@/lib/financeiroSupabase";

type StatusPagamento = "Pago" | "Pendente" | "Atrasado";

type TipoPagamento =
  | "Salário fixo"
  | "Diária"
  | "Hora"
  | "Comissão"
  | "Freelancer"
  | "Adiantamento"
  | "Extra"
  | "Outros";

type FuncaoFuncionario =
  | "Cozinha"
  | "Atendimento"
  | "Caixa"
  | "Entrega"
  | "Limpeza"
  | "Gerência"
  | "Pizzaiolo"
  | "Chapeiro"
  | "Garçom"
  | "Outros";

type FolhaItem = {
  id: string;
  data: string;
  nome: string;
  funcao: FuncaoFuncionario;
  tipoPagamento: TipoPagamento;
  descricao: string;
  status: StatusPagamento;
  valor: number;
  colaboradorId?: string;
  competencia?: string;
  diaPagamento?: number;
  origem?: string;
  dataPagamento?: string;
  pagoEm?: string;
};

const STORAGE_KEY = LS_FOLHA;

const funcoes: FuncaoFuncionario[] = [
  "Cozinha",
  "Atendimento",
  "Caixa",
  "Entrega",
  "Limpeza",
  "Gerência",
  "Pizzaiolo",
  "Chapeiro",
  "Garçom",
  "Outros",
];

const tiposPagamento: TipoPagamento[] = [
  "Salário fixo",
  "Diária",
  "Hora",
  "Comissão",
  "Freelancer",
  "Adiantamento",
  "Extra",
  "Outros",
];

const statusPagamento: StatusPagamento[] = ["Pago", "Pendente", "Atrasado"];

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


function dataPagamentoDoMes(competencia: string, diaPagamento: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Math.max(Math.trunc(diaPagamento || 5), 1), ultimoDia);
  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

function normalizarFuncao(valor: unknown): FuncaoFuncionario {
  const texto = String(valor || "");
  return funcoes.includes(texto as FuncaoFuncionario) ? (texto as FuncaoFuncionario) : "Outros";
}

function gerarFolhaMensal(colaboradores: Colaborador[], itensAtuais: FolhaItem[]) {
  const competencia = hojeISO().slice(0, 7);
  const idsAtuais = new Set(itensAtuais.map((item) => item.id));
  const hoje = hojeISO();
  const novosItens = colaboradores
    .filter((colaborador) => colaborador.ativo !== false && numeroSeguro(colaborador.salarioMensal) > 0)
    .map((colaborador) => {
      const diaPagamento = numeroSeguro(colaborador.diaPagamento) || 5;
      const data = dataPagamentoDoMes(competencia, diaPagamento);
      const id = `folha-colaborador-${colaborador.id}-${competencia}`;

      return {
        id,
        data,
        nome: colaborador.nome,
        funcao: normalizarFuncao(colaborador.funcao),
        tipoPagamento: "Salário fixo" as TipoPagamento,
        descricao: `Salário mensal automático de ${competencia.split("-").reverse().join("/")}`,
        status: data < hoje ? "Atrasado" as StatusPagamento : "Pendente" as StatusPagamento,
        valor: numeroSeguro(colaborador.salarioMensal),
        colaboradorId: colaborador.id,
        competencia,
        diaPagamento: Number(diaPagamento),
        origem: "Colaboradores",
      };
    })
    .filter((item) => !idsAtuais.has(item.id));

  return {
    todos: deduplicarPorId([...novosItens, ...itensAtuais]) as FolhaItem[],
    novos: novosItens,
  };
}

export default function FolhaDePagamentoPage() {
  const [itens, setItens] = useState<FolhaItem[]>([]);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [data, setData] = useState(hojeISO());
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState<FuncaoFuncionario>("Cozinha");
  const [tipoPagamento, setTipoPagamento] =
    useState<TipoPagamento>("Salário fixo");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<StatusPagamento>("Pendente");
  const [valor, setValor] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarFolha() {
      const itensLocais = lerArrayLocalStorage<FolhaItem>(STORAGE_KEY);

      if (ativo) {
        setItens(itensLocais);
      }

      try {
        const dados = await buscarFinanceiroSupabase();
        const itensSupabase = (dados.folhaPagamento || []) as FolhaItem[];
        const base = itensSupabase.length > 0
          ? (deduplicarPorId(itensSupabase) as FolhaItem[])
          : itensLocais;
        const { todos, novos } = gerarFolhaMensal((dados.colaboradores || []) as Colaborador[], base);

        if (!ativo) return;

        setItens(todos);
        salvarArrayLocalStorage(STORAGE_KEY, todos);

        if (novos.length > 0) {
          await salvarFinanceiroSupabase({ folhaPagamento: novos });
        }
      } catch (erro) {
        console.warn("Não foi possível carregar folha do Supabase.", erro);
      } finally {
        if (ativo) setDadosCarregados(true);
      }
    }

    carregarFolha();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!dadosCarregados) return;
    salvarArrayLocalStorage(STORAGE_KEY, itens);
  }, [itens, dadosCarregados]);

  const itensFiltrados = useMemo(
    () => itens.filter((item) => dataNoPeriodo(item.data, dataInicial, dataFinal)),
    [itens, dataInicial, dataFinal]
  );

  const resumo = useMemo(() => {
    const totalGeral = itensFiltrados.reduce((acc, item) => acc + item.valor, 0);

    const totalPago = itensFiltrados
      .filter((item) => item.status === "Pago")
      .reduce((acc, item) => acc + item.valor, 0);

    const totalPendente = itensFiltrados
      .filter((item) => item.status === "Pendente")
      .reduce((acc, item) => acc + item.valor, 0);

    const totalAtrasado = itensFiltrados
      .filter((item) => item.status === "Atrasado")
      .reduce((acc, item) => acc + item.valor, 0);

    return {
      totalGeral,
      totalPago,
      totalPendente,
      totalAtrasado,
      quantidade: itensFiltrados.length,
    };
  }, [itensFiltrados]);

  const resumoPorFuncao = useMemo(() => {
    return funcoes
      .map((funcaoAtual) => {
        const total = itensFiltrados
          .filter((item) => item.funcao === funcaoAtual)
          .reduce((acc, item) => acc + item.valor, 0);

        return {
          funcao: funcaoAtual,
          total,
        };
      })
      .filter((item) => item.total > 0);
  }, [itensFiltrados]);

  function limparFormulario() {
    setData(hojeISO());
    setNome("");
    setFuncao("Cozinha");
    setTipoPagamento("Salário fixo");
    setDescricao("");
    setStatus("Pendente");
    setValor("");
  }

  async function cadastrarPagamento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valor.replace(",", "."));

    if (!data || !nome.trim() || !valor || valorNumerico <= 0) {
      alert("Preencha data, nome e valor corretamente.");
      return;
    }

    const novoItem: FolhaItem = {
      id: criarId(),
      data,
      nome: nome.trim(),
      funcao,
      tipoPagamento,
      descricao: descricao.trim(),
      status,
      valor: valorNumerico,
      ...(status === "Pago" ? { dataPagamento: data, pagoEm: new Date().toISOString() } : {}),
    };

    setItens((listaAtual) => [novoItem, ...listaAtual]);

    try {
      await salvarFinanceiroSupabase({ folha: novoItem });
    } catch (erro) {
      console.warn("Folha salva localmente, mas não sincronizou com o Supabase.", erro);
      alert("Salvei no navegador, mas não consegui sincronizar com o Supabase agora.");
    }

    limparFormulario();
  }

  async function excluirItem(id: string) {
    const confirmar = confirm("Deseja realmente excluir este lançamento?");

    if (!confirmar) {
      return;
    }

    setItens((listaAtual) => listaAtual.filter((item) => item.id !== id));

    try {
      await removerLancamentoFinanceiroSupabase("folha", id);
    } catch (erro) {
      console.warn("Folha excluída localmente, mas não sincronizou com o Supabase.", erro);
      alert("Excluí no navegador, mas não consegui excluir do Supabase agora.");
    }
  }

  async function marcarComoPago(id: string) {
    const itemOriginal = itens.find((item) => item.id === id);

    if (!itemOriginal) return;

    const atualizado: FolhaItem = {
      ...itemOriginal,
      status: "Pago",
      dataPagamento: hojeISO(),
      pagoEm: new Date().toISOString(),
    };

    setItens((listaAtual) =>
      listaAtual.map((item) => (item.id === id ? atualizado : item))
    );

    try {
      await salvarFinanceiroSupabase({ folha: atualizado });
    } catch (erro) {
      console.warn("Pagamento da folha salvo localmente, mas não sincronizou com o Supabase.", erro);
      alert("Marquei como pago no navegador, mas não consegui sincronizar com o Supabase agora.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="folha-de-pagamento" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Controle financeiro
            </p>
            <h1 className="text-3xl font-bold text-slate-950">
              Folha de pagamento
            </h1>
            <p className="text-sm text-slate-600">
              Cadastre salários, diárias, freelancers, adiantamentos e outros
              pagamentos da equipe.
            </p>
          </div>

          <FinancePeriodFilter
            dataInicial={dataInicial}
            dataFinal={dataFinal}
            onDataInicialChange={setDataInicial}
            onDataFinalChange={setDataFinal}
            titulo="Filtros da folha de pagamento"
            descricao={`Os valores e lançamentos mostram o período ${descricaoPeriodo(dataInicial, dataFinal)}.`}
          />

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total lançado</p>
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
              <p className="text-sm text-slate-500">Atrasado</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {formatarMoeda(resumo.totalAtrasado)}
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
                Novo pagamento
              </h2>

              <form onSubmit={cadastrarPagamento} className="space-y-4">
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
                    Nome do funcionário/prestador
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Ex: João, Maria, entregador, freelancer..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Função
                  </label>
                  <select
                    value={funcao}
                    onChange={(event) =>
                      setFuncao(event.target.value as FuncaoFuncionario)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {funcoes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo de pagamento
                  </label>
                  <select
                    value={tipoPagamento}
                    onChange={(event) =>
                      setTipoPagamento(event.target.value as TipoPagamento)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {tiposPagamento.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as StatusPagamento)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {statusPagamento.map((item) => (
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
                    placeholder="Ex: 1500"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Observação
                  </label>
                  <textarea
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    placeholder="Ex: salário do mês, diária de sábado, adiantamento..."
                    rows={4}
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                >
                  Cadastrar pagamento
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Lançamentos da folha
                    </h2>
                    <p className="text-sm text-slate-500">
                      Pagamentos manuais e salários mensais dos colaboradores ficam salvos no Supabase.
                    </p>
                  </div>
                </div>

                {itensFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhum pagamento encontrado no período selecionado.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Use o formulário ao lado para lançar o primeiro pagamento.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3">Data</th>
                          <th className="px-3 py-3">Nome</th>
                          <th className="px-3 py-3">Função</th>
                          <th className="px-3 py-3">Tipo</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Valor</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {itensFiltrados.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 text-sm"
                          >
                            <td className="px-3 py-4 text-slate-700">
                              {item.data.split("-").reverse().join("/")}
                            </td>

                            <td className="px-3 py-4">
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {item.nome}
                                </p>
                                {item.descricao && (
                                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                                    {item.descricao}
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.funcao}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.tipoPagamento}
                            </td>

                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  item.status === "Pago"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.status === "Atrasado"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-orange-100 text-orange-700"
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
                                  onClick={() => excluirItem(item.id)}
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
                  Resumo por função
                </h2>

                {resumoPorFuncao.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum resumo disponível ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {resumoPorFuncao.map((item) => (
                      <div
                        key={item.funcao}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-slate-700">
                          {item.funcao}
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