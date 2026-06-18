"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { useEffect, useMemo, useState } from "react";

type CategoriaProduto = "Almoço" | "Janta" | "Bebida" | "Outros";

type GrupoProduto =
  | "Por quilo"
  | "Marmitex"
  | "Mistura"
  | "Almoço à vontade"
  | "Jantinha"
  | "Pizza"
  | "Sanduíche"
  | "Porção"
  | "Prato fixo"
  | "Bebida"
  | "Sobremesa"
  | "Outros";

type TipoPreco = "Preço fixo" | "Por quilo";

type Produto = {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  grupo: GrupoProduto;
  tipoPreco: TipoPreco;
  valor: number;
  controlarEstoque: boolean;
  estoque: number;
  ativo: boolean;
};

type TipoTaxa = "Percentual" | "Valor fixo";

type TaxaCadastro = {
  id: string;
  nome: string;
  tipo: TipoTaxa;
  valor: number;
  ativo: boolean;
};

type TaxaEntrega = {
  valor: number;
  ativo: boolean;
};

type TipoTaxaAplicada = "Sem taxa" | "Maquininha" | "Delivery";

type ItemVenda = {
  id: string;
  produtoId: string;
  nome: string;
  categoria: CategoriaProduto;
  grupo: GrupoProduto;
  tipoPreco: TipoPreco;
  quantidade: number;
  pesoKg: number;
  valorUnitario: number;
  subtotal: number;
  controlaEstoque: boolean;
};

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

type VendaDetalhada = {
  id: string;
  data: string;
  hora: string;
  categoriaVenda: "Almoço" | "Janta";
  periodo: "Almoço" | "Janta";
  formaRecebimento: string;
  cliente: string;
  observacao: string;
  itens: ItemVenda[];
  taxaEntrega: number;
  taxaPagamento: number;
  taxaPagamentoNome: string;
  valorBruto: number;
  valorLiquido: number;
  valorRecebido: number;
  troco: number;
};

const PRODUTOS_KEY = "gestor-restaurante-produtos";
const ENTRADAS_KEY = "gestor-restaurante-entradas";
const VENDAS_DETALHADAS_KEY = "gestor-restaurante-vendas-detalhadas";
const TAXAS_MAQUININHA_KEY = "gestor-restaurante-taxas-maquininhas";
const TAXAS_DELIVERY_KEY = "gestor-restaurante-taxas-delivery";
const TAXA_ENTREGA_KEY = "gestor-restaurante-taxa-entrega";

const formasRecebimento = [
  "Dinheiro",
  "Pix",
  "Cartão débito",
  "Cartão crédito",
  "Voucher",
  "Misto",
];

const gruposFiltro: Array<GrupoProduto | "Todos"> = [
  "Todos",
  "Por quilo",
  "Marmitex",
  "Mistura",
  "Almoço à vontade",
  "Jantinha",
  "Pizza",
  "Sanduíche",
  "Porção",
  "Prato fixo",
  "Bebida",
  "Sobremesa",
  "Outros",
];

const taxaEntregaPadrao: TaxaEntrega = {
  valor: 3,
  ativo: true,
};

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
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

function lerProdutosStorage(): Produto[] {
  if (typeof window === "undefined") {
    return [];
  }

  const dados = localStorage.getItem(PRODUTOS_KEY);

  if (!dados) {
    return [];
  }

  try {
    const produtosAntigos = JSON.parse(dados) as Array<
      Produto & {
        disponibilidade?: string;
      }
    >;

    return produtosAntigos.map((produto) => {
      const categoriaCorrigida: CategoriaProduto =
        produto.categoria === "Bebida"
          ? "Bebida"
          : produto.categoria === "Janta"
          ? "Janta"
          : produto.categoria === "Almoço"
          ? "Almoço"
          : "Outros";

      return {
        id: produto.id,
        nome: produto.nome,
        categoria: categoriaCorrigida,
        grupo: produto.grupo || "Outros",
        tipoPreco: produto.tipoPreco || "Preço fixo",
        valor: Number(produto.valor || 0),
        controlarEstoque: Boolean(produto.controlarEstoque),
        estoque: Number(produto.estoque || 0),
        ativo: produto.ativo !== false,
      };
    });
  } catch {
    return [];
  }
}

