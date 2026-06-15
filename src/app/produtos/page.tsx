"use client";

import type { FormEvent } from "react";
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
  | "Bebida Sem Álcool"
  | "Bebida Alcoólica"
  | "Sobremesa"
  | "Outros";

type TipoPreco = "Preço fixo" | "Por quilo";

type Produto = {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  grupo: GrupoProduto;
  subgrupo: string;
  opcao: string;
  tipoPreco: TipoPreco;
  valor: number;
  controlarEstoque: boolean;
  estoque: number;
  ativo: boolean;
};

type ProdutoStorage = Partial<Produto> & {
  disponibilidade?: string;
};

const STORAGE_KEY = "gestor-restaurante-produtos";

const categorias: CategoriaProduto[] = ["Almoço", "Janta", "Bebida", "Outros"];

const gruposPorCategoria: Record<CategoriaProduto, GrupoProduto[]> = {
  Almoço: [
    "Por quilo",
    "Marmitex",
    "Mistura",
    "Almoço à vontade",
    "Prato fixo",
    "Outros",
  ],
  Janta: [
    "Jantinha",
    "Pizza",
    "Sanduíche",
    "Porção",
    "Prato fixo",
    "Sobremesa",
    "Outros",
  ],
  Bebida: ["Bebida Sem Álcool", "Bebida", "Bebida Alcoólica"],
  Outros: ["Outros", "Sobremesa", "Porção", "Prato fixo"],
};

const tiposPreco: TipoPreco[] = ["Preço fixo", "Por quilo"];

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function corrigirCategoria(categoria?: string): CategoriaProduto {
  if (categoria === "Almoço") return "Almoço";
  if (categoria === "Janta") return "Janta";
  if (categoria === "Bebida") return "Bebida";
  return "Outros";
}

function corrigirGrupo(
  categoria: CategoriaProduto,
  grupo?: string
): GrupoProduto {
  const gruposValidos = gruposPorCategoria[categoria];

  if (grupo && gruposValidos.includes(grupo as GrupoProduto)) {
    return grupo as GrupoProduto;
  }

  return gruposValidos[0];
}

function corrigirTipoPreco(tipoPreco?: string): TipoPreco {
  return tipoPreco === "Por quilo" ? "Por quilo" : "Preço fixo";
}

