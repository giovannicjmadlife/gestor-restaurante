"use client";

import { useEffect, useMemo, useState } from "react";
import { buscarProdutos, salvarProdutos } from "@/lib/produtosStorage";
import { salvarVendaFinanceiroSupabase } from "@/lib/financeiroSupabase";

type ProdutoRaw = Record<string, unknown>;

type ProdutoView = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  grupo: string;
  subgrupo: string;
  opcao: string;
  tipo: string;
  preco: number;
  ativo: boolean;
  porQuilo: boolean;
  controlaEstoque: boolean;
  estoque: number;
  raw: ProdutoRaw;
};

type CartItem = {
  id: string;
  produtoId: string;
  produtoIdsMetade?: string[];
  codigo: string;
  nome: string;
  categoria: string;
  grupo: string;
  subgrupo: string;
  opcao: string;
  tipo: string;
  precoUnitario: number;
  quantidade: number;
  total: number;
  porQuilo: boolean;
  unidade: "un" | "kg";
  meiaPizza?: boolean;
  saboresPizza?: string[];
};

type FormaPagamentoBase = "Dinheiro" | "PIX" | "Débito" | "Crédito" | "Correntista";
type FormaPagamento = FormaPagamentoBase | "Dividido";

type PagamentoVenda = {
  id: string;
  forma: FormaPagamentoBase;
  valorPago: number;
  taxaPercentual: number;
  valorTaxa: number;
  taxaDescontada: number;
  valorLiquido: number;
};

type Colaborador = {
  id: string;
  nome: string;
  percentualComissao: number;
  ativo: boolean;
  telefone?: string;
  observacoes?: string;
};

type Correntista = {
  id: string;
  nome: string;
  telefone?: string;
  documento?: string;
  limiteCredito?: number;
  saldoAberto?: number;
  status?: string;
  observacoes?: string;
  criadoEm?: string;
  atualizadoEm?: string;
};

type PesoModal = {
  produto: ProdutoView;
  peso: string;
};

type CaixaAtual = {
  id: string;
  data: string;
  operador: string;
  valorAbertura: number;
  status: "Aberto" | "Fechado";
  abertoEm: string;
  fechadoEm?: string;
};

type AtendimentoAtual = {
  tipo: "Balcão" | "Mesa" | "Comanda";
  mesaId?: string;
  mesaNumero?: number;
  comandaId?: string;
  comandaNome?: string;
  documento?: string;
  cliente?: string;
  pessoas?: number;
  iniciadoEm: string;
};

type MesaConsumo = {
  id: string;
  mesaId: string;
  mesaNumero: number;
  cliente: string;
  pessoas: number;
  status: "Aberto" | "Pago";
  itens: CartItem[];
  total: number;
  criadoEm: string;
  atualizadoEm: string;
};

type ComandaConsumo = {
  id: string;
  comandaId: string;
  comandaNome: string;
  documento: string;
  cliente: string;
  status: "Aberto" | "Pago";
  itens: CartItem[];
  total: number;
  criadoEm: string;
  atualizadoEm: string;
};

const LS_PRODUTOS = "gestor-restaurante-produtos";
const LS_ENTRADAS = "gestor-restaurante-entradas";
const LS_VENDAS_DETALHADAS = "gestor-restaurante-vendas-detalhadas";
const LS_TAXAS_MAQUININHAS = "gestor-restaurante-taxas-maquininhas";
const LS_CONTAS_RECEBER = "gestor-restaurante-contas-receber";
const LS_CORRENTISTAS = "gestor-restaurante-correntistas";
const LS_COLABORADORES = "gestor-restaurante-colaboradores";

const LS_CAIXA_ATUAL = "gestor-restaurante-caixa-atual";
const LS_CAIXAS = "gestor-restaurante-caixas";
const LS_CAIXAS_HISTORICO = "gestor-restaurante-caixas-historico";
const LS_ATENDIMENTO_ATUAL = "gestor-restaurante-pdv-atendimento-atual";
const LS_MESA_CONSUMOS = "gestor-restaurante-mesa-consumos";
const LS_COMANDA_CONSUMOS = "gestor-restaurante-comanda-consumos";
const LS_MESAS = "gestor-restaurante-mesas";
const LS_COMANDAS = "gestor-restaurante-comandas";

const CATEGORIAS_PDV = ["Almoço", "Janta", "Bebidas", "Sorvete", "Outros"];
const FORMAS_PAGAMENTO_BASE: FormaPagamentoBase[] = ["Dinheiro", "PIX", "Débito", "Crédito", "Correntista"];
const FORMAS_PAGAMENTO_DIVIDIDO: FormaPagamentoBase[] = ["Dinheiro", "PIX", "Débito", "Crédito"];

const ORDEM_SUBGRUPOS_PIZZA = [
  "Pizza de Sal",
  "Pizza Doce",
  "Pizza Pequena",
  "Pizza Gigante",
];

const ORDEM_TAMANHOS_PIZZA = ["Grande", "Média", "Pequena", "Única"];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonArray<T = unknown>(value: string | null): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonObject<T = unknown>(value: string | null): T | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    let cleaned = value
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "");

    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }

    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
  }

  return 0;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function todayInputDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarSubgrupoPizza(subgrupo: string, nome = "") {
  const texto = normalizeText(`${subgrupo} ${nome}`);

  if (texto.includes("gigante") || texto.includes("gg quadrada")) {
    return "Pizza Gigante";
  }

  if (texto.includes("pizza pequena") || texto.includes("pizza p")) {
    return "Pizza Pequena";
  }

  if (texto.includes("doce")) {
    return "Pizza Doce";
  }

  if (texto.includes("sal")) {
    return "Pizza de Sal";
  }

  return subgrupo.trim();
}

function normalizarOpcaoPizza(opcao: string) {
  const texto = normalizeText(opcao);

  if (!texto || texto === "-") return "";
  if (texto.includes("media")) return "Média";
  if (texto.includes("grande")) return "Grande";
  if (texto.includes("pequena") || texto === "p" || texto.includes("pequeno")) {
    return "Pequena";
  }
  if (texto.includes("unica")) return "Única";

  return opcao.trim();
}

