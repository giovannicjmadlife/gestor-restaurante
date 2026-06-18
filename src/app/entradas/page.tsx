"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { useEffect, useMemo, useState } from "react";
import {
  buscarFinanceiroSupabase,
  deduplicarPorId,
  removerLancamentoFinanceiroSupabase,
  salvarFinanceiroSupabase,
} from "@/lib/financeiroSupabase";

type TipoTaxa = "Percentual" | "Valor fixo";

type TaxaCadastro = {
  id: string;
  nome: string;
  tipo: TipoTaxa;
  valor: number;
  ativo: boolean;
};

type TipoTaxaAplicada = "Sem taxa" | "Maquininha" | "Delivery";

type Entrada = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  formaRecebimento: string;
  valor: number;
  valorBruto?: number;
  valorTaxa?: number;
  tipoTaxaAplicada?: TipoTaxaAplicada;
  taxaNome?: string;
  taxaTipo?: TipoTaxa;
  taxaPercentualOuValor?: number;
};

type EntradaExcluida = {
  id: string;
  dataExclusao: string;
  justificativa: string;
  entrada: Entrada;
};

const ENTRADAS_KEY = "gestor-restaurante-entradas";
const ENTRADAS_EXCLUIDAS_KEY = "gestor-restaurante-entradas-excluidas";
const TAXAS_MAQUININHA_KEY = "gestor-restaurante-taxas-maquininhas";
const TAXAS_DELIVERY_KEY = "gestor-restaurante-taxas-delivery";

const categorias = [
  "Almoço",
  "Janta",
  "Jantinha",
  "Pizzas",
  "Marmitex",
  "Sorvetes",
  "Sanduíches",
  "Porções",
  "Bebidas",
  "Delivery",
  "Balcão",
  "Outros",
];