function textoSeguro(valor?: unknown) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function lerProdutosStorage(): Produto[] {
  if (typeof window === "undefined") {
    return [];
  }

  const dados = localStorage.getItem(STORAGE_KEY);

  if (!dados) {
    return [];
  }

  try {
    const produtosAntigos = JSON.parse(dados) as ProdutoStorage[];

    if (!Array.isArray(produtosAntigos)) {
      return [];
    }

    return produtosAntigos.map((produto) => {
      const categoriaCorrigida = corrigirCategoria(produto.categoria);
      const grupoCorrigido = corrigirGrupo(
        categoriaCorrigida,
        produto.grupo
      );

      return {
        id: produto.id || criarId(),
        nome: produto.nome || "Produto sem nome",
        categoria: categoriaCorrigida,
        grupo: grupoCorrigido,
        subgrupo: textoSeguro(produto.subgrupo),
        opcao: textoSeguro(produto.opcao),
        tipoPreco: corrigirTipoPreco(produto.tipoPreco),
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

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregouStorage, setCarregouStorage] = useState(false);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaProduto>("Almoço");
  const [grupo, setGrupo] = useState<GrupoProduto>("Marmitex");
  const [subgrupo, setSubgrupo] = useState("");
  const [opcao, setOpcao] = useState("");
  const [tipoPreco, setTipoPreco] = useState<TipoPreco>("Preço fixo");
  const [valor, setValor] = useState("");
  const [controlarEstoque, setControlarEstoque] = useState(false);
  const [estoque, setEstoque] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<
    CategoriaProduto | "Todas"
  >("Todas");
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoProduto | "Todos">(
    "Todos"
  );
  const [filtroSubgrupo, setFiltroSubgrupo] = useState("Todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const produtosSalvos = lerProdutosStorage();
    setProdutos(produtosSalvos);
    setCarregouStorage(true);
  }, []);

  useEffect(() => {
    if (!carregouStorage) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
  }, [produtos, carregouStorage]);

  const gruposDisponiveis = useMemo(() => {
    return gruposPorCategoria[categoria];
  }, [categoria]);

  const todosGrupos = useMemo(() => {
    const gruposUnicos = new Set<GrupoProduto>();

    categorias.forEach((categoriaAtual) => {
      gruposPorCategoria[categoriaAtual].forEach((grupoAtual) => {
        gruposUnicos.add(grupoAtual);
      });
    });

    return Array.from(gruposUnicos);
  }, []);

  const todosSubgrupos = useMemo(() => {
    const subgruposUnicos = new Set<string>();

    produtos.forEach((produto) => {
      if (produto.subgrupo.trim()) {
        subgruposUnicos.add(produto.subgrupo.trim());
      }
    });

    return Array.from(subgruposUnicos).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((produto) => {
      const passaCategoria =
        filtroCategoria === "Todas" || produto.categoria === filtroCategoria;

      const passaGrupo =
        filtroGrupo === "Todos" || produto.grupo === filtroGrupo;

      const passaSubgrupo =
        filtroSubgrupo === "Todos" || produto.subgrupo === filtroSubgrupo;

      const textoBusca = busca.trim().toLowerCase();

      const passaBusca =
        textoBusca.length === 0 ||
        produto.nome.toLowerCase().includes(textoBusca) ||
        produto.grupo.toLowerCase().includes(textoBusca) ||
        produto.subgrupo.toLowerCase().includes(textoBusca) ||
        produto.opcao.toLowerCase().includes(textoBusca) ||
        produto.categoria.toLowerCase().includes(textoBusca);

      return passaCategoria && passaGrupo && passaSubgrupo && passaBusca;
    });
  }, [produtos, filtroCategoria, filtroGrupo, filtroSubgrupo, busca]);

  const resumo = useMemo(() => {
    const totalProdutos = produtos.length;
    const totalAtivos = produtos.filter((produto) => produto.ativo).length;
    const totalInativos = produtos.filter((produto) => !produto.ativo).length;

    const totalAlmoco = produtos.filter(
      (produto) => produto.categoria === "Almoço"
    ).length;

    const totalJanta = produtos.filter(
      (produto) => produto.categoria === "Janta"
    ).length;

    const bebidasComEstoque = produtos.filter(
      (produto) =>
        produto.categoria === "Bebida" &&
        produto.controlarEstoque &&
        produto.estoque > 0
    ).length;

    const bebidasSemEstoque = produtos.filter(
      (produto) =>
        produto.categoria === "Bebida" &&
        produto.controlarEstoque &&
        produto.estoque <= 0
    ).length;

    return {
      totalProdutos,
      totalAtivos,
      totalInativos,
      totalAlmoco,
      totalJanta,
      bebidasComEstoque,
      bebidasSemEstoque,
    };
  }, [produtos]);

  const resumoPorCategoria = useMemo(() => {
    return categorias.map((categoriaAtual) => {
      const total = produtos.filter(
        (produto) => produto.categoria === categoriaAtual
      ).length;

      const ativos = produtos.filter(
        (produto) => produto.categoria === categoriaAtual && produto.ativo
      ).length;

      return {
        categoria: categoriaAtual,
        total,
        ativos,
      };
    });
  }, [produtos]);

  function limparFormulario() {
    setNome("");
    setCategoria("Almoço");
    setGrupo("Marmitex");
    setSubgrupo("");
    setOpcao("");
    setTipoPreco("Preço fixo");
    setValor("");
    setControlarEstoque(false);
    setEstoque("");
    setEditandoId(null);
  }

  function ajustarCamposPorCategoria(novaCategoria: CategoriaProduto) {
    setCategoria(novaCategoria);

    const primeiroGrupo = gruposPorCategoria[novaCategoria][0];
    setGrupo(primeiroGrupo);
    setSubgrupo("");
    setOpcao("");

    if (novaCategoria === "Bebida") {
      setTipoPreco("Preço fixo");
      setControlarEstoque(true);
      return;
    }

    if (primeiroGrupo === "Por quilo") {
      setTipoPreco("Por quilo");
    } else {
      setTipoPreco("Preço fixo");
    }

    setControlarEstoque(false);
    setEstoque("");
  }

  function ajustarTipoPorGrupo(novoGrupo: GrupoProduto) {
    setGrupo(novoGrupo);

    if (novoGrupo === "Por quilo") {
      setTipoPreco("Por quilo");
      return;
    }

    setTipoPreco("Preço fixo");
  }

  function salvarProduto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valor.replace(",", "."));
    const estoqueNumerico = Number(estoque.replace(",", "."));

    if (!nome.trim() || !valor || valorNumerico <= 0) {
      alert("Preencha nome e valor corretamente.");
      return;
    }

    if (controlarEstoque && (!estoque || estoqueNumerico < 0)) {
      alert("Informe a quantidade em estoque corretamente.");
      return;
    }

    if (editandoId) {
      setProdutos((listaAtual) =>
        listaAtual.map((produto) =>
          produto.id === editandoId
            ? {
                ...produto,
                nome: nome.trim(),
                categoria,
                grupo,
                subgrupo: subgrupo.trim(),
                opcao: opcao.trim(),
                tipoPreco,
                valor: valorNumerico,
                controlarEstoque,
                estoque: controlarEstoque ? estoqueNumerico : 0,
              }
            : produto
        )
      );

      limparFormulario();
      return;
    }

    const novoProduto: Produto = {
      id: criarId(),
      nome: nome.trim(),
      categoria,
      grupo,
      subgrupo: subgrupo.trim(),
      opcao: opcao.trim(),
      tipoPreco,
      valor: valorNumerico,
      controlarEstoque,
      estoque: controlarEstoque ? estoqueNumerico : 0,
      ativo: true,
    };

    setProdutos((listaAtual) => [novoProduto, ...listaAtual]);
    limparFormulario();
  }

  function editarProduto(produto: Produto) {
    setEditandoId(produto.id);
    setNome(produto.nome);
    setCategoria(produto.categoria);
    setGrupo(produto.grupo);
    setSubgrupo(produto.subgrupo || "");
    setOpcao(produto.opcao || "");
    setTipoPreco(produto.tipoPreco);
    setValor(String(produto.valor));
    setControlarEstoque(produto.controlarEstoque);
    setEstoque(String(produto.estoque));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluirProduto(id: string) {
    const confirmar = confirm("Deseja realmente excluir este produto?");

    if (!confirmar) {
      return;
    }

    setProdutos((listaAtual) =>
      listaAtual.filter((produto) => produto.id !== id)
    );

    if (editandoId === id) {
      limparFormulario();
    }
  }

  function alternarStatusProduto(id: string) {
    setProdutos((listaAtual) =>
      listaAtual.map((produto) =>
        produto.id === id ? { ...produto, ativo: !produto.ativo } : produto
      )
    );
  }

  function preencherExemplos() {
    const confirmar = confirm(
      "Deseja adicionar exemplos reais separados por Almoço, Janta e Bebida? Isso não apaga os produtos atuais."
    );

    if (!confirmar) {
      return;
    }

    const exemplos: Produto[] = [
      {
        id: criarId(),
        nome: "Almoço por quilo",
        categoria: "Almoço",
        grupo: "Por quilo",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Por quilo",
        valor: 60,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Almoço à vontade semana",
        categoria: "Almoço",
        grupo: "Almoço à vontade",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 35,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Almoço à vontade fim de semana",
        categoria: "Almoço",
        grupo: "Almoço à vontade",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 40,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Marmitex com churrasco",
        categoria: "Almoço",
        grupo: "Marmitex",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 25,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Marmitex sem churrasco",
        categoria: "Almoço",
        grupo: "Marmitex",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 23,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Somente mistura",
        categoria: "Almoço",
        grupo: "Mistura",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 18,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Jantinha",
        categoria: "Janta",
        grupo: "Jantinha",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 25,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Pizza calabresa",
        categoria: "Janta",
        grupo: "Pizza",
        subgrupo: "Pizza de Sal",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 65,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Sanduíche artesanal",
        categoria: "Janta",
        grupo: "Sanduíche",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 28,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Porção de batata",
        categoria: "Janta",
        grupo: "Porção",
        subgrupo: "",
        opcao: "",
        tipoPreco: "Preço fixo",
        valor: 30,
        controlarEstoque: false,
        estoque: 0,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Coca lata",
        categoria: "Bebida",
        grupo: "Bebida Sem Álcool",
        subgrupo: "Coca-Cola",
        opcao: "Lata 350ml",
        tipoPreco: "Preço fixo",
        valor: 6,
        controlarEstoque: true,
        estoque: 30,
        ativo: true,
      },
      {
        id: criarId(),
        nome: "Água sem gás",
        categoria: "Bebida",
        grupo: "Bebida Sem Álcool",
        subgrupo: "Água",
        opcao: "Sem gás",
        tipoPreco: "Preço fixo",
        valor: 3.5,
        controlarEstoque: true,
        estoque: 40,
        ativo: true,
      },
    ];

    setProdutos((listaAtual) => [...exemplos, ...listaAtual]);
  }

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
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Relatórios
            </a>

            <a
              href="/configuracoes"
              className="block rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Configurações
            </a>
          </nav>
        </aside>

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
                Cadastro operacional
              </p>

              <h1 className="text-3xl font-bold text-slate-950">
                Produtos e itens
              </h1>

              <p className="max-w-4xl text-sm text-slate-600">
                Cadastre os itens por categoria principal. Almoço puxa somente
                itens de almoço, Janta puxa somente itens de janta, e Bebidas
                aparecem nos dois.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/configuracoes"
                className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
              >
                ← Voltar para configurações
              </a>

              <a
                href="/pdv"
                className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white hover:bg-orange-600"
              >
                Acessar PDV
              </a>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total de itens</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumo.totalProdutos}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Ativos</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {resumo.totalAtivos}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Inativos</p>
              <strong className="mt-2 block text-2xl text-slate-700">
                {resumo.totalInativos}
              </strong>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-sm text-orange-700">Itens de almoço</p>
              <strong className="mt-2 block text-2xl text-orange-700">
                {resumo.totalAlmoco}
              </strong>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
              <p className="text-sm text-purple-700">Itens de janta</p>
              <strong className="mt-2 block text-2xl text-purple-700">
                {resumo.totalJanta}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Bebidas com estoque</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {resumo.bebidasComEstoque}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Bebidas sem estoque</p>
              <strong className="mt-2 block text-2xl text-red-600">
                {resumo.bebidasSemEstoque}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  {editandoId ? "Editar item" : "Novo item"}
                </h2>

                <form onSubmit={salvarProduto} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Nome do item
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      placeholder="Ex: Marmitex com churrasco"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Categoria principal
                    </label>
                    <select
                      value={categoria}
                      onChange={(event) =>
                        ajustarCamposPorCategoria(
                          event.target.value as CategoriaProduto
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

                    <p className="mt-2 text-xs text-slate-500">
                      Almoço e Janta são categorias principais. Bebida aparece
                      nas duas vendas.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tipo dentro da categoria
                    </label>
                    <select
                      value={grupo}
                      onChange={(event) =>
                        ajustarTipoPorGrupo(event.target.value as GrupoProduto)
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      {gruposDisponiveis.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Subgrupo / card que abre depois
                    </label>
                    <input
                      type="text"
                      value={subgrupo}
                      onChange={(event) => setSubgrupo(event.target.value)}
                      placeholder="Ex: Pizza de Sal, Pizza Doce, Coca-Cola"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Exemplo: Pizza &gt; Pizza de Sal ou Bebida Sem Álcool &gt; Coca-Cola.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Opção / tamanho / variação
                    </label>
                    <input
                      type="text"
                      value={opcao}
                      onChange={(event) => setOpcao(event.target.value)}
                      placeholder="Ex: Grande, Broto, Lata 350ml, 2 litros"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tipo de preço
                    </label>
                    <select
                      value={tipoPreco}
                      onChange={(event) =>
                        setTipoPreco(event.target.value as TipoPreco)
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      {tiposPreco.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {tipoPreco === "Por quilo"
                        ? "Valor do quilo"
                        : "Valor do item"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valor}
                      onChange={(event) => setValor(event.target.value)}
                      placeholder={
                        tipoPreco === "Por quilo" ? "Ex: 60" : "Ex: 25"
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={controlarEstoque}
                        onChange={(event) =>
                          setControlarEstoque(event.target.checked)
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Controlar estoque deste item
                      </span>
                    </label>

                    <p className="mt-2 text-xs text-slate-500">
                      Use principalmente para bebidas, para não vender o que não
                      tem.
                    </p>
                  </div>

                  {controlarEstoque && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Quantidade em estoque
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={estoque}
                        onChange={(event) => setEstoque(event.target.value)}
                        placeholder="Ex: 30"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                    >
                      {editandoId ? "Salvar edição" : "Cadastrar item"}
                    </button>

                    {editandoId && (
                      <button
                        type="button"
                        onClick={limparFormulario}
                        className="w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300"
                      >
                        Cancelar edição
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={preencherExemplos}
                      className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Adicionar exemplos
                    </button>

                    <a
                      href="/configuracoes"
                      className="block w-full rounded-xl bg-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-300"
                    >
                      ← Voltar para configurações
                    </a>
                  </div>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Resumo por categoria
                </h2>

                <div className="space-y-3">
                  {resumoPorCategoria.map((item) => (
                    <div
                      key={item.categoria}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {item.categoria}
                      </span>

                      <div className="text-right">
                        <strong className="block text-sm text-slate-950">
                          {item.total}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {item.ativos} ativo(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-950">
                    Itens cadastrados
                  </h2>
                  <p className="text-sm text-slate-500">
                    Almoço e Janta ficam separados. Bebidas aparecem nas duas
                    vendas.
                  </p>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Buscar
                    </label>
                    <input
                      type="text"
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      placeholder="Buscar item..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Categoria
                    </label>
                    <select
                      value={filtroCategoria}
                      onChange={(event) =>
                        setFiltroCategoria(
                          event.target.value as CategoriaProduto | "Todas"
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="Todas">Todas</option>
                      {categorias.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tipo
                    </label>
                    <select
                      value={filtroGrupo}
                      onChange={(event) =>
                        setFiltroGrupo(
                          event.target.value as GrupoProduto | "Todos"
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="Todos">Todos</option>
                      {todosGrupos.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Subgrupo
                    </label>
                    <select
                      value={filtroSubgrupo}
                      onChange={(event) => setFiltroSubgrupo(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="Todos">Todos</option>
                      {todosSubgrupos.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {produtosFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhum item encontrado.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Cadastre um item ou ajuste os filtros.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3">Item</th>
                          <th className="px-3 py-3">Categoria</th>
                          <th className="px-3 py-3">Tipo</th>
                          <th className="px-3 py-3">Subgrupo</th>
                          <th className="px-3 py-3">Opção</th>
                          <th className="px-3 py-3">Preço</th>
                          <th className="px-3 py-3 text-right">Valor</th>
                          <th className="px-3 py-3 text-right">Estoque</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {produtosFiltrados.map((produto) => (
                          <tr
                            key={produto.id}
                            className="border-b border-slate-100 text-sm"
                          >
                            <td className="px-3 py-4 font-bold text-slate-950">
                              {produto.nome}
                            </td>

                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  produto.categoria === "Almoço"
                                    ? "bg-orange-100 text-orange-700"
                                    : produto.categoria === "Janta"
                                    ? "bg-purple-100 text-purple-700"
                                    : produto.categoria === "Bebida"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {produto.categoria}
                              </span>
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {produto.grupo}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {produto.subgrupo || "-"}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {produto.opcao || "-"}
                            </td>

                            <td className="px-3 py-4 text-slate-700">
                              {produto.tipoPreco}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-slate-950">
                              {produto.tipoPreco === "Por quilo"
                                ? `${formatarMoeda(produto.valor)} / kg`
                                : formatarMoeda(produto.valor)}
                            </td>

                            <td className="px-3 py-4 text-right">
                              {produto.controlarEstoque ? (
                                <span
                                  className={`font-bold ${
                                    produto.estoque <= 0
                                      ? "text-red-600"
                                      : "text-emerald-700"
                                  }`}
                                >
                                  {produto.estoque}
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Não controla
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  produto.ativo
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {produto.ativo ? "Ativo" : "Inativo"}
                              </span>
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => editarProduto(produto)}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                                >
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    alternarStatusProduto(produto.id)
                                  }
                                  className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                >
                                  {produto.ativo ? "Desativar" : "Ativar"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => excluirProduto(produto.id)}
                                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
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

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
                <h2 className="text-xl font-bold text-orange-900">
                  Como a venda rápida vai usar isso
                </h2>
                <p className="mt-2 text-sm leading-6 text-orange-800">
                  Ao escolher Almoço, a venda rápida mostra apenas itens
                  cadastrados como Almoço + Bebidas. Ao escolher Janta, mostra
                  apenas itens cadastrados como Janta + Bebidas. O preço vem
                  automaticamente do cadastro.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