function lerTaxaEntregaStorage() {
  if (typeof window === "undefined") {
    return taxaEntregaPadrao;
  }

  const dados = localStorage.getItem(TAXA_ENTREGA_KEY);

  if (!dados) {
    return taxaEntregaPadrao;
  }

  try {
    const dadosConvertidos = JSON.parse(dados) as TaxaEntrega;

    return {
      ...taxaEntregaPadrao,
      ...dadosConvertidos,
    };
  } catch {
    return taxaEntregaPadrao;
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

export default function VendaRapidaPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [vendasDetalhadas, setVendasDetalhadas] = useState<VendaDetalhada[]>(
    []
  );

  const [taxasMaquininhas, setTaxasMaquininhas] = useState<TaxaCadastro[]>([]);
  const [taxasDelivery, setTaxasDelivery] = useState<TaxaCadastro[]>([]);
  const [taxaEntrega, setTaxaEntrega] =
    useState<TaxaEntrega>(taxaEntregaPadrao);

  const [categoriaVenda, setCategoriaVenda] = useState<"Almoço" | "Janta">(
    "Almoço"
  );
  const [busca, setBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState<GrupoProduto | "Todos">(
    "Todos"
  );

  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [pesoKg, setPesoKg] = useState("");

  const [itensVenda, setItensVenda] = useState<ItemVenda[]>([]);

  const [cliente, setCliente] = useState("");
  const [observacao, setObservacao] = useState("");
  const [formaRecebimento, setFormaRecebimento] = useState("Dinheiro");
  const [aplicarEntrega, setAplicarEntrega] = useState(false);

  const [valorRecebido, setValorRecebido] = useState("");

  const [tipoTaxaAplicada, setTipoTaxaAplicada] =
    useState<TipoTaxaAplicada>("Sem taxa");
  const [taxaSelecionadaId, setTaxaSelecionadaId] = useState("");

  useEffect(() => {
    setProdutos(lerProdutosStorage());
    setEntradas(lerListaStorage<Entrada>(ENTRADAS_KEY));
    setVendasDetalhadas(
      lerListaStorage<VendaDetalhada>(VENDAS_DETALHADAS_KEY)
    );
    setTaxaEntrega(lerTaxaEntregaStorage());

    setTaxasMaquininhas(
      lerListaStorage<TaxaCadastro>(TAXAS_MAQUININHA_KEY).filter(
        (taxa) => taxa.ativo
      )
    );

    setTaxasDelivery(
      lerListaStorage<TaxaCadastro>(TAXAS_DELIVERY_KEY).filter(
        (taxa) => taxa.ativo
      )
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(PRODUTOS_KEY, JSON.stringify(produtos));
  }, [produtos]);

  useEffect(() => {
    localStorage.setItem(ENTRADAS_KEY, JSON.stringify(entradas));
  }, [entradas]);

  useEffect(() => {
    localStorage.setItem(
      VENDAS_DETALHADAS_KEY,
      JSON.stringify(vendasDetalhadas)
    );
  }, [vendasDetalhadas]);

  const produtosAtivos = useMemo(() => {
    return produtos.filter((produto) => produto.ativo);
  }, [produtos]);

  const produtosDisponiveis = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();

    return produtosAtivos.filter((produto) => {
      const pertenceCategoria =
        produto.categoria === categoriaVenda || produto.categoria === "Bebida";

      const passaGrupo =
        grupoFiltro === "Todos" || produto.grupo === grupoFiltro;

      const passaBusca =
        textoBusca.length === 0 ||
        produto.nome.toLowerCase().includes(textoBusca) ||
        produto.grupo.toLowerCase().includes(textoBusca) ||
        produto.categoria.toLowerCase().includes(textoBusca);

      const temEstoque = !produto.controlarEstoque || produto.estoque > 0;

      return pertenceCategoria && passaGrupo && passaBusca && temEstoque;
    });
  }, [produtosAtivos, categoriaVenda, grupoFiltro, busca]);

  const produtoSelecionado = useMemo(() => {
    return produtos.find((produto) => produto.id === produtoSelecionadoId);
  }, [produtos, produtoSelecionadoId]);

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

  const valorItens = useMemo(() => {
    return itensVenda.reduce((acc, item) => acc + item.subtotal, 0);
  }, [itensVenda]);

  const valorEntrega = useMemo(() => {
    if (!aplicarEntrega || !taxaEntrega.ativo) {
      return 0;
    }

    return taxaEntrega.valor;
  }, [aplicarEntrega, taxaEntrega]);

  const valorBruto = useMemo(() => {
    return valorItens + valorEntrega;
  }, [valorItens, valorEntrega]);

  const valorTaxaPagamento = useMemo(() => {
    return calcularValorTaxa(valorBruto, taxaSelecionada);
  }, [valorBruto, taxaSelecionada]);

  const valorLiquido = useMemo(() => {
    return Math.max(valorBruto - valorTaxaPagamento, 0);
  }, [valorBruto, valorTaxaPagamento]);

  const valorRecebidoNumerico = useMemo(() => {
    return Number(valorRecebido.replace(",", "."));
  }, [valorRecebido]);

  const troco = useMemo(() => {
    if (formaRecebimento !== "Dinheiro") {
      return 0;
    }

    if (!valorRecebido || valorRecebidoNumerico <= 0) {
      return 0;
    }

    return Math.max(valorRecebidoNumerico - valorBruto, 0);
  }, [formaRecebimento, valorRecebido, valorRecebidoNumerico, valorBruto]);

  const resumoEstoque = useMemo(() => {
    const bebidas = produtos.filter((produto) => produto.categoria === "Bebida");

    return {
      bebidasTotal: bebidas.length,
      bebidasComEstoque: bebidas.filter(
        (produto) => produto.controlarEstoque && produto.estoque > 0
      ).length,
      bebidasSemEstoque: bebidas.filter(
        (produto) => produto.controlarEstoque && produto.estoque <= 0
      ).length,
    };
  }, [produtos]);

  function limparSelecaoProduto() {
    setProdutoSelecionadoId("");
    setQuantidade("1");
    setPesoKg("");
  }

  function alterarCategoriaVenda(novaCategoria: "Almoço" | "Janta") {
    if (itensVenda.length > 0) {
      const confirmar = confirm(
        "Ao trocar entre Almoço e Janta, a venda atual será limpa. Deseja continuar?"
      );

      if (!confirmar) {
        return;
      }

      setItensVenda([]);
      setAplicarEntrega(false);
      setValorRecebido("");
      setTipoTaxaAplicada("Sem taxa");
      setTaxaSelecionadaId("");
    }

    setCategoriaVenda(novaCategoria);
    setGrupoFiltro("Todos");
    setBusca("");
    limparSelecaoProduto();
  }

  function adicionarProdutoSelecionado() {
    if (!produtoSelecionado) {
      alert("Selecione um produto.");
      return;
    }

    const quantidadeNumerica = Number(quantidade.replace(",", "."));
    const pesoNumerico = Number(pesoKg.replace(",", "."));

    if (produtoSelecionado.tipoPreco === "Por quilo") {
      if (!pesoKg || pesoNumerico <= 0) {
        alert("Informe o peso em quilos corretamente.");
        return;
      }
    }

    if (produtoSelecionado.tipoPreco === "Preço fixo") {
      if (!quantidade || quantidadeNumerica <= 0) {
        alert("Informe a quantidade corretamente.");
        return;
      }
    }

    if (
      produtoSelecionado.controlarEstoque &&
      quantidadeNumerica > produtoSelecionado.estoque
    ) {
      alert(
        `Estoque insuficiente. Estoque atual: ${produtoSelecionado.estoque}`
      );
      return;
    }

    const quantidadeFinal =
      produtoSelecionado.tipoPreco === "Por quilo" ? 1 : quantidadeNumerica;

    const pesoFinal =
      produtoSelecionado.tipoPreco === "Por quilo" ? pesoNumerico : 0;

    const subtotal =
      produtoSelecionado.tipoPreco === "Por quilo"
        ? pesoFinal * produtoSelecionado.valor
        : quantidadeFinal * produtoSelecionado.valor;

    const novoItem: ItemVenda = {
      id: criarId(),
      produtoId: produtoSelecionado.id,
      nome: produtoSelecionado.nome,
      categoria: produtoSelecionado.categoria,
      grupo: produtoSelecionado.grupo,
      tipoPreco: produtoSelecionado.tipoPreco,
      quantidade: quantidadeFinal,
      pesoKg: pesoFinal,
      valorUnitario: produtoSelecionado.valor,
      subtotal,
      controlaEstoque: produtoSelecionado.controlarEstoque,
    };

    setItensVenda((listaAtual) => [...listaAtual, novoItem]);

    if (produtoSelecionado.grupo === "Marmitex" && taxaEntrega.ativo) {
      setAplicarEntrega(true);
    }

    limparSelecaoProduto();
  }

  function adicionarProdutoDireto(produto: Produto) {
    if (produto.tipoPreco === "Por quilo") {
      setProdutoSelecionadoId(produto.id);
      alert("Este item é por quilo. Informe o peso no formulário da esquerda.");
      return;
    }

    if (produto.controlarEstoque && produto.estoque <= 0) {
      alert("Este produto está sem estoque.");
      return;
    }

    const novoItem: ItemVenda = {
      id: criarId(),
      produtoId: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      grupo: produto.grupo,
      tipoPreco: produto.tipoPreco,
      quantidade: 1,
      pesoKg: 0,
      valorUnitario: produto.valor,
      subtotal: produto.valor,
      controlaEstoque: produto.controlarEstoque,
    };

    setItensVenda((listaAtual) => [...listaAtual, novoItem]);

    if (produto.grupo === "Marmitex" && taxaEntrega.ativo) {
      setAplicarEntrega(true);
    }
  }

  function removerItemVenda(id: string) {
    setItensVenda((listaAtual) => listaAtual.filter((item) => item.id !== id));
  }

  function alterarTipoTaxa(novoTipo: TipoTaxaAplicada) {
    setTipoTaxaAplicada(novoTipo);
    setTaxaSelecionadaId("");
  }

  function limparVenda() {
    setCategoriaVenda("Almoço");
    setBusca("");
    setGrupoFiltro("Todos");
    limparSelecaoProduto();
    setItensVenda([]);
    setCliente("");
    setObservacao("");
    setFormaRecebimento("Dinheiro");
    setValorRecebido("");
    setAplicarEntrega(false);
    setTipoTaxaAplicada("Sem taxa");
    setTaxaSelecionadaId("");
  }

  function finalizarVenda() {
    if (itensVenda.length === 0) {
      alert("Adicione pelo menos um item à venda.");
      return;
    }

    if (tipoTaxaAplicada !== "Sem taxa" && !taxaSelecionada) {
      alert("Selecione uma taxa cadastrada ou escolha Sem taxa.");
      return;
    }

    if (
      formaRecebimento === "Dinheiro" &&
      valorRecebido &&
      valorRecebidoNumerico < valorBruto
    ) {
      alert("O valor recebido em dinheiro é menor que o total a cobrar.");
      return;
    }

    for (const item of itensVenda) {
      const produtoAtual = produtos.find(
        (produto) => produto.id === item.produtoId
      );

      if (
        produtoAtual?.controlarEstoque &&
        item.quantidade > produtoAtual.estoque
      ) {
        alert(
          `Estoque insuficiente para ${item.nome}. Estoque atual: ${produtoAtual.estoque}`
        );
        return;
      }
    }

    const descricaoVenda = itensVenda
      .map((item) => {
        if (item.tipoPreco === "Por quilo") {
          return `${item.nome} (${item.pesoKg.toLocaleString("pt-BR", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          })} kg)`;
        }

        return `${item.quantidade}x ${item.nome}`;
      })
      .join(", ");

    const entrada: Entrada = {
      id: criarId(),
      data: hojeISO(),
      categoria: categoriaVenda,
      descricao: descricaoVenda,
      formaRecebimento,
      valor: valorLiquido,
      valorBruto,
      valorTaxa: valorTaxaPagamento,
      tipoTaxaAplicada,
      taxaNome: taxaSelecionada?.nome ?? "Sem taxa",
      taxaTipo: taxaSelecionada?.tipo,
      taxaPercentualOuValor: taxaSelecionada?.valor,
    };

    const vendaDetalhada: VendaDetalhada = {
      id: entrada.id,
      data: hojeISO(),
      hora: horaAtual(),
      categoriaVenda,
      periodo: categoriaVenda,
      formaRecebimento,
      cliente: cliente.trim(),
      observacao: observacao.trim(),
      itens: itensVenda,
      taxaEntrega: valorEntrega,
      taxaPagamento: valorTaxaPagamento,
      taxaPagamentoNome: taxaSelecionada?.nome ?? "Sem taxa",
      valorBruto,
      valorLiquido,
      valorRecebido:
        formaRecebimento === "Dinheiro" && valorRecebido
          ? valorRecebidoNumerico
          : valorBruto,
      troco,
    };

    setProdutos((listaAtual) =>
      listaAtual.map((produto) => {
        const quantidadeVendida = itensVenda
          .filter((item) => item.produtoId === produto.id)
          .reduce((acc, item) => acc + item.quantidade, 0);

        if (!produto.controlarEstoque || quantidadeVendida <= 0) {
          return produto;
        }

        return {
          ...produto,
          estoque: Math.max(produto.estoque - quantidadeVendida, 0),
        };
      })
    );

    setEntradas((listaAtual) => [entrada, ...listaAtual]);
    setVendasDetalhadas((listaAtual) => [vendaDetalhada, ...listaAtual]);

    alert("Venda finalizada e lançada em Entradas.");
    limparVenda();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="dashboard" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              PDV simples
            </p>

            <h1 className="text-3xl font-bold text-slate-950">
              Venda rápida
            </h1>

            <p className="text-sm text-slate-600">
              Escolha Almoço ou Janta. O sistema mostra os itens cadastrados
              nessa categoria e também as bebidas.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Itens na venda</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {itensVenda.length}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Itens</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {formatarMoeda(valorItens)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Entrega</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(valorEntrega)}
              </strong>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-sm font-bold text-orange-800">
                Total a cobrar
              </p>
              <strong className="mt-2 block text-3xl text-orange-700">
                {formatarMoeda(valorBruto)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Valor real após taxas</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {formatarMoeda(valorLiquido)}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr_420px]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Categoria da venda
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => alterarCategoriaVenda("Almoço")}
                    className={`rounded-xl px-4 py-4 text-sm font-bold ${
                      categoriaVenda === "Almoço"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Almoço
                  </button>

                  <button
                    type="button"
                    onClick={() => alterarCategoriaVenda("Janta")}
                    className={`rounded-xl px-4 py-4 text-sm font-bold ${
                      categoriaVenda === "Janta"
                        ? "bg-purple-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Janta
                  </button>
                </div>

                <p className="mt-3 text-sm text-slate-500">
                  Bebidas aparecem nas duas categorias.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Filtros
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Buscar produto
                    </label>
                    <input
                      type="text"
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      placeholder="Ex: marmitex, coca, pizza..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tipo
                    </label>
                    <select
                      value={grupoFiltro}
                      onChange={(event) =>
                        setGrupoFiltro(
                          event.target.value as GrupoProduto | "Todos"
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      {gruposFiltro.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-bold text-blue-900">
                      Estoque de bebidas
                    </p>
                    <p className="mt-2 text-sm text-blue-800">
                      Total: {resumoEstoque.bebidasTotal} • Com estoque:{" "}
                      {resumoEstoque.bebidasComEstoque} • Sem estoque:{" "}
                      {resumoEstoque.bebidasSemEstoque}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Item por peso ou quantidade
                </h2>

                <div className="space-y-4">
                  <select
                    value={produtoSelecionadoId}
                    onChange={(event) =>
                      setProdutoSelecionadoId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    <option value="">Selecione um produto</option>
                    {produtosDisponiveis.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome} -{" "}
                        {produto.tipoPreco === "Por quilo"
                          ? `${formatarMoeda(produto.valor)} / kg`
                          : formatarMoeda(produto.valor)}
                      </option>
                    ))}
                  </select>

                  {produtoSelecionado?.tipoPreco === "Por quilo" ? (
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={pesoKg}
                      onChange={(event) => setPesoKg(event.target.value)}
                      placeholder="Peso em kg. Ex: 0.450"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={quantidade}
                      onChange={(event) => setQuantidade(event.target.value)}
                      placeholder="Quantidade"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  )}

                  <button
                    type="button"
                    onClick={adicionarProdutoSelecionado}
                    className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                  >
                    Adicionar item
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-950">
                    Produtos disponíveis
                  </h2>
                  <p className="text-sm text-slate-500">
                    Mostrando itens de {categoriaVenda} + Bebidas.
                  </p>
                </div>

                {produtosDisponiveis.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhum produto disponível.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cadastre produtos em Produtos/itens ou ajuste os filtros.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {produtosDisponiveis.map((produto) => (
                      <button
                        key={produto.id}
                        type="button"
                        onClick={() => adicionarProdutoDireto(produto)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-orange-400 hover:bg-orange-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-slate-950">
                            {produto.nome}
                          </p>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                              produto.categoria === "Almoço"
                                ? "bg-orange-100 text-orange-700"
                                : produto.categoria === "Janta"
                                ? "bg-purple-100 text-purple-700"
                                : produto.categoria === "Bebida"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {produto.categoria}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {produto.grupo}
                        </p>

                        <p className="mt-3 text-lg font-bold text-emerald-700">
                          {produto.tipoPreco === "Por quilo"
                            ? `${formatarMoeda(produto.valor)} / kg`
                            : formatarMoeda(produto.valor)}
                        </p>

                        {produto.controlarEstoque && (
                          <p
                            className={`mt-2 text-xs font-bold ${
                              produto.estoque <= 0
                                ? "text-red-600"
                                : "text-blue-700"
                            }`}
                          >
                            Estoque: {produto.estoque}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Itens da venda
                    </h2>
                    <p className="text-sm text-slate-500">
                      Confira antes de finalizar.
                    </p>
                  </div>

                  <strong className="text-xl text-emerald-700">
                    {formatarMoeda(valorItens)}
                  </strong>
                </div>

                {itensVenda.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhum item na venda.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3">Item</th>
                          <th className="px-3 py-3">Categoria</th>
                          <th className="px-3 py-3 text-right">Qtd/Peso</th>
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {itensVenda.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 text-sm"
                          >
                            <td className="px-3 py-4 font-bold text-slate-950">
                              {item.nome}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {item.categoria}
                            </td>

                            <td className="px-3 py-4 text-right text-slate-700">
                              {item.tipoPreco === "Por quilo"
                                ? `${item.pesoKg.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 3,
                                    maximumFractionDigits: 3,
                                  })} kg`
                                : item.quantidade}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-slate-950">
                              {formatarMoeda(item.subtotal)}
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removerItemVenda(item.id)}
                                  className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300"
                                >
                                  Remover
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
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-orange-300 bg-orange-50 p-6">
                <p className="text-sm font-bold uppercase tracking-wide text-orange-700">
                  Cobrar do cliente
                </p>
                <strong className="mt-2 block text-5xl text-orange-700">
                  {formatarMoeda(valorBruto)}
                </strong>
                <p className="mt-2 text-sm text-orange-800">
                  Este é o valor que o operador deve receber.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Recebimento
                </h2>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={cliente}
                    onChange={(event) => setCliente(event.target.value)}
                    placeholder="Cliente/observação rápida"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />

                  <select
                    value={formaRecebimento}
                    onChange={(event) => {
                      setFormaRecebimento(event.target.value);
                      setValorRecebido("");
                    }}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    {formasRecebimento.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  {formaRecebimento === "Dinheiro" && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <label className="mb-1 block text-sm font-bold text-emerald-900">
                        Valor recebido
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valorRecebido}
                        onChange={(event) =>
                          setValorRecebido(event.target.value)
                        }
                        placeholder="Ex: 100"
                        className="w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                      />

                      <div className="mt-4 rounded-xl bg-white px-4 py-3">
                        <p className="text-sm text-slate-600">Troco</p>
                        <strong className="mt-1 block text-3xl text-emerald-700">
                          {formatarMoeda(troco)}
                        </strong>
                      </div>
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <input
                      type="checkbox"
                      checked={aplicarEntrega}
                      onChange={(event) =>
                        setAplicarEntrega(event.target.checked)
                      }
                      className="h-4 w-4"
                    />

                    <span className="text-sm font-bold text-emerald-900">
                      Aplicar entrega ({formatarMoeda(taxaEntrega.valor)})
                    </span>
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
                    <option value="Delivery">Taxa de app delivery</option>
                  </select>

                  {tipoTaxaAplicada !== "Sem taxa" && (
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
                  )}

                  <textarea
                    value={observacao}
                    onChange={(event) => setObservacao(event.target.value)}
                    placeholder="Observação opcional"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Resumo interno
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Itens</span>
                    <strong>{formatarMoeda(valorItens)}</strong>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Entrega</span>
                    <strong className="text-emerald-700">
                      {formatarMoeda(valorEntrega)}
                    </strong>
                  </div>

                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                    <span className="font-bold text-slate-700">
                      Total a cobrar
                    </span>
                    <strong>{formatarMoeda(valorBruto)}</strong>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Taxa descontada</span>
                    <strong className="text-red-600">
                      {formatarMoeda(valorTaxaPagamento)}
                    </strong>
                  </div>

                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                    <span className="font-bold text-slate-950">
                      Valor real após taxas
                    </span>
                    <strong className="text-blue-700">
                      {formatarMoeda(valorLiquido)}
                    </strong>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={finalizarVenda}
                    className="w-full rounded-xl bg-orange-500 px-5 py-4 text-base font-bold text-white hover:bg-orange-600"
                  >
                    Finalizar venda
                  </button>

                  <button
                    type="button"
                    onClick={limparVenda}
                    className="w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300"
                  >
                    Limpar venda
                  </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Ao finalizar, a venda entra em Entradas pelo valor real após
                  taxas, e o estoque das bebidas é baixado.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