const formasRecebimento = [
  "Dinheiro",
  "Pix",
  "Cartão débito",
  "Cartão crédito",
  "Voucher",
  "Misto",
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

function formatarData(data: string) {
  if (!data) {
    return "-";
  }

  return data.split("-").reverse().join("/");
}

function formatarDataHoraISO(dataISO: string) {
  if (!dataISO) {
    return "-";
  }

  const data = new Date(dataISO);

  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function lerListaStorage<T>(chave: string): T[] {
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

function calcularValorTaxa(valorBruto: number, taxa?: TaxaCadastro) {
  if (!taxa) {
    return 0;
  }

  if (taxa.tipo === "Percentual") {
    return (valorBruto * taxa.valor) / 100;
  }

  return taxa.valor;
}


function normalizarTaxas(dados: unknown): TaxaCadastro[] {
  if (!Array.isArray(dados)) return [];

  return dados
    .map((item: Record<string, any>) => ({
      id: String(item.id || item.nome || criarId()),
      nome: String(item.nome || "Taxa sem nome"),
      tipo: (item.tipo === "Valor fixo" ? "Valor fixo" : "Percentual") as TipoTaxa,
      valor: Number(String(item.valor ?? 0).replace(",", ".")) || 0,
      ativo: item.ativo !== false,
    }))
    .filter((item) => item.ativo && item.valor >= 0);
}

export default function EntradasPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [entradasExcluidas, setEntradasExcluidas] = useState<EntradaExcluida[]>(
    []
  );
  const [taxasMaquininhas, setTaxasMaquininhas] = useState<TaxaCadastro[]>([]);
  const [taxasDelivery, setTaxasDelivery] = useState<TaxaCadastro[]>([]);

  const [data, setData] = useState(hojeISO());
  const [categoria, setCategoria] = useState("Almoço");
  const [descricao, setDescricao] = useState("");
  const [formaRecebimento, setFormaRecebimento] = useState("Dinheiro");
  const [valor, setValor] = useState("");

  const [tipoTaxaAplicada, setTipoTaxaAplicada] =
    useState<TipoTaxaAplicada>("Sem taxa");
  const [taxaSelecionadaId, setTaxaSelecionadaId] = useState("");

  useEffect(() => {
    let ativo = true;

    const entradasLocais = lerListaStorage<Entrada>(ENTRADAS_KEY);
    const taxasMaquininhasLocais = lerListaStorage<TaxaCadastro>(TAXAS_MAQUININHA_KEY).filter(
      (taxa) => taxa.ativo
    );
    const taxasDeliveryLocais = lerListaStorage<TaxaCadastro>(TAXAS_DELIVERY_KEY).filter(
      (taxa) => taxa.ativo
    );

    setEntradas(entradasLocais);
    setEntradasExcluidas(
      lerListaStorage<EntradaExcluida>(ENTRADAS_EXCLUIDAS_KEY)
    );
    setTaxasMaquininhas(taxasMaquininhasLocais);
    setTaxasDelivery(taxasDeliveryLocais);

    async function carregarSupabase() {
      try {
        const dados = await buscarFinanceiroSupabase();
        const entradasSupabase = (dados.entradas || []) as Entrada[];

        if (!ativo || entradasSupabase.length === 0) return;

        const listaFinal = deduplicarPorId(entradasSupabase) as Entrada[];
        setEntradas(listaFinal);
        localStorage.setItem(ENTRADAS_KEY, JSON.stringify(listaFinal));
      } catch (erro) {
        console.warn("Não foi possível carregar entradas do Supabase.", erro);
      }
    }

    async function carregarTaxas() {
      try {
        const resposta = await fetch("/api/taxas", { cache: "no-store" });
        if (!resposta.ok) throw new Error(await resposta.text());

        const dados = await resposta.json();
        const maquininhasApi = normalizarTaxas(dados.maquininhas);
        const deliveryApi = normalizarTaxas(dados.delivery);

        if (!ativo) return;

        if (maquininhasApi.length > 0) {
          setTaxasMaquininhas(maquininhasApi);
          localStorage.setItem(TAXAS_MAQUININHA_KEY, JSON.stringify(maquininhasApi));
        }

        if (deliveryApi.length > 0) {
          setTaxasDelivery(deliveryApi);
          localStorage.setItem(TAXAS_DELIVERY_KEY, JSON.stringify(deliveryApi));
        }
      } catch (erro) {
        console.warn("Não foi possível carregar taxas do Supabase.", erro);
      }
    }

    carregarSupabase();
    carregarTaxas();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ENTRADAS_KEY, JSON.stringify(entradas));
  }, [entradas]);

  useEffect(() => {
    localStorage.setItem(
      ENTRADAS_EXCLUIDAS_KEY,
      JSON.stringify(entradasExcluidas)
    );
  }, [entradasExcluidas]);

  const taxasDisponiveis = useMemo(() => {
    if (tipoTaxaAplicada === "Maquininha") {
      return taxasMaquininhas;
    }

    if (tipoTaxaAplicada === "Delivery") {
      return taxasDelivery;
    }

    return [];
  }, [tipoTaxaAplicada, taxasMaquininhas, taxasDelivery]);

  const taxaSelecionada = useMemo(() => {
    return taxasDisponiveis.find((taxa) => taxa.id === taxaSelecionadaId);
  }, [taxasDisponiveis, taxaSelecionadaId]);

  const simulacao = useMemo(() => {
    const valorBruto = Number(valor.replace(",", "."));

    if (!valor || valorBruto <= 0) {
      return {
        valorBruto: 0,
        valorTaxa: 0,
        valorLiquido: 0,
      };
    }

    const valorTaxa = calcularValorTaxa(valorBruto, taxaSelecionada);
    const valorLiquido = Math.max(valorBruto - valorTaxa, 0);

    return {
      valorBruto,
      valorTaxa,
      valorLiquido,
    };
  }, [valor, taxaSelecionada]);

  const resumo = useMemo(() => {
    const totalLiquido = entradas.reduce((acc, item) => acc + item.valor, 0);

    const totalBruto = entradas.reduce(
      (acc, item) => acc + (item.valorBruto ?? item.valor),
      0
    );

    const totalTaxas = entradas.reduce(
      (acc, item) => acc + (item.valorTaxa ?? 0),
      0
    );

    const entradasHoje = entradas
      .filter((item) => item.data === hojeISO())
      .reduce((acc, item) => acc + item.valor, 0);

    const totalExcluido = entradasExcluidas.reduce(
      (acc, item) => acc + (item.entrada.valorBruto ?? item.entrada.valor),
      0
    );

    return {
      totalLiquido,
      totalBruto,
      totalTaxas,
      entradasHoje,
      quantidade: entradas.length,
      exclusoes: entradasExcluidas.length,
      totalExcluido,
    };
  }, [entradas, entradasExcluidas]);

  const resumoPorCategoria = useMemo(() => {
    return categorias
      .map((categoriaAtual) => {
        const total = entradas
          .filter((item) => item.categoria === categoriaAtual)
          .reduce((acc, item) => acc + item.valor, 0);

        return {
          categoria: categoriaAtual,
          total,
        };
      })
      .filter((item) => item.total > 0);
  }, [entradas]);

  function limparFormulario() {
    setData(hojeISO());
    setCategoria("Almoço");
    setDescricao("");
    setFormaRecebimento("Dinheiro");
    setValor("");
    setTipoTaxaAplicada("Sem taxa");
    setTaxaSelecionadaId("");
  }

  async function cadastrarEntrada(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorBruto = Number(valor.replace(",", "."));

    if (!data || !categoria || !formaRecebimento || !valor || valorBruto <= 0) {
      alert("Preencha data, categoria, forma de recebimento e valor corretamente.");
      return;
    }

    if (tipoTaxaAplicada !== "Sem taxa" && !taxaSelecionada) {
      alert("Selecione uma taxa cadastrada ou escolha a opção Sem taxa.");
      return;
    }

    const valorTaxa = calcularValorTaxa(valorBruto, taxaSelecionada);
    const valorLiquido = Math.max(valorBruto - valorTaxa, 0);
    const agora = new Date().toISOString();

    const novaEntrada: Entrada = {
      id: criarId(),
      data,
      categoria,
      descricao: descricao.trim(),
      formaRecebimento,
      valor: valorLiquido,
      valorBruto,
      valorTaxa,
      taxaDescontada: valorTaxa,
      valorLiquido,
      valorCobrado: valorBruto,
      tipoTaxaAplicada,
      taxaNome: taxaSelecionada?.nome ?? "Sem taxa",
      taxaTipo: taxaSelecionada?.tipo,
      taxaPercentualOuValor: taxaSelecionada?.valor,
      status: "Recebido",
      origem: "Entrada manual",
      criadoEm: agora,
      recebidoEm: agora,
    } as Entrada;

    setEntradas((listaAtual) => [novaEntrada, ...listaAtual]);

    try {
      await salvarFinanceiroSupabase({ entrada: novaEntrada });
    } catch (erro) {
      console.warn("Entrada salva localmente, mas não sincronizou com o Supabase.", erro);
      alert("Salvei no navegador, mas não consegui sincronizar com o Supabase agora.");
    }

    limparFormulario();
  }

  async function excluirEntrada(id: string) {
    const entradaEncontrada = entradas.find((item) => item.id === id);

    if (!entradaEncontrada) {
      alert("Entrada não encontrada.");
      return;
    }

    const justificativa = prompt(
      "Para excluir esta entrada, informe a justificativa obrigatória:"
    );

    if (!justificativa || justificativa.trim().length < 5) {
      alert(
        "Exclusão cancelada. Informe uma justificativa com pelo menos 5 caracteres."
      );
      return;
    }

    const confirmar = confirm(
      "Tem certeza que deseja excluir esta entrada? A justificativa ficará registrada no histórico de auditoria."
    );

    if (!confirmar) {
      return;
    }

    const exclusaoRegistrada: EntradaExcluida = {
      id: criarId(),
      dataExclusao: new Date().toISOString(),
      justificativa: justificativa.trim(),
      entrada: entradaEncontrada,
    };

    setEntradasExcluidas((listaAtual) => [exclusaoRegistrada, ...listaAtual]);
    setEntradas((listaAtual) => listaAtual.filter((item) => item.id !== id));

    try {
      await removerLancamentoFinanceiroSupabase("entrada", id);
    } catch (erro) {
      console.warn("Entrada excluída localmente, mas não sincronizou com o Supabase.", erro);
      alert("Excluí no navegador, mas não consegui excluir do Supabase agora.");
      return;
    }

    alert("Entrada excluída com justificativa registrada.");
  }

  function alterarTipoTaxa(novoTipo: TipoTaxaAplicada) {
    setTipoTaxaAplicada(novoTipo);
    setTaxaSelecionadaId("");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="entradas" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Controle financeiro
            </p>

            <h1 className="text-3xl font-bold text-slate-950">Entradas</h1>

            <p className="text-sm text-slate-600">
              Cadastre vendas e recebimentos com cálculo de taxa, valor líquido
              real e auditoria de exclusões.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Valor bruto</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {formatarMoeda(resumo.totalBruto)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Taxas descontadas</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {formatarMoeda(resumo.totalTaxas)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Valor líquido real</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(resumo.totalLiquido)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Entradas de hoje</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {formatarMoeda(resumo.entradasHoje)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Lançamentos</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumo.quantidade}
              </strong>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm text-red-700">Exclusões registradas</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {resumo.exclusoes}
              </strong>
              <p className="mt-2 text-xs text-red-600">
                {formatarMoeda(resumo.totalExcluido)} em histórico
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-5 text-xl font-bold text-slate-950">
                Nova entrada
              </h2>

              <form onSubmit={cadastrarEntrada} className="space-y-4">
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
                    onChange={(event) => setCategoria(event.target.value)}
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
                    placeholder="Ex: almoço, marmitex, pizza, balcão..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Forma de recebimento
                  </label>
                  <select
                    value={formaRecebimento}
                    onChange={(event) => setFormaRecebimento(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {formasRecebimento.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Valor bruto da venda
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valor}
                    onChange={(event) => setValor(event.target.value)}
                    placeholder="Ex: 100"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Aplicar taxa?
                  </label>
                  <select
                    value={tipoTaxaAplicada}
                    onChange={(event) =>
                      alterarTipoTaxa(event.target.value as TipoTaxaAplicada)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    <option value="Sem taxa">Sem taxa</option>
                    <option value="Maquininha">Taxa de maquininha</option>
                    <option value="Delivery">Taxa de delivery</option>
                  </select>
                </div>

                {tipoTaxaAplicada !== "Sem taxa" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Taxa cadastrada
                    </label>
                    <select
                      value={taxaSelecionadaId}
                      onChange={(event) =>
                        setTaxaSelecionadaId(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="">Selecione uma taxa</option>
                      {taxasDisponiveis.map((taxa) => (
                        <option key={taxa.id} value={taxa.id}>
                          {taxa.nome} -{" "}
                          {taxa.tipo === "Percentual"
                            ? `${taxa.valor}%`
                            : formatarMoeda(taxa.valor)}
                        </option>
                      ))}
                    </select>

                    {taxasDisponiveis.length === 0 && (
                      <p className="mt-2 text-xs text-red-600">
                        Nenhuma taxa ativa encontrada. Cadastre em Configurações.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-950">
                    Resumo do recebimento
                  </h3>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">Valor bruto</span>
                      <strong className="text-slate-950">
                        {formatarMoeda(simulacao.valorBruto)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">Taxa descontada</span>
                      <strong className="text-red-600">
                        {formatarMoeda(simulacao.valorTaxa)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                      <span className="font-bold text-slate-700">
                        Valor líquido real
                      </span>
                      <strong className="text-emerald-700">
                        {formatarMoeda(simulacao.valorLiquido)}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                >
                  Cadastrar entrada
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-950">
                    Lista de entradas
                  </h2>
                  <p className="text-sm text-slate-500">
                    Para excluir, é obrigatório registrar uma justificativa.
                  </p>
                </div>

                {entradas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhuma entrada cadastrada ainda.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Use o formulário ao lado para lançar a primeira entrada.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3">Data</th>
                          <th className="px-3 py-3">Descrição</th>
                          <th className="px-3 py-3">Categoria</th>
                          <th className="px-3 py-3">Forma</th>
                          <th className="px-3 py-3">Taxa</th>
                          <th className="px-3 py-3 text-right">Bruto</th>
                          <th className="px-3 py-3 text-right">Desconto</th>
                          <th className="px-3 py-3 text-right">Líquido</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {entradas.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 text-sm"
                          >
                            <td className="px-3 py-4 text-slate-700">
                              {formatarData(item.data)}
                            </td>

                            <td className="px-3 py-4 font-semibold text-slate-950">
                              {item.descricao || "-"}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.categoria}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.formaRecebimento}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.taxaNome || "Sem taxa"}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-slate-950">
                              {formatarMoeda(item.valorBruto ?? item.valor)}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-red-600">
                              {formatarMoeda(item.valorTaxa ?? 0)}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-emerald-700">
                              {formatarMoeda(item.valor)}
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => excluirEntrada(item.id)}
                                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                                >
                                  Excluir com justificativa
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

                        <strong className="text-sm text-emerald-700">
                          {formatarMoeda(item.total)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-red-200 bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-red-700">
                    Auditoria de entradas excluídas
                  </h2>
                  <p className="text-sm text-slate-500">
                    Toda exclusão fica registrada com data, valor, entrada e justificativa.
                  </p>
                </div>

                {entradasExcluidas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-8 text-center">
                    <p className="font-medium text-red-700">
                      Nenhuma entrada excluída.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] border-collapse">
                      <thead>
                        <tr className="border-b border-red-100 text-left text-xs uppercase tracking-wide text-red-500">
                          <th className="px-3 py-3">Excluída em</th>
                          <th className="px-3 py-3">Data venda</th>
                          <th className="px-3 py-3">Descrição</th>
                          <th className="px-3 py-3">Forma</th>
                          <th className="px-3 py-3 text-right">Bruto</th>
                          <th className="px-3 py-3 text-right">Líquido</th>
                          <th className="px-3 py-3">Justificativa</th>
                        </tr>
                      </thead>

                      <tbody>
                        {entradasExcluidas.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-red-50 text-sm"
                          >
                            <td className="px-3 py-4 text-slate-700">
                              {formatarDataHoraISO(item.dataExclusao)}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {formatarData(item.entrada.data)}
                            </td>

                            <td className="px-3 py-4 font-semibold text-slate-950">
                              {item.entrada.descricao || "-"}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.entrada.formaRecebimento}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-slate-950">
                              {formatarMoeda(
                                item.entrada.valorBruto ?? item.entrada.valor
                              )}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-emerald-700">
                              {formatarMoeda(item.entrada.valor)}
                            </td>

                            <td className="px-3 py-4 text-red-700">
                              {item.justificativa}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