function ordenarPorOrdemPreferencial(lista: string[], ordem: string[]) {
  return [...lista].sort((a, b) => {
    const aNormalizado = normalizeText(a);
    const bNormalizado = normalizeText(b);
    const ia = ordem.findIndex((item) => normalizeText(item) === aNormalizado);
    const ib = ordem.findIndex((item) => normalizeText(item) === bNormalizado);
    const pa = ia === -1 ? 999 : ia;
    const pb = ib === -1 ? 999 : ib;

    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "pt-BR");
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getProdutoView(raw: ProdutoRaw, index: number): ProdutoView {
  const nome =
    asString(raw.nome) ||
    asString(raw.item) ||
    asString(raw.descricao) ||
    `Produto ${index + 1}`;

  const codigo =
    asString(raw.codigo) ||
    asString(raw.cod) ||
    asString(raw.id) ||
    String(index + 1);

  const categoria =
    asString(raw.categoriaPrincipal) || asString(raw.categoria) || "Outros";

  const grupo =
    asString(raw.grupo) ||
    asString(raw.tipo) ||
    asString(raw.categoriaPrincipal) ||
    asString(raw.categoria) ||
    "Outros";

  let subgrupo =
    asString(raw.subgrupo) ||
    asString(raw.subcategoria) ||
    asString(raw.marca) ||
    asString(raw.linha) ||
    "";

  let opcao =
    asString(raw.opcao) ||
    asString(raw.variacao) ||
    asString(raw.tamanho) ||
    asString(raw.unidadeOpcao) ||
    "";

  if (normalizeText(grupo).includes("pizza")) {
    subgrupo = normalizarSubgrupoPizza(subgrupo, nome);
    opcao = normalizarOpcaoPizza(opcao);
  }

  const tipo = [grupo, subgrupo, opcao].filter(Boolean).join(" > ");

  const preco =
    asNumber(raw.valor) ||
    asNumber(raw.preco) ||
    asNumber(raw.precoVenda) ||
    asNumber(raw.price) ||
    0;

  const estoque = asNumber(raw.estoque);
  const ativoRaw = raw.ativo;
  const status = normalizeText(asString(raw.status));

  const ativo =
    ativoRaw === false || status === "inativo" || status === "desativado"
      ? false
      : true;

  const tipoPreco = normalizeText(asString(raw.tipoPreco));
  const unidade = normalizeText(asString(raw.unidade));
  const tipoNormalizado = normalizeText(tipo);

  const porQuilo =
    raw.porQuilo === true ||
    raw.precoPorQuilo === true ||
    tipoPreco.includes("quilo") ||
    tipoPreco.includes("kg") ||
    unidade.includes("kg") ||
    tipoNormalizado.includes("quilo") ||
    tipoNormalizado.includes("kg");

  const controlaEstoque =
    raw.controlaEstoque === true ||
    raw.temEstoque === true ||
    raw.baixarEstoque === true;

  return {
    id: asString(raw.id) || `${codigo}-${nome}-${index}`,
    codigo,
    nome,
    categoria,
    grupo,
    subgrupo,
    opcao,
    tipo,
    preco,
    ativo,
    porQuilo,
    controlaEstoque,
    estoque,
    raw,
  };
}

function calcularTotalItem(item: CartItem) {
  return Number((item.precoUnitario * item.quantidade).toFixed(2));
}

function getTaxaMaquininha(
  formaPagamento: FormaPagamentoBase,
  taxas: ProdutoRaw[]
) {
  if (formaPagamento === "Dinheiro" || formaPagamento === "Correntista") {
    return 0;
  }

  const alvo =
    formaPagamento === "Crédito"
      ? ["credito", "crédito"]
      : formaPagamento === "Débito"
      ? ["debito", "débito"]
      : ["pix"];

  for (const taxa of taxas) {
    const ativo = taxa.ativo;
    const texto = normalizeText(Object.values(taxa).join(" "));

    if (ativo === false) {
      continue;
    }

    const encontrouForma = alvo.some((palavra) => texto.includes(palavra));

    if (encontrouForma) {
      return (
        asNumber(taxa.percentual) ||
        asNumber(taxa.taxa) ||
        asNumber(taxa.valor) ||
        asNumber(taxa.porcentagem) ||
        0
      );
    }
  }

  return 0;
}

function calcularPagamentoVenda(
  forma: FormaPagamentoBase,
  valorPago: number,
  taxas: ProdutoRaw[]
): PagamentoVenda {
  const taxaPercentual = getTaxaMaquininha(forma, taxas);
  const valorTaxa = Number(((valorPago * taxaPercentual) / 100).toFixed(2));
  const valorLiquido = Number((valorPago - valorTaxa).toFixed(2));

  return {
    id: uid(),
    forma,
    valorPago: Number(valorPago.toFixed(2)),
    taxaPercentual,
    valorTaxa,
    taxaDescontada: valorTaxa,
    valorLiquido,
  };
}

function descricaoPagamentos(pagamentos: PagamentoVenda[]) {
  if (pagamentos.length <= 1) {
    return pagamentos[0]?.forma || "Não informado";
  }

  return pagamentos
    .map((pagamento) => `${pagamento.forma} ${money(pagamento.valorPago)}`)
    .join(" + ");
}

export default function PdvPage() {
  const [produtos, setProdutos] = useState<ProdutoView[]>([]);
  const [taxasMaquininhas, setTaxasMaquininhas] = useState<ProdutoRaw[]>([]);
  const [correntistas, setCorrentistas] = useState<Correntista[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [grupoSelecionado, setGrupoSelecionado] = useState("");
  const [subgrupoSelecionado, setSubgrupoSelecionado] = useState("");
  const [opcaoSelecionada, setOpcaoSelecionada] = useState("");
  const [modoMeiaPizza, setModoMeiaPizza] = useState(false);
  const [primeiraMetadePizza, setPrimeiraMetadePizza] =
    useState<ProdutoView | null>(null);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);

  const [cliente, setCliente] = useState("");
  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamento>("Dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [descontoReais, setDescontoReais] = useState("");
  const [correntistaSelecionadoId, setCorrentistaSelecionadoId] = useState("");
  const [colaboradorSelecionadoId, setColaboradorSelecionadoId] = useState("");
  const [pagamentosDivididos, setPagamentosDivididos] = useState<Record<FormaPagamentoBase, string>>({
    Dinheiro: "",
    PIX: "",
    Débito: "",
    Crédito: "",
    Correntista: "",
  });

  const [pesoModal, setPesoModal] = useState<PesoModal | null>(null);

  const [caixaAtual, setCaixaAtual] = useState<CaixaAtual | null>(null);
  const [mostrarAberturaCaixa, setMostrarAberturaCaixa] = useState(false);
  const [operadorCaixa, setOperadorCaixa] = useState("Adm");
  const [valorAbertura, setValorAbertura] = useState("");

  const [atendimentoAtual, setAtendimentoAtual] =
    useState<AtendimentoAtual | null>(null);
  const [usuarioSistema, setUsuarioSistema] = useState<{
    nome?: string;
    email?: string;
    perfil?: string;
  } | null>(null);

  useEffect(() => {
    const usuarioSalvo = safeJsonObject<{
      nome?: string;
      email?: string;
      perfil?: string;
    }>(localStorage.getItem("gestor-restaurante-usuario"));

    if (usuarioSalvo) {
      setUsuarioSistema(usuarioSalvo);
    }

    let cancelado = false;

    async function carregarProdutosDoBanco() {
      const produtosStorage = await buscarProdutos();

      if (cancelado) return;

      const produtosMapeados = produtosStorage
        .map((produto, index) => getProdutoView(produto as ProdutoRaw, index))
        .filter((produto) => produto.ativo);

      setProdutos(produtosMapeados);
    }

    carregarProdutosDoBanco();

    const taxasStorage = safeJsonArray<ProdutoRaw>(
      localStorage.getItem(LS_TAXAS_MAQUININHAS)
    );

    setTaxasMaquininhas(taxasStorage);

    fetch("/api/taxas", { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => {
        if (!dados?.maquininhas || cancelado) return;
        setTaxasMaquininhas(dados.maquininhas);
        localStorage.setItem(LS_TAXAS_MAQUININHAS, JSON.stringify(dados.maquininhas));
      })
      .catch((error) => {
        console.error("Não foi possível carregar taxas do Supabase.", error);
      });

    const correntistasStorage = safeJsonArray<Correntista>(
      localStorage.getItem(LS_CORRENTISTAS)
    );

    setCorrentistas(
      correntistasStorage.filter((correntista) => correntista.status !== "Inativo")
    );

    const colaboradoresStorage = safeJsonArray<Colaborador>(
      localStorage.getItem(LS_COLABORADORES)
    );

    setColaboradores(
      colaboradoresStorage.filter((colaborador) => colaborador.ativo !== false)
    );

    fetch("/api/colaboradores", { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : []))
      .then((dados) => {
        if (!Array.isArray(dados) || cancelado) return;
        setColaboradores(dados.filter((colaborador: Colaborador) => colaborador.ativo !== false));
        localStorage.setItem(LS_COLABORADORES, JSON.stringify(dados));
      })
      .catch((error) => {
        console.error("Não foi possível carregar colaboradores do Supabase.", error);
      });

    const caixaSalvo = safeJsonObject<CaixaAtual>(
      localStorage.getItem(LS_CAIXA_ATUAL)
    );

    if (caixaSalvo?.status === "Aberto") {
      setCaixaAtual(caixaSalvo);
      setOperadorCaixa(caixaSalvo.operador || "Adm");
    }

    const atendimentoSalvo = safeJsonObject<AtendimentoAtual>(
      localStorage.getItem(LS_ATENDIMENTO_ATUAL)
    );

    if (atendimentoSalvo) {
      setAtendimentoAtual(atendimentoSalvo);

      if (atendimentoSalvo.cliente) {
        setCliente(atendimentoSalvo.cliente);
      }

      if (atendimentoSalvo.tipo === "Mesa" && atendimentoSalvo.mesaId) {
        const consumosMesa = safeJsonArray<MesaConsumo>(
          localStorage.getItem(LS_MESA_CONSUMOS)
        );

        const consumoAberto = consumosMesa.find(
          (consumo) =>
            consumo.mesaId === atendimentoSalvo.mesaId &&
            consumo.status === "Aberto"
        );

        if (consumoAberto?.itens?.length) {
          setCarrinho(consumoAberto.itens);
        }
      }

      if (atendimentoSalvo.tipo === "Comanda" && atendimentoSalvo.comandaId) {
        const consumosComanda = safeJsonArray<ComandaConsumo>(
          localStorage.getItem(LS_COMANDA_CONSUMOS)
        );

        const consumoAberto = consumosComanda.find(
          (consumo) =>
            consumo.comandaId === atendimentoSalvo.comandaId &&
            consumo.status === "Aberto"
        );

        if (consumoAberto?.itens?.length) {
          setCarrinho(consumoAberto.itens);
        }
      }
    }

    return () => {
      cancelado = true;
    };
  }, []);

  const caixaAberto = caixaAtual?.status === "Aberto";

  function categoriaPdvDoProduto(produto: ProdutoView) {
    const categoriaProduto = normalizeText(produto.categoria);
    const grupoProduto = normalizeText(produto.grupo);

    if (categoriaProduto.includes("almoco") || grupoProduto.includes("almoco")) {
      return "Almoço";
    }

    if (
      categoriaProduto.includes("janta") ||
      categoriaProduto.includes("pizza") ||
      grupoProduto.includes("pizza")
    ) {
      return "Janta";
    }

    if (categoriaProduto.includes("bebida") || grupoProduto.includes("bebida")) {
      return "Bebidas";
    }

    if (
      categoriaProduto.includes("sorvete") ||
      grupoProduto.includes("sorvete") ||
      grupoProduto.includes("acai")
    ) {
      return "Sorvete";
    }

    return "Outros";
  }

  function produtoEhPizza(produto: ProdutoView) {
    const categoriaProduto = normalizeText(produto.categoria);
    const grupoProduto = normalizeText(produto.grupo);

    return categoriaProduto.includes("pizza") || grupoProduto.includes("pizza");
  }

  function limparSelecaoMeiaPizza() {
    setPrimeiraMetadePizza(null);
  }

  function produtoPertenceAoCard(produto: ProdutoView, card: string) {
    if (!card) return true;
    return categoriaPdvDoProduto(produto) === card;
  }

  const categorias = useMemo(() => {
    return CATEGORIAS_PDV;
  }, []);

  useEffect(() => {
    if (!categoriaSelecionada && categorias.length > 0) {
      setCategoriaSelecionada(categorias[0]);
    }
  }, [categorias, categoriaSelecionada]);

  const produtosDoCardPrincipal = useMemo(() => {
    return produtos.filter((produto) =>
      produtoPertenceAoCard(produto, categoriaSelecionada)
    );
  }, [produtos, categoriaSelecionada]);

  const gruposDisponiveis = useMemo(() => {
    const lista = produtosDoCardPrincipal
      .map((produto) => produto.grupo.trim())
      .filter(Boolean);

    return Array.from(new Set(lista)).sort((a, b) => {
      if (a === "Pizza") return -1;
      if (b === "Pizza") return 1;
      return a.localeCompare(b, "pt-BR");
    });
  }, [produtosDoCardPrincipal]);

  const produtosDoGrupoSelecionado = useMemo(() => {
    if (!grupoSelecionado) {
      return produtosDoCardPrincipal;
    }

    return produtosDoCardPrincipal.filter(
      (produto) => normalizeText(produto.grupo) === normalizeText(grupoSelecionado)
    );
  }, [produtosDoCardPrincipal, grupoSelecionado]);

  const subgruposDisponiveis = useMemo(() => {
    const lista = produtosDoGrupoSelecionado
      .map((produto) => produto.subgrupo.trim())
      .filter(Boolean);

    const unicos = Array.from(new Set(lista));

    if (normalizeText(grupoSelecionado) === "pizza") {
      return ordenarPorOrdemPreferencial(unicos, ORDEM_SUBGRUPOS_PIZZA);
    }

    return unicos.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [produtosDoGrupoSelecionado, grupoSelecionado]);

  const produtosDoSubgrupoSelecionado = useMemo(() => {
    if (!subgrupoSelecionado) {
      return produtosDoGrupoSelecionado;
    }

    return produtosDoGrupoSelecionado.filter(
      (produto) =>
        normalizeText(produto.subgrupo) === normalizeText(subgrupoSelecionado)
    );
  }, [produtosDoGrupoSelecionado, subgrupoSelecionado]);

  const opcoesDisponiveis = useMemo(() => {
    const lista = produtosDoSubgrupoSelecionado
      .map((produto) => produto.opcao.trim())
      .filter(Boolean);

    const unicos = Array.from(new Set(lista));

    if (normalizeText(grupoSelecionado) === "pizza") {
      return ordenarPorOrdemPreferencial(unicos, ORDEM_TAMANHOS_PIZZA);
    }

    return unicos.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [produtosDoSubgrupoSelecionado, grupoSelecionado]);

  useEffect(() => {
    setGrupoSelecionado("");
    setSubgrupoSelecionado("");
    setOpcaoSelecionada("");
    limparSelecaoMeiaPizza();
  }, [categoriaSelecionada]);

  useEffect(() => {
    setSubgrupoSelecionado("");
    setOpcaoSelecionada("");
    limparSelecaoMeiaPizza();
  }, [grupoSelecionado]);

  useEffect(() => {
    setOpcaoSelecionada("");
    limparSelecaoMeiaPizza();
  }, [subgrupoSelecionado]);

  useEffect(() => {
    limparSelecaoMeiaPizza();
  }, [opcaoSelecionada]);

  const produtosFiltrados = useMemo(() => {
    const buscaNormalizada = normalizeText(busca);
    const buscando = Boolean(buscaNormalizada);

    return produtosDoCardPrincipal.filter((produto) => {
      if (!buscando && gruposDisponiveis.length > 0 && !grupoSelecionado) {
        return false;
      }

      if (
        grupoSelecionado &&
        normalizeText(produto.grupo) !== normalizeText(grupoSelecionado)
      ) {
        return false;
      }

      if (!buscando && subgruposDisponiveis.length > 0 && !subgrupoSelecionado) {
        return false;
      }

      if (
        subgrupoSelecionado &&
        normalizeText(produto.subgrupo) !== normalizeText(subgrupoSelecionado)
      ) {
        return false;
      }

      if (!buscando && opcoesDisponiveis.length > 0 && !opcaoSelecionada) {
        return false;
      }

      if (
        opcaoSelecionada &&
        normalizeText(produto.opcao) !== normalizeText(opcaoSelecionada)
      ) {
        return false;
      }

      const textoProduto = normalizeText(
        `${produto.nome} ${produto.codigo} ${produto.categoria} ${produto.grupo} ${produto.subgrupo} ${produto.opcao} ${produto.tipo}`
      );

      return !buscaNormalizada || textoProduto.includes(buscaNormalizada);
    });
  }, [
    produtosDoCardPrincipal,
    gruposDisponiveis,
    grupoSelecionado,
    subgruposDisponiveis,
    subgrupoSelecionado,
    opcoesDisponiveis,
    opcaoSelecionada,
    busca,
  ]);

  const totalItens = useMemo(() => {
    return carrinho.reduce((total, item) => total + item.quantidade, 0);
  }, [carrinho]);

  const totalBruto = useMemo(() => {
    return carrinho.reduce((total, item) => total + item.total, 0);
  }, [carrinho]);

  const taxaPercentual = useMemo(() => {
    if (formaPagamento === "Dividido") return 0;
    return getTaxaMaquininha(formaPagamento, taxasMaquininhas);
  }, [formaPagamento, taxasMaquininhas]);

  const descontoNumerico = useMemo(() => {
    const desconto = asNumber(descontoReais);
    if (desconto <= 0) return 0;
    return Math.min(desconto, totalBruto);
  }, [descontoReais, totalBruto]);

  const valorCobrar = useMemo(() => {
    return Number(Math.max(totalBruto - descontoNumerico, 0).toFixed(2));
  }, [totalBruto, descontoNumerico]);

  const pagamentosCalculados = useMemo(() => {
    if (formaPagamento === "Dividido") {
      return FORMAS_PAGAMENTO_DIVIDIDO
        .map((forma) => {
          const valor = asNumber(pagamentosDivididos[forma]);
          return calcularPagamentoVenda(forma, valor, taxasMaquininhas);
        })
        .filter((pagamento) => pagamento.valorPago > 0);
    }

    if (valorCobrar <= 0) return [];

    return [calcularPagamentoVenda(formaPagamento, valorCobrar, taxasMaquininhas)];
  }, [formaPagamento, pagamentosDivididos, taxasMaquininhas, valorCobrar]);

  const totalPagamentosDivididos = useMemo(() => {
    return Number(
      FORMAS_PAGAMENTO_DIVIDIDO.reduce((total, forma) => {
        return total + asNumber(pagamentosDivididos[forma]);
      }, 0).toFixed(2)
    );
  }, [pagamentosDivididos]);

  const diferencaPagamentoDividido = useMemo(() => {
    return Number((valorCobrar - totalPagamentosDivididos).toFixed(2));
  }, [valorCobrar, totalPagamentosDivididos]);

  const valorTaxa = useMemo(() => {
    return Number(
      pagamentosCalculados
        .reduce((total, pagamento) => total + pagamento.valorTaxa, 0)
        .toFixed(2)
    );
  }, [pagamentosCalculados]);

  const valorLiquido = useMemo(() => {
    return Number((valorCobrar - valorTaxa).toFixed(2));
  }, [valorCobrar, valorTaxa]);

  const troco = useMemo(() => {
    if (formaPagamento !== "Dinheiro") return 0;

    const recebido = asNumber(valorRecebido);
    const diferenca = recebido - valorCobrar;

    return diferenca > 0 ? diferenca : 0;
  }, [formaPagamento, valorRecebido, valorCobrar]);

  const correntistaSelecionado = useMemo(() => {
    return correntistas.find(
      (correntista) => correntista.id === correntistaSelecionadoId
    );
  }, [correntistas, correntistaSelecionadoId]);

  const colaboradorSelecionado = useMemo(() => {
    return colaboradores.find(
      (colaborador) => colaborador.id === colaboradorSelecionadoId
    );
  }, [colaboradores, colaboradorSelecionadoId]);

  const tipoAtendimento = atendimentoAtual?.tipo || "Balcão";

  const consumidorVenda =
    atendimentoAtual?.tipo === "Mesa"
      ? `Mesa ${atendimentoAtual.mesaNumero} - ${
          cliente || atendimentoAtual.cliente || "Não identificado"
        }`
      : atendimentoAtual?.tipo === "Comanda"
      ? `Comanda ${atendimentoAtual.comandaNome || ""} - ${
          cliente || atendimentoAtual.cliente || "Não identificado"
        }`
      : formaPagamento === "Correntista" && correntistaSelecionado
      ? correntistaSelecionado.nome
      : cliente || "Não identificado";

  function registrarEventoCaixa(evento: ProdutoRaw) {
    const historicoAtual = safeJsonArray<ProdutoRaw>(
      localStorage.getItem(LS_CAIXAS_HISTORICO)
    );

    localStorage.setItem(
      LS_CAIXAS_HISTORICO,
      JSON.stringify([evento, ...historicoAtual])
    );

    const vendasAtuais = safeJsonArray<ProdutoRaw>(
      localStorage.getItem(LS_VENDAS_DETALHADAS)
    );

    localStorage.setItem(
      LS_VENDAS_DETALHADAS,
      JSON.stringify([evento, ...vendasAtuais])
    );
  }

  function abrirCaixa() {
    const operador = operadorCaixa.trim();
    const valor = asNumber(valorAbertura);

    if (!operador) {
      alert("Informe o operador do caixa.");
      return;
    }

    if (valor < 0) {
      alert("O valor de abertura não pode ser negativo.");
      return;
    }

    const agora = new Date();

    const novoCaixa: CaixaAtual = {
      id: uid(),
      data: todayInputDate(),
      operador,
      valorAbertura: valor,
      status: "Aberto",
      abertoEm: agora.toISOString(),
    };

    localStorage.setItem(LS_CAIXA_ATUAL, JSON.stringify(novoCaixa));

    const caixasAtuais = safeJsonArray<CaixaAtual>(
      localStorage.getItem(LS_CAIXAS)
    );

    localStorage.setItem(LS_CAIXAS, JSON.stringify([novoCaixa, ...caixasAtuais]));

    const eventoAbertura = {
      id: uid(),
      caixaId: novoCaixa.id,
      data: todayInputDate(),
      dataHora: agora.toISOString(),
      operador,
      tipoVenda: "Caixa",
      status: "Abertura",
      tipoDocumento: "Evento de caixa",
      consumidor: "Abertura de caixa",
      formaPagamento: "Dinheiro",
      valorBruto: valor,
      valorLiquido: valor,
      valor,
      observacao: "Abertura de caixa",
    };

    registrarEventoCaixa(eventoAbertura);

    setCaixaAtual(novoCaixa);
    setMostrarAberturaCaixa(false);
    setValorAbertura("");

    alert("Caixa aberto com sucesso.");
  }

  function adicionarProdutoMeiaPizza(produto: ProdutoView) {
    if (!produtoEhPizza(produto)) {
      adicionarProduto(produto);
      return;
    }

    if (produto.controlaEstoque && produto.estoque <= 0) {
      alert("Este produto está sem estoque.");
      return;
    }

    if (!primeiraMetadePizza) {
      setPrimeiraMetadePizza(produto);
      return;
    }

    if (primeiraMetadePizza.id === produto.id) {
      alert("Escolha um segundo sabor diferente para montar a meia pizza.");
      return;
    }

    const mesmoTipoPizza =
      normalizeText(primeiraMetadePizza.subgrupo) === normalizeText(produto.subgrupo);

    const mesmoTamanho =
      normalizeText(primeiraMetadePizza.opcao) === normalizeText(produto.opcao);

    if (!mesmoTipoPizza || !mesmoTamanho) {
      alert("A meia pizza precisa ser do mesmo tipo e do mesmo tamanho.");
      return;
    }

    const precoMeiaPizza = Number(
      ((primeiraMetadePizza.preco + produto.preco) / 2).toFixed(2)
    );

    const novoItem: CartItem = {
      id: uid(),
      produtoId: `${primeiraMetadePizza.id}+${produto.id}`,
      produtoIdsMetade: [primeiraMetadePizza.id, produto.id],
      codigo: `${primeiraMetadePizza.codigo}/${produto.codigo}`,
      nome: `1/2 ${primeiraMetadePizza.nome} + 1/2 ${produto.nome}`,
      categoria: produto.categoria || primeiraMetadePizza.categoria,
      grupo: "Pizza",
      subgrupo: produto.subgrupo || primeiraMetadePizza.subgrupo,
      opcao: produto.opcao || primeiraMetadePizza.opcao,
      tipo: produto.tipo || primeiraMetadePizza.tipo,
      precoUnitario: precoMeiaPizza,
      quantidade: 1,
      total: precoMeiaPizza,
      porQuilo: false,
      unidade: "un",
      meiaPizza: true,
      saboresPizza: [primeiraMetadePizza.nome, produto.nome],
    };

    setCarrinho((atual) => [...atual, novoItem]);
    setPrimeiraMetadePizza(null);
  }

  function adicionarProduto(produto: ProdutoView) {
    if (produto.controlaEstoque && produto.estoque <= 0) {
      alert("Este produto está sem estoque.");
      return;
    }

    if (modoMeiaPizza && produtoEhPizza(produto)) {
      adicionarProdutoMeiaPizza(produto);
      return;
    }

    if (produto.porQuilo) {
      setPesoModal({
        produto,
        peso: "",
      });
      return;
    }

    setCarrinho((atual) => {
      const existe = atual.find(
        (item) => item.produtoId === produto.id && !item.porQuilo
      );

      if (existe) {
        return atual.map((item) => {
          if (item.id !== existe.id) return item;

          const atualizado = {
            ...item,
            quantidade: item.quantidade + 1,
          };

          return {
            ...atualizado,
            total: calcularTotalItem(atualizado),
          };
        });
      }

      const novoItem: CartItem = {
        id: uid(),
        produtoId: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        categoria: produto.categoria,
        grupo: produto.grupo,
        subgrupo: produto.subgrupo,
        opcao: produto.opcao,
        tipo: produto.tipo,
        precoUnitario: produto.preco,
        quantidade: 1,
        total: produto.preco,
        porQuilo: false,
        unidade: "un",
      };

      return [...atual, novoItem];
    });
  }

  function confirmarPeso() {
    if (!pesoModal) return;

    const peso = asNumber(pesoModal.peso);

    if (peso <= 0) {
      alert("Informe um peso válido.");
      return;
    }

    const novoItem: CartItem = {
      id: uid(),
      produtoId: pesoModal.produto.id,
      codigo: pesoModal.produto.codigo,
      nome: pesoModal.produto.nome,
      categoria: pesoModal.produto.categoria,
      grupo: pesoModal.produto.grupo,
      subgrupo: pesoModal.produto.subgrupo,
      opcao: pesoModal.produto.opcao,
      tipo: pesoModal.produto.tipo,
      precoUnitario: pesoModal.produto.preco,
      quantidade: peso,
      total: Number((pesoModal.produto.preco * peso).toFixed(2)),
      porQuilo: true,
      unidade: "kg",
    };

    setCarrinho((atual) => [...atual, novoItem]);
    setPesoModal(null);
  }

  function aumentarItem(itemId: string) {
    setCarrinho((atual) =>
      atual.map((item) => {
        if (item.id !== itemId) return item;

        const atualizado = {
          ...item,
          quantidade: item.porQuilo
            ? Number((item.quantidade + 0.1).toFixed(3))
            : item.quantidade + 1,
        };

        return {
          ...atualizado,
          total: calcularTotalItem(atualizado),
        };
      })
    );
  }

  function diminuirItem(itemId: string) {
    setCarrinho((atual) =>
      atual
        .map((item) => {
          if (item.id !== itemId) return item;

          const novaQuantidade = item.porQuilo
            ? Number((item.quantidade - 0.1).toFixed(3))
            : item.quantidade - 1;

          const atualizado = {
            ...item,
            quantidade: novaQuantidade,
          };

          return {
            ...atualizado,
            total: calcularTotalItem(atualizado),
          };
        })
        .filter((item) => item.quantidade > 0)
    );
  }

  function removerItem(itemId: string) {
    setCarrinho((atual) => atual.filter((item) => item.id !== itemId));
  }

  function limparVenda() {
    if (carrinho.length === 0) return;

    const confirmar = confirm("Deseja limpar todos os itens desta venda?");

    if (!confirmar) return;

    setCarrinho([]);
    setValorRecebido("");
    setDescontoReais("");
    setCorrentistaSelecionadoId("");
    setPrimeiraMetadePizza(null);

    if (!atendimentoAtual) {
      setCliente("");
    }
  }

  function removerVinculoAtendimento() {
    const confirmar = confirm("Deseja remover o vínculo com esta mesa?");

    if (!confirmar) return;

    localStorage.removeItem(LS_ATENDIMENTO_ATUAL);
    setAtendimentoAtual(null);
    setCliente("");
  }

  function abrirPagamento() {
    if (carrinho.length === 0) {
      alert("Adicione pelo menos um item antes de pagar.");
      return;
    }

    if (!caixaAberto) {
      setMostrarAberturaCaixa(true);
      return;
    }

    setMostrarPagamento(true);
  }

  async function baixarEstoqueDosProdutos() {
    const produtosOriginais = safeJsonArray<ProdutoRaw>(
      localStorage.getItem(LS_PRODUTOS)
    );

    if (produtosOriginais.length === 0) return;

    const atualizados = produtosOriginais.map((produtoRaw, index) => {
      const produtoView = getProdutoView(produtoRaw, index);

      const itensVendidos = carrinho.filter(
        (item) =>
          item.produtoId === produtoView.id ||
          item.produtoIdsMetade?.includes(produtoView.id)
      );

      if (itensVendidos.length === 0) return produtoRaw;

      const deveBaixar =
        produtoRaw.controlaEstoque === true ||
        produtoRaw.temEstoque === true ||
        produtoRaw.baixarEstoque === true;

      if (!deveBaixar) return produtoRaw;

      const quantidadeVendida = itensVendidos.reduce((total, item) => {
        const quantidadeItem = item.meiaPizza ? item.quantidade * 0.5 : item.quantidade;
        return total + quantidadeItem;
      }, 0);

      const estoqueAtual = asNumber(produtoRaw.estoque);
      const novoEstoque = Math.max(estoqueAtual - quantidadeVendida, 0);

      return {
        ...produtoRaw,
        estoque: novoEstoque,
      };
    });

    try {
      await salvarProdutos(atualizados);
    } catch (error) {
      console.error("Erro ao atualizar estoque dos produtos no Supabase:", error);
      localStorage.setItem(LS_PRODUTOS, JSON.stringify(atualizados));
    }

    const produtosMapeados = atualizados
      .map((produto, index) => getProdutoView(produto, index))
      .filter((produto) => produto.ativo);

    setProdutos(produtosMapeados);
  }

  function lancarNaMesa() {
    if (!atendimentoAtual || atendimentoAtual.tipo === "Balcão") {
      alert("Este atendimento não está vinculado a mesa ou comanda.");
      return;
    }

    if (carrinho.length === 0) {
      alert("Adicione pelo menos um item antes de lançar o consumo.");
      return;
    }

    const agora = new Date();

    if (atendimentoAtual.tipo === "Mesa") {
      if (!atendimentoAtual.mesaId || !atendimentoAtual.mesaNumero) {
        alert("Dados da mesa não encontrados.");
        return;
      }

      const consumosAtuais = safeJsonArray<MesaConsumo>(
        localStorage.getItem(LS_MESA_CONSUMOS)
      );

      const consumosSemEstaMesa = consumosAtuais.filter(
        (consumo) =>
          !(
            consumo.mesaId === atendimentoAtual.mesaId &&
            consumo.status === "Aberto"
          )
      );

      const consumoExistente = consumosAtuais.find(
        (consumo) =>
          consumo.mesaId === atendimentoAtual.mesaId &&
          consumo.status === "Aberto"
      );

      const novoConsumo: MesaConsumo = {
        id: consumoExistente?.id || uid(),
        mesaId: atendimentoAtual.mesaId,
        mesaNumero: atendimentoAtual.mesaNumero,
        cliente: cliente || atendimentoAtual.cliente || "Não identificado",
        pessoas: atendimentoAtual.pessoas || 1,
        status: "Aberto",
        itens: carrinho,
        total: totalBruto,
        criadoEm: consumoExistente?.criadoEm || agora.toISOString(),
        atualizadoEm: agora.toISOString(),
      };

      localStorage.setItem(
        LS_MESA_CONSUMOS,
        JSON.stringify([novoConsumo, ...consumosSemEstaMesa])
      );

      alert(`Consumo lançado na mesa ${atendimentoAtual.mesaNumero}.`);
      window.location.href = "/pdv/mesa";
      return;
    }

    if (atendimentoAtual.tipo === "Comanda") {
      if (!atendimentoAtual.comandaId) {
        alert("Dados da comanda não encontrados.");
        return;
      }

      const consumosAtuais = safeJsonArray<ComandaConsumo>(
        localStorage.getItem(LS_COMANDA_CONSUMOS)
      );

      const consumosSemEstaComanda = consumosAtuais.filter(
        (consumo) =>
          !(
            consumo.comandaId === atendimentoAtual.comandaId &&
            consumo.status === "Aberto"
          )
      );

      const consumoExistente = consumosAtuais.find(
        (consumo) =>
          consumo.comandaId === atendimentoAtual.comandaId &&
          consumo.status === "Aberto"
      );

      const novoConsumo: ComandaConsumo = {
        id: consumoExistente?.id || uid(),
        comandaId: atendimentoAtual.comandaId,
        comandaNome: atendimentoAtual.comandaNome || cliente || "Comanda",
        documento: atendimentoAtual.documento || "",
        cliente: cliente || atendimentoAtual.cliente || "Não identificado",
        status: "Aberto",
        itens: carrinho,
        total: totalBruto,
        criadoEm: consumoExistente?.criadoEm || agora.toISOString(),
        atualizadoEm: agora.toISOString(),
      };

      localStorage.setItem(
        LS_COMANDA_CONSUMOS,
        JSON.stringify([novoConsumo, ...consumosSemEstaComanda])
      );

      alert(`Consumo lançado na comanda ${novoConsumo.comandaNome}.`);
      window.location.href = "/pdv/comanda";
    }
  }

  function removerConsumoDepoisDoPagamento() {
    if (!atendimentoAtual || atendimentoAtual.tipo === "Balcão") {
      return;
    }

    if (atendimentoAtual.tipo === "Mesa") {
      if (!atendimentoAtual.mesaId) return;

      const consumosAtuais = safeJsonArray<MesaConsumo>(
        localStorage.getItem(LS_MESA_CONSUMOS)
      );

      const consumosAtualizados = consumosAtuais.filter(
        (consumo) =>
          !(
            consumo.mesaId === atendimentoAtual.mesaId &&
            consumo.status === "Aberto"
          )
      );

      localStorage.setItem(LS_MESA_CONSUMOS, JSON.stringify(consumosAtualizados));

      const mesasAtuais = safeJsonArray<Record<string, unknown>>(
        localStorage.getItem(LS_MESAS)
      );

      const mesasAtualizadas = mesasAtuais.map((mesa) => {
        if (String(mesa.id) !== String(atendimentoAtual.mesaId)) {
          return mesa;
        }

        return {
          ...mesa,
          status: "Livre",
          cliente: "",
          pessoas: 0,
          abertaEm: "",
          observacao: "",
        };
      });

      localStorage.setItem(LS_MESAS, JSON.stringify(mesasAtualizadas));
      return;
    }

    if (atendimentoAtual.tipo === "Comanda") {
      if (!atendimentoAtual.comandaId) return;

      const consumosAtuais = safeJsonArray<ComandaConsumo>(
        localStorage.getItem(LS_COMANDA_CONSUMOS)
      );

      const consumosAtualizados = consumosAtuais.filter(
        (consumo) =>
          !(
            consumo.comandaId === atendimentoAtual.comandaId &&
            consumo.status === "Aberto"
          )
      );

      localStorage.setItem(
        LS_COMANDA_CONSUMOS,
        JSON.stringify(consumosAtualizados)
      );

      const comandasAtuais = safeJsonArray<Record<string, unknown>>(
        localStorage.getItem(LS_COMANDAS)
      );

      const comandasAtualizadas = comandasAtuais.filter(
        (comanda) => String(comanda.id) !== String(atendimentoAtual.comandaId)
      );

      localStorage.setItem(LS_COMANDAS, JSON.stringify(comandasAtualizadas));
    }
  }

  async function finalizarVenda() {
    if (!caixaAtual || caixaAtual.status !== "Aberto") {
      alert("Abra o caixa antes de finalizar a venda.");
      setMostrarPagamento(false);
      setMostrarAberturaCaixa(true);
      return;
    }

    if (carrinho.length === 0) {
      alert("Adicione pelo menos um item antes de finalizar.");
      return;
    }

    if (formaPagamento === "Dinheiro") {
      const recebido = asNumber(valorRecebido);

      if (recebido < valorCobrar) {
        alert("O valor recebido em dinheiro é menor que o valor a cobrar.");
        return;
      }
    }

    if (formaPagamento === "Correntista" && !correntistaSelecionado) {
      alert("Selecione o correntista antes de finalizar a venda por conta.");
      return;
    }

    if (formaPagamento === "Dividido") {
      if (pagamentosCalculados.length < 2) {
        alert("Para rachar a conta, informe pelo menos duas formas de pagamento.");
        return;
      }

      if (Math.abs(diferencaPagamentoDividido) > 0.01) {
        alert(
          `A soma dos pagamentos precisa fechar exatamente o valor a cobrar.

Valor a cobrar: ${money(
            valorCobrar
          )}
Informado: ${money(totalPagamentosDivididos)}
Falta/sobra: ${money(
            diferencaPagamentoDividido
          )}`
        );
        return;
      }
    }

    const vendaId = uid();
    const agora = new Date();
    const pagamentosVenda = pagamentosCalculados.map((pagamento) => ({
      ...pagamento,
      id: uid(),
    }));
    const formaRecebimentoFinal =
      formaPagamento === "Dividido" ? "Dividido" : formaPagamento;
    const formaDetalhada = descricaoPagamentos(pagamentosVenda);

    const descricaoItens = carrinho
      .map((item) => `${item.quantidade} ${item.unidade} - ${item.nome}`)
      .join(" | ");

    const dadosColaborador = colaboradorSelecionado
      ? {
          colaboradorId: colaboradorSelecionado.id,
          colaboradorNome: colaboradorSelecionado.nome,
          colaboradorPercentual: asNumber(colaboradorSelecionado.percentualComissao),
        }
      : {
          colaboradorId: "",
          colaboradorNome: "",
          colaboradorPercentual: 0,
        };

    const entradasAtuais = safeJsonArray<ProdutoRaw>(
      localStorage.getItem(LS_ENTRADAS)
    );

    const novaEntrada = {
      id: vendaId,
      caixaId: caixaAtual.id,
      atendimentoTipo: tipoAtendimento,
      mesaId: atendimentoAtual?.mesaId || "",
      mesaNumero: atendimentoAtual?.mesaNumero || "",
      comandaId: atendimentoAtual?.comandaId || "",
      comandaNome: atendimentoAtual?.comandaNome || "",
      data: todayInputDate(),
      categoria:
        tipoAtendimento === "Mesa"
          ? "Venda Mesa"
          : tipoAtendimento === "Comanda"
          ? "Venda Comanda"
          : "Venda PDV",
      descricao:
        tipoAtendimento === "Mesa"
          ? `Venda Mesa ${atendimentoAtual?.mesaNumero} - ${descricaoItens}`
          : tipoAtendimento === "Comanda"
          ? `Venda Comanda ${atendimentoAtual?.comandaNome || ""} - ${descricaoItens}`
          : `Venda PDV - ${descricaoItens}`,
      formaRecebimento: formaRecebimentoFinal,
      formaPagamento: formaRecebimentoFinal,
      forma: formaRecebimentoFinal,
      formaPagamentoDetalhada: formaDetalhada,
      pagamentos: pagamentosVenda,
      valorOriginal: totalBruto,
      subtotalItens: totalBruto,
      descontoValor: descontoNumerico,
      valorBruto: valorCobrar,
      valorCobrado: valorCobrar,
      taxaPercentual,
      taxaDescontada: valorTaxa,
      valorLiquido,
      valor: valorLiquido,
      origem: "PDV",
      cliente: consumidorVenda,
      operador: caixaAtual.operador,
      ...dadosColaborador,
      criadoEm: agora.toISOString(),
    };

    localStorage.setItem(
      LS_ENTRADAS,
      JSON.stringify([novaEntrada, ...entradasAtuais])
    );

    const vendasAtuais = safeJsonArray<ProdutoRaw>(
      localStorage.getItem(LS_VENDAS_DETALHADAS)
    );

    const novaVendaDetalhada = {
      id: vendaId,
      caixaId: caixaAtual.id,
      atendimentoTipo: tipoAtendimento,
      mesaId: atendimentoAtual?.mesaId || "",
      mesaNumero: atendimentoAtual?.mesaNumero || "",
      comandaId: atendimentoAtual?.comandaId || "",
      comandaNome: atendimentoAtual?.comandaNome || "",
      data: todayInputDate(),
      dataHora: agora.toISOString(),
      operador: caixaAtual.operador,
      tipoVenda: tipoAtendimento,
      status: "Finalizado",
      tipoDocumento: "Gerencial",
      consumidor: consumidorVenda,
      formaPagamento: formaRecebimentoFinal,
      formaPagamentoDetalhada: formaDetalhada,
      pagamentos: pagamentosVenda,
      totalItens,
      valorOriginal: totalBruto,
      subtotalItens: totalBruto,
      descontoValor: descontoNumerico,
      valorBruto: valorCobrar,
      valorCobrado: valorCobrar,
      taxaPercentual,
      taxaDescontada: valorTaxa,
      valorLiquido,
      valor: valorLiquido,
      itens: carrinho,
      ...dadosColaborador,
    };

    localStorage.setItem(
      LS_VENDAS_DETALHADAS,
      JSON.stringify([novaVendaDetalhada, ...vendasAtuais])
    );

    let novaContaReceber: ProdutoRaw | null = null;

    if (formaPagamento === "Correntista" && correntistaSelecionado) {
      const contasAtuais = safeJsonArray<ProdutoRaw>(
        localStorage.getItem(LS_CONTAS_RECEBER)
      );

      novaContaReceber = {
        id: uid(),
        vendaId,
        data: todayInputDate(),
        cliente: correntistaSelecionado.nome,
        correntistaId: correntistaSelecionado.id,
        categoria: "Correntista",
        formaPrevista: "Correntista",
        descricao: `Venda PDV por conta - ${descricaoItens}`,
        status: "Pendente",
        valor: valorCobrar,
        valorOriginal: totalBruto,
        descontoValor: descontoNumerico,
        criadoEm: agora.toISOString(),
      };

      localStorage.setItem(
        LS_CONTAS_RECEBER,
        JSON.stringify([novaContaReceber, ...contasAtuais])
      );

      const correntistasAtuais = safeJsonArray<Correntista>(
        localStorage.getItem(LS_CORRENTISTAS)
      );

      const correntistasAtualizados = correntistasAtuais.map((correntista) => {
        if (correntista.id !== correntistaSelecionado.id) return correntista;

        return {
          ...correntista,
          saldoAberto: asNumber(correntista.saldoAberto) + valorCobrar,
          atualizadoEm: agora.toISOString(),
        };
      });

      localStorage.setItem(
        LS_CORRENTISTAS,
        JSON.stringify(correntistasAtualizados)
      );
    }

    try {
      await salvarVendaFinanceiroSupabase({
        entrada: novaEntrada,
        vendaDetalhada: novaVendaDetalhada,
        contaReceber: novaContaReceber,
      });
    } catch (error) {
      console.error("Venda salva localmente, mas não foi enviada ao Supabase.", error);
      alert("A venda foi finalizada neste caixa, mas não foi enviada ao Supabase. Verifique conexão, variáveis da Vercel e se o SQL do patch já foi executado.");
    }

    await baixarEstoqueDosProdutos();
    removerConsumoDepoisDoPagamento();

    setCarrinho([]);
    setPrimeiraMetadePizza(null);
    setCliente("");
    setValorRecebido("");
    setDescontoReais("");
    setCorrentistaSelecionadoId("");
    setColaboradorSelecionadoId("");
    setPagamentosDivididos({
      Dinheiro: "",
      PIX: "",
      Débito: "",
      Crédito: "",
      Correntista: "",
    });
    setFormaPagamento("Dinheiro");
    setMostrarPagamento(false);

    localStorage.removeItem(LS_ATENDIMENTO_ATUAL);
    setAtendimentoAtual(null);

    alert("Venda finalizada com sucesso.");
  }


  function gerarHtmlContaAtual() {
    const agora = new Date();

    const identificacaoAtendimento =
      atendimentoAtual?.tipo === "Mesa"
        ? `Mesa nº ${atendimentoAtual.mesaNumero}`
        : atendimentoAtual?.tipo === "Comanda"
        ? `Comanda ${atendimentoAtual.comandaNome || ""}`
        : "Balcão";

    const itensHtml = carrinho
      .map((item) => {
        const quantidade = item.porQuilo
          ? `${item.quantidade.toFixed(3)} kg`
          : `${item.quantidade} un`;

        return `
          <tr>
            <td>
              <strong>${escapeHtml(item.nome)}</strong>
              <small>${escapeHtml(quantidade)} x ${money(item.precoUnitario)}</small>
            </td>
            <td class="right">${money(item.total)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Conta</title>
          <style>
            * { box-sizing: border-box; }
            body {
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
              color: #000;
              background: #fff;
              font-size: 12px;
            }
            h1, h2, p { margin: 0; }
            .center { text-align: center; }
            .header {
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .restaurant {
              font-size: 16px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .cnpj {
              margin-top: 3px;
              font-size: 11px;
              font-weight: 700;
            }
            .type {
              margin-top: 6px;
              font-size: 22px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .info {
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            td {
              padding: 6px 0;
              vertical-align: top;
              border-bottom: 1px dashed #ccc;
            }
            small {
              display: block;
              margin-top: 2px;
              font-size: 11px;
            }
            .right {
              text-align: right;
              white-space: nowrap;
              font-weight: 900;
            }
            .total {
              margin-top: 10px;
              padding: 10px;
              border: 2px solid #000;
              text-align: center;
            }
            .total span {
              display: block;
              font-size: 12px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .total strong {
              display: block;
              margin-top: 4px;
              font-size: 28px;
              font-weight: 900;
            }
            .footer {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 1px dashed #000;
              text-align: center;
              font-size: 10px;
            }
            @media print {
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="header center">
            <p class="restaurant">Samambaia Restaurante e Pizzaria</p>
            <p class="cnpj">CNPJ: 44.824.459/0001-85</p>
            <p class="type">${escapeHtml(identificacaoAtendimento)}</p>
          </div>

          <div class="info">
            <p><strong>Data:</strong> ${escapeHtml(agora.toLocaleString("pt-BR"))}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(
              cliente || atendimentoAtual?.cliente || "Não identificado"
            )}</p>
            <p><strong>Operador:</strong> ${escapeHtml(caixaAtual?.operador || "Adm")}</p>
          </div>

          <table>
            <tbody>${itensHtml}</tbody>
          </table>

          <div class="total">
            <span>Valor a cobrar</span>
            <strong>${money(valorCobrar)}</strong>
          </div>

          <div class="footer">
            <p>Conferência de consumo</p>
            <p>Não é documento fiscal</p>
          </div>
        </body>
      </html>
    `;
  }

  function gerarHtmlPedidoCozinhaAtual() {
    const agora = new Date();

    const identificacaoAtendimento =
      atendimentoAtual?.tipo === "Mesa"
        ? `Mesa nº ${atendimentoAtual.mesaNumero}`
        : atendimentoAtual?.tipo === "Comanda"
        ? `Comanda ${atendimentoAtual.comandaNome || ""}`
        : "Balcão";

    const itensHtml = carrinho
      .map((item) => {
        const quantidade = item.porQuilo
          ? `${item.quantidade.toFixed(3)} kg`
          : `${item.quantidade} un`;

        return `
          <tr>
            <td class="qty">${escapeHtml(quantidade)}</td>
            <td>
              <strong>${escapeHtml(item.nome)}</strong>
              <small>${escapeHtml(item.categoria || item.tipo || "")}</small>
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Pedido cozinha</title>
          <style>
            * { box-sizing: border-box; }
            body {
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
              color: #000;
              background: #fff;
              font-size: 13px;
            }
            h1, h2, p { margin: 0; }
            .center { text-align: center; }
            .header {
              border-bottom: 2px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .restaurant {
              font-size: 14px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .cnpj {
              margin-top: 3px;
              font-size: 10px;
              font-weight: 700;
            }
            .type {
              margin-top: 8px;
              font-size: 26px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .place {
              margin-top: 4px;
              font-size: 22px;
              font-weight: 900;
              text-transform: uppercase;
            }
            .info {
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            td {
              padding: 8px 0;
              vertical-align: top;
              border-bottom: 1px dashed #999;
            }
            .qty {
              width: 25mm;
              font-size: 18px;
              font-weight: 900;
              white-space: nowrap;
            }
            strong {
              display: block;
              font-size: 17px;
              font-weight: 900;
              text-transform: uppercase;
            }
            small {
              display: block;
              margin-top: 2px;
              font-size: 10px;
            }
            .footer {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 2px dashed #000;
              text-align: center;
              font-size: 11px;
              font-weight: 900;
            }
            @media print {
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="header center">
            <p class="restaurant">Samambaia Restaurante e Pizzaria</p>
            <p class="cnpj">CNPJ: 44.824.459/0001-85</p>
            <p class="type">Pedido cozinha</p>
            <p class="place">${escapeHtml(identificacaoAtendimento)}</p>
          </div>

          <div class="info">
            <p><strong>Data:</strong> ${escapeHtml(agora.toLocaleString("pt-BR"))}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(
              cliente || atendimentoAtual?.cliente || "Não identificado"
            )}</p>
            <p><strong>Operador:</strong> ${escapeHtml(caixaAtual?.operador || "Adm")}</p>
          </div>

          <table>
            <tbody>${itensHtml}</tbody>
          </table>

          <div class="footer">
            <p>Pedido para produção</p>
            <p>Sem valores para cozinha</p>
          </div>
        </body>
      </html>
    `;
  }

  function imprimirHtml(html: string) {
    const janela = window.open("", "_blank", "width=420,height=700");

    if (!janela) {
      alert("Não foi possível abrir a janela de impressão.");
      return;
    }

    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    janela.focus();

    setTimeout(() => {
      janela.print();
      janela.close();
    }, 300);
  }

  function imprimirContaAtual() {
    if (carrinho.length === 0) {
      alert("Adicione pelo menos um item antes de imprimir.");
      return;
    }

    imprimirHtml(gerarHtmlContaAtual());
  }

  function imprimirPedidoCozinhaAtual() {
    if (carrinho.length === 0) {
      alert("Adicione pelo menos um item antes de imprimir o pedido da cozinha.");
      return;
    }

    imprimirHtml(gerarHtmlPedidoCozinhaAtual());
  }

  async function sairDoSistema() {
    const confirmar = confirm("Deseja sair do sistema neste computador?");

    if (!confirmar) return;

    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem("gestor-restaurante-usuario");
    window.location.href = "/login";
  }

  async function abrirPainelAdmin() {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem("gestor-restaurante-usuario");
    window.location.href = "/login?adm=1&redirect=/";
  }

  return (
    <main className="min-h-screen bg-[#f7f3ee] text-[#1a1a1a]">
      <div className="flex min-h-screen">
        <aside className="w-[140px] shrink-0 bg-[#111111] text-white">
          <div className="flex h-20 items-center gap-2 border-b border-white/10 px-3">
            <img
              src="/logo-01.png"
              alt="Logo"
              className="h-10 w-10 object-contain"
            />
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-wide text-white/70">
                Usuário
              </p>
              <p className="text-base font-bold text-white">
                {usuarioSistema?.nome || "Usuário"}
              </p>
              <p className="text-[10px] font-bold uppercase text-[#f97316]">
                {usuarioSistema?.perfil || ""}
              </p>
            </div>
          </div>

          <nav className="mt-3 space-y-1 px-2">
            <a
              href="/pdv"
              className="flex w-full items-center gap-2 rounded-md bg-[#f97316] px-3 py-3 text-left text-sm font-bold text-white"
            >
              <span className="text-lg">🧾</span>
              Balcão
            </a>

            <a
              href="/pdv/comanda"
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">💳</span>
              Comanda
            </a>

            <a
              href="/pdv/mesa"
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">🍽️</span>
              Mesa
            </a>

            <button className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm text-white/40">
              <span className="text-lg">🛵</span>
              Delivery
            </button>

            <a
              href="/pdv/operacoes-caixa"
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">🏦</span>
              Caixa
            </a>

            <a
              href="/pdv/operacoes-caixa"
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">📋</span>
              Operações
            </a>

            <button className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]">
              <span className="text-lg">🤝</span>
              Clientes
            </button>

            <button
              type="button"
              onClick={abrirPainelAdmin}
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">🔐</span>
              Painel
            </button>

            <button
              type="button"
              onClick={sairDoSistema}
              className="mt-4 flex w-full items-center gap-2 rounded-md border border-red-500/40 px-3 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-500/10"
            >
              <span className="text-lg">🚪</span>
              Sair
            </button>
          </nav>
        </aside>

        <section className="flex min-h-screen flex-1">
          <div className="flex-1 p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f1d2ba] bg-white px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {tipoAtendimento === "Mesa"
                    ? "PDV Mesa"
                    : tipoAtendimento === "Comanda"
                    ? "PDV Comanda"
                    : "PDV Balcão"}
                </p>
                <h1 className="text-xl font-black text-[#111111]">
                  Samambaia Restaurante e Pizzaria
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {atendimentoAtual?.tipo === "Mesa" && (
                  <div className="rounded-xl bg-[#111111] px-4 py-2 text-sm font-black text-[#f97316]">
                    Mesa nº {atendimentoAtual.mesaNumero}
                  </div>
                )}

                {atendimentoAtual?.tipo === "Comanda" && (
                  <div className="rounded-xl bg-[#111111] px-4 py-2 text-sm font-black text-[#f97316]">
                    Comanda {atendimentoAtual.comandaNome || cliente}
                  </div>
                )}

                <div
                  className={`rounded-xl px-4 py-2 text-sm font-black ${
                    caixaAberto
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {caixaAberto ? "Caixa aberto" : "Caixa fechado"}
                </div>

                {caixaAberto ? (
                  <div className="text-right text-xs font-semibold text-slate-600">
                    <p>Operador: {caixaAtual?.operador}</p>
                    <p>Abertura: {formatDateTime(caixaAtual?.abertoEm || "")}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setMostrarAberturaCaixa(true)}
                    className="rounded-xl bg-[#f97316] px-5 py-3 text-sm font-black uppercase text-white hover:bg-[#ea580c]"
                  >
                    Abrir caixa
                  </button>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-[#111111]">
                Categorias
              </h2>
              <div className="mt-2 h-1 w-20 rounded bg-[#f97316]" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-5">
              {categorias.map((categoria) => {
                const selecionada = categoria === categoriaSelecionada;

                return (
                  <button
                    key={categoria}
                    onClick={() => {
                      setCategoriaSelecionada(categoria);
                      setBusca("");
                    }}
                    className={`min-h-[64px] rounded-lg border-2 px-3 py-3 text-sm font-bold uppercase transition ${
                      selecionada
                        ? "border-[#f97316] bg-[#111111] text-[#f97316]"
                        : "border-[#f1d2ba] bg-white text-[#222222] hover:border-[#f97316] hover:bg-[#fff4eb]"
                    }`}
                  >
                    {categoria}
                  </button>
                );
              })}
            </div>

            {gruposDisponiveis.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-[#111111]">
                  {categoriaSelecionada} — escolha o tipo
                </h2>
                <div className="mt-2 h-1 w-24 rounded bg-[#f97316]" />

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                  {gruposDisponiveis.map((grupo) => {
                    const selecionado = grupo === grupoSelecionado;

                    return (
                      <button
                        key={grupo}
                        onClick={() => setGrupoSelecionado(grupo)}
                        className={`min-h-[64px] rounded-lg border-2 px-3 py-3 text-sm font-bold uppercase transition ${
                          selecionado
                            ? "border-[#f97316] bg-[#111111] text-[#f97316]"
                            : "border-[#f1d2ba] bg-white text-[#222222] hover:border-[#f97316] hover:bg-[#fff4eb]"
                        }`}
                      >
                        {grupo}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {grupoSelecionado && subgruposDisponiveis.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-[#111111]">
                  {grupoSelecionado === "Pizza" ? "Categoria da pizza" : `${grupoSelecionado} — escolha uma opção`}
                </h2>
                <div className="mt-2 h-1 w-24 rounded bg-[#f97316]" />

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                  {subgruposDisponiveis.map((subgrupo) => {
                    const selecionado = subgrupo === subgrupoSelecionado;

                    return (
                      <button
                        key={subgrupo}
                        onClick={() => setSubgrupoSelecionado(subgrupo)}
                        className={`min-h-[64px] rounded-lg border-2 px-3 py-3 text-sm font-bold uppercase transition ${
                          selecionado
                            ? "border-[#f97316] bg-[#111111] text-[#f97316]"
                            : "border-[#f1d2ba] bg-white text-[#222222] hover:border-[#f97316] hover:bg-[#fff4eb]"
                        }`}
                      >
                        {subgrupo}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {subgrupoSelecionado && opcoesDisponiveis.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-[#111111]">
                  {grupoSelecionado === "Pizza" ? "Tamanho da pizza" : `${subgrupoSelecionado} — escolha a variação`}
                </h2>
                <div className="mt-2 h-1 w-24 rounded bg-[#f97316]" />

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                  {opcoesDisponiveis.map((opcao) => {
                    const selecionada = opcao === opcaoSelecionada;

                    return (
                      <button
                        key={opcao}
                        onClick={() => setOpcaoSelecionada(opcao)}
                        className={`min-h-[64px] rounded-lg border-2 px-3 py-3 text-sm font-bold uppercase transition ${
                          selecionada
                            ? "border-[#f97316] bg-[#111111] text-[#f97316]"
                            : "border-[#f1d2ba] bg-white text-[#222222] hover:border-[#f97316] hover:bg-[#fff4eb]"
                        }`}
                      >
                        {opcao}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {grupoSelecionado === "Pizza" &&
              ["pizza de sal", "pizza doce"].includes(normalizeText(subgrupoSelecionado)) &&
              opcaoSelecionada && (
              <div className="mt-6 rounded-xl border-2 border-[#f1d2ba] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold uppercase tracking-wide text-[#111111]">
                      Meia pizza
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      Ative para escolher metade de um sabor e metade de outro.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setModoMeiaPizza((ativo) => !ativo);
                      setPrimeiraMetadePizza(null);
                    }}
                    className={`rounded-xl px-5 py-3 text-sm font-black uppercase transition ${
                      modoMeiaPizza
                        ? "bg-[#111111] text-[#f97316]"
                        : "bg-[#f97316] text-white hover:bg-[#ea580c]"
                    }`}
                  >
                    {modoMeiaPizza ? "Meia pizza ativa" : "Ativar meia pizza"}
                  </button>
                </div>

                {modoMeiaPizza && (
                  <div className="mt-3 rounded-lg bg-[#fff4eb] px-3 py-3 text-sm font-bold text-[#111111]">
                    {primeiraMetadePizza ? (
                      <>
                        1ª metade: <span className="text-[#f97316]">{primeiraMetadePizza.nome}</span>. Agora escolha o 2º sabor.
                        <button
                          type="button"
                          onClick={limparSelecaoMeiaPizza}
                          className="ml-3 text-xs font-black uppercase text-red-600"
                        >
                          trocar
                        </button>
                      </>
                    ) : (
                      "Clique no primeiro sabor da pizza. Depois clique no segundo sabor."
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-[#111111]">
                Itens / opções
              </h2>
              <div className="mt-2 h-1 w-14 rounded bg-[#f97316]" />
            </div>

            <div className="mt-4 flex max-w-[620px] overflow-hidden rounded-lg border-2 border-[#f1d2ba] bg-white">
              <div className="flex w-12 items-center justify-center text-xl text-[#f97316]">
                🔎
              </div>
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Busca pelo nome do produto ou código"
                className="h-12 flex-1 px-2 text-sm outline-none"
              />
              <button className="bg-[#f97316] px-5 text-sm font-bold text-white hover:bg-[#ea580c]">
                Busca
              </button>
            </div>

            {produtos.length === 0 ? (
              <div className="mt-10 rounded-xl border border-[#f1d2ba] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-[#111111]">
                  Nenhum produto encontrado
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Cadastre produtos em Produtos/Itens para eles aparecerem aqui
                  no PDV.
                </p>
              </div>
            ) : gruposDisponiveis.length > 0 && !grupoSelecionado && !busca.trim() ? (
              <div className="mt-10 rounded-xl border border-[#f1d2ba] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-[#111111]">
                  Escolha um tipo acima
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Primeiro clique em {categoriaSelecionada}, depois escolha o tipo para abrir os próximos cards.
                </p>
              </div>
            ) : subgruposDisponiveis.length > 0 && !subgrupoSelecionado && !busca.trim() ? (
              <div className="mt-10 rounded-xl border border-[#f1d2ba] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-[#111111]">
                  Escolha uma opção acima
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Escolha {grupoSelecionado === "Pizza" ? "Pizza de Sal, Pizza Doce, Pizza Pequena ou Pizza Gigante" : "um subgrupo"} para abrir os itens.
                </p>
              </div>
            ) : opcoesDisponiveis.length > 0 && !opcaoSelecionada && !busca.trim() ? (
              <div className="mt-10 rounded-xl border border-[#f1d2ba] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-[#111111]">
                  Escolha o tamanho acima
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Escolha {grupoSelecionado === "Pizza" ? "Grande, Média ou Pequena" : "uma variação"} para liberar os itens cadastrados.
                </p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="mt-10 rounded-xl border border-[#f1d2ba] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-[#111111]">
                  Nenhum item encontrado
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Troque o card, escolha outro subgrupo ou limpe a busca.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
                {produtosFiltrados.map((produto) => {
                  const semEstoque =
                    produto.controlaEstoque && produto.estoque <= 0;

                  const primeiraMetadeSelecionada =
                    modoMeiaPizza && primeiraMetadePizza?.id === produto.id;

                  return (
                    <button
                      key={produto.id}
                      onClick={() => adicionarProduto(produto)}
                      disabled={semEstoque}
                      className={`min-h-[110px] rounded-xl border-2 px-3 py-4 text-center shadow-sm transition ${
                        semEstoque
                          ? "border-slate-200 bg-slate-100 text-slate-400"
                          : primeiraMetadeSelecionada
                          ? "border-[#f97316] bg-[#111111] text-[#f97316]"
                          : "border-[#f1d2ba] bg-white hover:border-[#f97316] hover:bg-[#fff4eb]"
                      }`}
                    >
                      <p
                        className={`text-[15px] font-extrabold uppercase leading-tight ${
                          primeiraMetadeSelecionada ? "text-[#f97316]" : "text-[#111111]"
                        }`}
                      >
                        {produto.nome}
                      </p>
                      {(produto.subgrupo || produto.opcao) && (
                        <p className="mt-1 text-[11px] font-semibold uppercase text-slate-500">
                          {[produto.subgrupo, produto.opcao].filter(Boolean).join(" • ")}
                        </p>
                      )}
                      {primeiraMetadeSelecionada && (
                        <p className="mt-2 text-xs font-black uppercase text-white">
                          1ª metade selecionada
                        </p>
                      )}

                      <p className="mt-2 text-xl font-black text-[#f97316]">
                        {money(produto.preco)}
                      </p>

                      {produto.porQuilo && (
                        <p className="mt-1 text-xs font-semibold text-slate-600">
                          COBRADO POR KG
                        </p>
                      )}

                      {produto.controlaEstoque && (
                        <p className="mt-1 text-xs font-semibold text-slate-600">
                          ESTOQUE: {produto.estoque}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="flex w-[360px] shrink-0 flex-col border-l-2 border-[#f1d2ba] bg-[#fffaf6] p-4">
            <div className="rounded-xl border-2 border-[#f1d2ba] bg-white p-4 shadow-sm">
              {atendimentoAtual && atendimentoAtual.tipo !== "Balcão" && (
                <div className="mb-4 rounded-xl bg-[#111111] p-4 text-white">
                  <p className="text-xs font-black uppercase text-white/60">
                    Atendimento atual
                  </p>

                  <p className="mt-1 text-2xl font-black text-[#f97316]">
                    {atendimentoAtual.tipo === "Mesa"
                      ? `Mesa nº ${atendimentoAtual.mesaNumero}`
                      : `Comanda ${atendimentoAtual.comandaNome || ""}`}
                  </p>

                  <p className="mt-1 text-sm font-bold">
                    Cliente: {atendimentoAtual.cliente || "Não identificado"}
                  </p>

                  {atendimentoAtual.tipo === "Mesa" && (
                    <p className="text-sm font-bold">
                      Pessoas: {atendimentoAtual.pessoas || 0}
                    </p>
                  )}

                  {atendimentoAtual.tipo === "Comanda" &&
                    atendimentoAtual.documento && (
                      <p className="text-sm font-bold">
                        Documento: {atendimentoAtual.documento}
                      </p>
                    )}

                  <button
                    onClick={removerVinculoAtendimento}
                    className="mt-3 w-full rounded-lg bg-red-600 py-2 text-xs font-black uppercase text-white"
                  >
                    Remover vínculo
                  </button>
                </div>
              )}

              <label className="text-xs font-extrabold uppercase tracking-wide text-[#111111]">
                Cliente
              </label>
              <input
                value={cliente}
                onChange={(event) => setCliente(event.target.value)}
                placeholder="Não identificado"
                className="mt-2 h-11 w-full rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              />
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              {carrinho.length === 0 ? (
                <div className="rounded-xl border border-[#f1d2ba] bg-white p-4 text-sm text-slate-500 shadow-sm">
                  Nenhum item lançado.
                </div>
              ) : (
                <div className="space-y-3">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#f1d2ba] bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold uppercase text-[#111111]">
                            {item.nome}
                          </p>
                          {item.meiaPizza && (
                            <p className="mt-1 text-[11px] font-black uppercase text-[#f97316]">
                              Meia pizza • {item.opcao || "tamanho não informado"}
                            </p>
                          )}
                          <p className="text-xs font-medium text-slate-600">
                            {item.porQuilo
                              ? `${item.quantidade.toFixed(3)} kg x ${money(
                                  item.precoUnitario
                                )}`
                              : `${item.quantidade} un x ${money(
                                  item.precoUnitario
                                )}`}
                          </p>
                        </div>

                        <button
                          onClick={() => removerItem(item.id)}
                          className="text-base font-black text-red-600"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => diminuirItem(item.id)}
                            className="h-8 w-8 rounded-full bg-[#111111] text-lg font-black text-white"
                          >
                            -
                          </button>
                          <span className="min-w-12 text-center text-sm font-bold">
                            {item.porQuilo
                              ? item.quantidade.toFixed(3)
                              : item.quantidade}
                          </span>
                          <button
                            onClick={() => aumentarItem(item.id)}
                            className="h-8 w-8 rounded-full bg-[#f97316] text-lg font-black text-white"
                          >
                            +
                          </button>
                        </div>

                        <p className="text-base font-extrabold text-[#111111]">
                          {money(item.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border-2 border-[#f97316] bg-[#111111] p-4 text-white shadow-lg">
              <div className="flex items-center justify-between text-base">
                <span className="font-bold text-white/80">Total dos itens</span>
                <strong className="text-2xl font-black text-white">
                  {money(totalBruto)}
                </strong>
              </div>

              <div className="mt-4 rounded-xl bg-[#f97316] px-4 py-4 text-center text-[#111111]">
                <p className="text-sm font-black uppercase tracking-wide">
                  Valor a cobrar
                </p>
                <p className="mt-1 text-4xl font-black leading-none md:text-5xl">
                  {money(totalBruto)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={limparVenda}
                className="rounded-xl bg-[#2b2b2b] py-3 text-base font-bold text-white hover:bg-[#1f1f1f]"
              >
                Limpar
              </button>

              <button
                onClick={imprimirContaAtual}
                className="rounded-xl border-2 border-[#f97316] bg-white py-3 text-base font-bold text-[#f97316] hover:bg-[#fff4eb]"
              >
                Conta
              </button>
            </div>

            <button
              onClick={imprimirPedidoCozinhaAtual}
              className="mt-3 rounded-xl bg-[#111111] py-3 text-base font-black uppercase tracking-wide text-[#f97316] hover:bg-[#232323]"
            >
              Imprimir cozinha
            </button>

            {atendimentoAtual && atendimentoAtual.tipo !== "Balcão" && (
              <button
                onClick={lancarNaMesa}
                className="mt-4 rounded-xl bg-[#111111] py-4 text-lg font-black uppercase tracking-wide text-[#f97316] shadow-lg hover:bg-[#232323]"
              >
                {atendimentoAtual.tipo === "Mesa"
                  ? "Lançar na mesa"
                  : "Lançar na comanda"}
              </button>
            )}

            <button
              onClick={abrirPagamento}
              className="mt-3 rounded-xl bg-[#f97316] py-4 text-xl font-black uppercase tracking-wide text-white shadow-lg hover:bg-[#ea580c]"
            >
              Pagar
            </button>
          </aside>
        </section>
      </div>

      {mostrarAberturaCaixa && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20">
          <div className="w-[460px] rounded-2xl border-2 border-[#f97316] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase text-[#111111]">
                {caixaAberto ? "Caixa aberto" : "Abrir caixa"}
              </h2>

              <button
                onClick={() => setMostrarAberturaCaixa(false)}
                className="text-2xl font-black text-[#111111]"
              >
                ✕
              </button>
            </div>

            {caixaAberto ? (
              <div className="mt-5 rounded-xl border-2 border-green-200 bg-green-50 p-4">
                <p className="text-sm font-black uppercase text-green-700">
                  O caixa já está aberto.
                </p>

                <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                  <p>
                    Operador:{" "}
                    <strong className="text-[#111111]">
                      {caixaAtual?.operador}
                    </strong>
                  </p>
                  <p>
                    Valor de abertura:{" "}
                    <strong className="text-[#111111]">
                      {money(caixaAtual?.valorAbertura || 0)}
                    </strong>
                  </p>
                  <p>
                    Aberto em:{" "}
                    <strong className="text-[#111111]">
                      {formatDateTime(caixaAtual?.abertoEm || "")}
                    </strong>
                  </p>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  O fechamento do caixa será feito em Operações de Caixa.
                </p>

                <button
                  onClick={() => setMostrarAberturaCaixa(false)}
                  className="mt-5 w-full rounded-xl bg-[#f97316] py-3 text-base font-black uppercase text-white"
                >
                  Continuar vendendo
                </button>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm text-slate-600">
                  Para finalizar vendas no PDV, primeiro abra o caixa do dia.
                </p>

                <div className="mt-5">
                  <label className="text-sm font-extrabold uppercase text-[#111111]">
                    Operador
                  </label>
                  <input
                    value={operadorCaixa}
                    onChange={(event) => setOperadorCaixa(event.target.value)}
                    placeholder="Ex: Adm, Caixa1"
                    className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-sm font-extrabold uppercase text-[#111111]">
                    Valor inicial / troco
                  </label>
                  <input
                    value={valorAbertura}
                    onChange={(event) => setValorAbertura(event.target.value)}
                    placeholder="R$0,00"
                    className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                  />
                </div>

                <div className="mt-5 rounded-xl bg-[#111111] p-4 text-white">
                  <p className="text-xs font-black uppercase text-white/70">
                    Resumo
                  </p>
                  <div className="mt-2 flex justify-between text-base">
                    <span>Valor de abertura</span>
                    <strong className="text-xl text-[#f97316]">
                      {money(asNumber(valorAbertura))}
                    </strong>
                  </div>
                </div>

                <button
                  onClick={abrirCaixa}
                  className="mt-5 w-full rounded-xl bg-[#f97316] py-4 text-lg font-black uppercase text-white hover:bg-[#ea580c]"
                >
                  Abrir caixa
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {pesoModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24">
          <div className="w-[380px] rounded-2xl border-2 border-[#f1d2ba] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase text-[#111111]">
                Item cobrado por peso
              </h2>
              <button
                onClick={() => setPesoModal(null)}
                className="text-2xl font-black text-[#111111]"
              >
                ✕
              </button>
            </div>

            <p className="mt-4 text-base font-extrabold text-[#111111]">
              {pesoModal.produto.nome}
            </p>
            <p className="text-sm font-medium text-slate-600">
              Valor por kg: {money(pesoModal.produto.preco)}
            </p>

            <input
              autoFocus
              value={pesoModal.peso}
              onChange={(event) =>
                setPesoModal((atual) =>
                  atual ? { ...atual, peso: event.target.value } : atual
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmarPeso();
              }}
              placeholder="0,000"
              className="mt-4 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-center text-xl font-bold outline-none"
            />

            <button
              onClick={confirmarPeso}
              className="mt-4 w-full rounded-xl bg-[#f97316] py-3 text-base font-black uppercase text-white hover:bg-[#ea580c]"
            >
              Confirmar (Enter)
            </button>
          </div>
        </div>
      )}

      {mostrarPagamento && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-3 py-6">
          <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border-2 border-[#f1d2ba] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase text-[#111111]">
                Finalizar venda
              </h2>
              <button
                onClick={() => setMostrarPagamento(false)}
                className="text-2xl font-black text-[#111111]"
              >
                ✕
              </button>
            </div>

            {atendimentoAtual && atendimentoAtual.tipo !== "Balcão" && (
              <div className="mt-4 rounded-xl bg-[#111111] p-4 text-white">
                <p className="text-xs font-black uppercase text-white/60">
                  Pagamento vinculado
                </p>
                <p className="mt-1 text-2xl font-black text-[#f97316]">
                  {atendimentoAtual.tipo === "Mesa"
                    ? `Mesa nº ${atendimentoAtual.mesaNumero}`
                    : `Comanda ${atendimentoAtual.comandaNome || ""}`}
                </p>
                <p className="text-sm font-bold">
                  Cliente: {cliente || atendimentoAtual.cliente}
                </p>
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-extrabold uppercase text-[#111111]">
                Colaborador responsável
              </label>
              <select
                value={colaboradorSelecionadoId}
                onChange={(event) => setColaboradorSelecionadoId(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-sm font-bold outline-none"
              >
                <option value="">Sem colaborador específico</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nome} · {asNumber(colaborador.percentualComissao).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Essa escolha alimenta o relatório de comissão no dashboard.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([...FORMAS_PAGAMENTO_BASE, "Dividido"] as FormaPagamento[]).map((forma) => (
                <button
                  key={forma}
                  type="button"
                  onClick={() => setFormaPagamento(forma)}
                  className={`rounded-xl py-3 text-base font-black uppercase ${
                    formaPagamento === forma
                      ? "bg-[#f97316] text-white"
                      : "bg-[#111111] text-white/90"
                  }`}
                >
                  {forma === "Dividido" ? "Rachar" : forma}
                </button>
              ))}
            </div>

            {formaPagamento === "Correntista" && (
              <div className="mt-4">
                <label className="text-sm font-extrabold uppercase text-[#111111]">
                  Correntista / por conta
                </label>
                <select
                  value={correntistaSelecionadoId}
                  onChange={(event) =>
                    setCorrentistaSelecionadoId(event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-sm font-bold outline-none"
                >
                  <option value="">Selecione o correntista</option>
                  {correntistas.map((correntista) => (
                    <option key={correntista.id} value={correntista.id}>
                      {correntista.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  A venda será registrada em contas a receber e no saldo aberto
                  do correntista.
                </p>
              </div>
            )}

            {formaPagamento === "Dinheiro" && (
              <div className="mt-4">
                <label className="text-sm font-extrabold uppercase text-[#111111]">
                  Valor recebido
                </label>
                <input
                  value={valorRecebido}
                  onChange={(event) => setValorRecebido(event.target.value)}
                  placeholder="R$0,00"
                  className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-lg font-bold outline-none"
                />

                <div className="mt-3 flex justify-between text-base">
                  <span className="font-bold text-[#111111]">Troco</span>
                  <strong className="text-2xl font-black text-[#f97316]">
                    {money(troco)}
                  </strong>
                </div>
              </div>
            )}

            {formaPagamento === "Dividido" && (
              <div className="mt-4 rounded-2xl border-2 border-[#f1d2ba] bg-[#fffaf6] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black uppercase text-[#111111]">
                      Rachar conta
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      Informe quanto será pago em cada forma. A soma precisa bater com o valor a cobrar.
                    </p>
                  </div>
                  <strong className={diferencaPagamentoDividido === 0 ? "text-emerald-700" : "text-red-600"}>
                    {diferencaPagamentoDividido === 0
                      ? "Fechado"
                      : `Falta/sobra ${money(diferencaPagamentoDividido)}`}
                  </strong>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {FORMAS_PAGAMENTO_DIVIDIDO.map((forma) => (
                    <div key={forma}>
                      <label className="text-xs font-black uppercase text-[#111111]">
                        {forma}
                      </label>
                      <input
                        value={pagamentosDivididos[forma]}
                        onChange={(event) =>
                          setPagamentosDivididos((atual) => ({
                            ...atual,
                            [forma]: event.target.value,
                          }))
                        }
                        placeholder="R$ 0,00"
                        className="mt-1 h-11 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Informado</p>
                    <p className="font-black text-[#111111]">{money(totalPagamentosDivididos)}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs font-black uppercase text-slate-500">Valor a cobrar</p>
                    <p className="font-black text-[#f97316]">{money(valorCobrar)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-extrabold uppercase text-[#111111]">
                Desconto em R$
              </label>
              <input
                value={descontoReais}
                onChange={(event) => setDescontoReais(event.target.value)}
                placeholder="Ex: 2,00"
                className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-lg font-bold outline-none"
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                O desconto reduz o valor cobrado do cliente e fica registrado na venda.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-[#f1d2ba] bg-[#fffaf6] p-4">
              <div className="flex justify-between">
                <span className="font-semibold text-[#111111]">Subtotal dos itens</span>
                <strong className="text-lg font-black text-[#111111]">
                  {money(totalBruto)}
                </strong>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="font-semibold text-[#111111]">Desconto</span>
                <strong className="text-lg font-black text-red-600">
                  - {money(descontoNumerico)}
                </strong>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="font-semibold text-[#111111]">Valor a cobrar</span>
                <strong className="text-lg font-black text-[#f97316]">
                  {money(valorCobrar)}
                </strong>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="font-semibold text-[#111111]">Taxas internas</span>
                <strong className="text-lg font-black text-red-600">
                  - {money(valorTaxa)}
                </strong>
              </div>

              <div className="mt-2 flex justify-between">
                <span className="font-semibold text-[#111111]">Líquido para relatório</span>
                <strong className="text-lg font-black text-emerald-700">
                  {money(valorLiquido)}
                </strong>
              </div>

              <div className="mt-4 rounded-xl bg-[#111111] px-4 py-4 text-center text-white">
                <p className="text-sm font-black uppercase tracking-wide text-white/80">
                  Valor que o cliente vai pagar
                </p>
                <p className="mt-1 text-4xl font-black text-[#f97316]">
                  {money(valorCobrar)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              O cliente paga somente o valor a cobrar. As taxas internas ficam
              registradas apenas para os relatórios e dashboard.
            </p>

            <button
              onClick={finalizarVenda}
              className="mt-5 w-full rounded-xl bg-[#f97316] py-4 text-lg font-black uppercase text-white hover:bg-[#ea580c]"
            >
              Finalizar venda
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
