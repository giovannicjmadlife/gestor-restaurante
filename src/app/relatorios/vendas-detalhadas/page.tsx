"use client";

import React, { useEffect, useMemo, useState } from "react";

type RegistroBruto = Record<string, unknown>;

type ItemVenda = {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  categoria: string;
  tipo: string;
};

type VendaNormalizada = {
  id: string;
  dataISO: string;
  dataTexto: string;
  horaTexto: string;
  operador: string;
  tipoVenda: string;
  identificacao: string;
  cliente: string;
  formaPagamento: string;
  valorBruto: number;
  desconto: number;
  taxa: number;
  valorLiquido: number;
  quantidadeItens: number;
  itensResumo: string;
  itens: ItemVenda[];
  caixaId: string;
  origem: string;
  registroOriginal: RegistroBruto;
};

type ResumoForma = {
  forma: string;
  quantidade: number;
  bruto: number;
  liquido: number;
  taxa: number;
};

const STORAGE_VENDAS_DETALHADAS = "gestor-restaurante-vendas-detalhadas";
const STORAGE_CAIXAS_HISTORICO = "gestor-restaurante-caixas-historico";

const FORMAS_PADRAO = ["Dinheiro", "PIX", "Débito", "Crédito", "Correntista", "Outros"];
const TIPOS_PADRAO = ["Balcão", "Mesa", "Comanda", "Delivery", "Outro"];

function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function primeiroDiaMesISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function numero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;

  if (typeof valor === "string") {
    const limpo = valor
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".");

    const convertido = Number(limpo);
    return Number.isFinite(convertido) ? convertido : 0;
  }

  return 0;
}

function texto(valor: unknown, fallback = ""): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return fallback;
}

function valorTexto(obj: RegistroBruto, chaves: string[], fallback = ""): string {
  for (const chave of chaves) {
    const valor = obj[chave];
    const convertido = texto(valor);
    if (convertido) return convertido;
  }

  return fallback;
}

function valorNumero(obj: RegistroBruto, chaves: string[], fallback = 0): number {
  for (const chave of chaves) {
    const valor = obj[chave];
    const convertido = numero(valor);
    if (convertido !== 0) return convertido;
  }

  return fallback;
}

function lerListaLocalStorage(chave: string): RegistroBruto[] {
  if (typeof window === "undefined") return [];

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return [];

    const convertido = JSON.parse(bruto);
    return Array.isArray(convertido) ? convertido.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function gerarIdFallback(prefixo: string, indice: number): string {
  return `${prefixo}-${indice + 1}-${Date.now()}`;
}

function extrairData(obj: RegistroBruto): Date {
  const possiveis = [
    obj.dataHora,
    obj.dataHoraVenda,
    obj.finalizadoEm,
    obj.criadoEm,
    obj.createdAt,
    obj.dataCriacao,
    obj.dataVenda,
    obj.data,
    obj.date,
  ];

  for (const valor of possiveis) {
    if (typeof valor === "string" || typeof valor === "number") {
      const data = new Date(valor);
      if (!Number.isNaN(data.getTime())) return data;
    }
  }

  const dataSeparada = texto(obj.data);
  const horaSeparada = texto(obj.hora);

  if (dataSeparada) {
    const tentativa = new Date(`${dataSeparada}T${horaSeparada || "00:00:00"}`);
    if (!Number.isNaN(tentativa.getTime())) return tentativa;
  }

  return new Date();
}

function formatarDataISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(data: Date): string {
  return data.toLocaleDateString("pt-BR");
}

function formatarHoraBR(data: Date): string {
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizarTipoVenda(tipo: string): string {
  const textoTipo = tipo.toLowerCase();

  if (textoTipo.includes("mesa")) return "Mesa";
  if (textoTipo.includes("comanda")) return "Comanda";
  if (textoTipo.includes("delivery") || textoTipo.includes("entrega")) return "Delivery";
  if (textoTipo.includes("balc")) return "Balcão";
  if (textoTipo.includes("caixa")) return "Caixa";

  return tipo || "Balcão";
}

function normalizarFormaPagamento(forma: string): string {
  const f = forma.toLowerCase();

  if (f.includes("pix")) return "PIX";
  if (f.includes("dinheiro")) return "Dinheiro";
  if (f.includes("débito") || f.includes("debito")) return "Débito";
  if (f.includes("crédito") || f.includes("credito")) return "Crédito";
  if (f.includes("correntista") || f.includes("fiado") || f.includes("conta")) return "Correntista";

  return forma || "Outros";
}

function normalizarItens(registro: RegistroBruto): ItemVenda[] {
  const listaPossivel = registro.itens || registro.produtos || registro.carrinho || registro.items;

  if (!Array.isArray(listaPossivel)) return [];

  return listaPossivel
    .filter((item) => item && typeof item === "object")
    .map((item, indice) => {
      const bruto = item as RegistroBruto;

      const quantidade =
        valorNumero(bruto, ["quantidade", "qtd", "qtde", "peso", "totalQuantidade"], 1) || 1;

      const valorUnitario = valorNumero(bruto, ["valorUnitario", "preco", "preço", "valor", "unitario"], 0);
      const total = valorNumero(bruto, ["total", "subtotal", "valorTotal"], valorUnitario * quantidade);

      return {
        id: valorTexto(bruto, ["id", "codigo", "código"], `item-${indice + 1}`),
        nome: valorTexto(bruto, ["nome", "produto", "descricao", "descrição", "item"], "Item sem nome"),
        quantidade,
        valorUnitario,
        total,
        categoria: valorTexto(bruto, ["categoria", "categoriaPrincipal"], ""),
        tipo: valorTexto(bruto, ["tipo", "subcategoria"], ""),
      };
    });
}

function textoDoRegistro(registro: RegistroBruto): string {
  return [
    registro.evento,
    registro.tipoEvento,
    registro.tipo,
    registro.tipoVenda,
    registro.tipoAtendimento,
    registro.tipoDocumento,
    registro.documento,
    registro.modulo,
    registro.módulo,
    registro.identificacao,
    registro.identificação,
    registro.descricao,
    registro.descrição,
    registro.forma,
    registro.formaPagamento,
    registro.formaRecebimento,
    registro.origem,
  ]
    .map((valor) => texto(valor).toLowerCase())
    .join(" ");
}

function ehEventoDeCaixaQueNaoEVenda(registro: RegistroBruto): boolean {
  const t = textoDoRegistro(registro);

  const tipoVendaNormalizado = normalizarTipoVenda(
    valorTexto(registro, ["tipoVenda", "tipoAtendimento", "modulo", "módulo", "origem", "tipo"], "")
  );

  const identificacao = valorTexto(registro, ["identificacao", "identificação"], "").toLowerCase();

  if (tipoVendaNormalizado === "Caixa") return true;
  if (identificacao === "caixa") return true;

  return (
    t.includes("abertura") ||
    t.includes("abrir caixa") ||
    t.includes("fechamento") ||
    t.includes("fechar caixa") ||
    t.includes("conferência") ||
    t.includes("conferencia") ||
    t.includes("reforço") ||
    t.includes("reforco") ||
    t.includes("suprimento") ||
    t.includes("sangria") ||
    t.includes("retirada") ||
    t.includes("cancelamento") ||
    t.includes("evento de caixa")
  );
}

function ehVendaDetalhadaValida(registro: RegistroBruto): boolean {
  if (ehEventoDeCaixaQueNaoEVenda(registro)) return false;

  const itens = normalizarItens(registro);
  if (itens.length <= 0) return false;

  const tipoVendaNormalizado = normalizarTipoVenda(
    valorTexto(registro, ["tipoVenda", "tipoAtendimento", "modulo", "módulo", "origem", "tipo"], "Balcão")
  );

  if (tipoVendaNormalizado === "Caixa") return false;

  return true;
}

function normalizarVenda(registro: RegistroBruto, indice: number, origem: string): VendaNormalizada {
  const data = extrairData(registro);
  const itens = normalizarItens(registro);

  const valorBruto = valorNumero(
    registro,
    [
      "valorBruto",
      "totalBruto",
      "totalCobrar",
      "totalACobrar",
      "valorTotal",
      "total",
      "valorVenda",
      "valor",
      "subtotal",
    ],
    itens.reduce((soma, item) => soma + item.total, 0)
  );

  const desconto = valorNumero(registro, ["desconto", "valorDesconto", "totalDesconto"], 0);
  const taxa = valorNumero(registro, ["taxa", "valorTaxa", "taxaDescontada", "totalTaxas"], 0);

  const valorLiquido = valorNumero(
    registro,
    ["valorLiquido", "totalLiquido", "valorReal", "liquido", "valorRecebidoLiquido"],
    Math.max(valorBruto - desconto - taxa, 0)
  );

  const tipoVenda = normalizarTipoVenda(
    valorTexto(registro, ["tipoVenda", "tipoAtendimento", "modulo", "módulo", "origem", "atendimentoTipo", "tipo"], "Balcão")
  );

  const formaPagamento = normalizarFormaPagamento(
    valorTexto(registro, ["formaPagamento", "formaRecebimento", "forma", "pagamento", "meioPagamento"], "Outros")
  );

  const identificacao =
    valorTexto(registro, ["identificacao", "identificação", "mesa", "numeroMesa", "numeroComanda", "comanda"], "") ||
    (tipoVenda === "Balcão" ? "Balcão" : tipoVenda);

  const cliente = valorTexto(registro, ["cliente", "nomeCliente", "pessoa", "nomeComanda"], "");

  const quantidadeItens =
    valorNumero(registro, ["quantidadeItens", "qtdItens", "totalItens"], 0) ||
    itens.reduce((soma, item) => soma + item.quantidade, 0);

  const itensResumo =
    valorTexto(registro, ["itensResumo", "resumo", "descricao", "descrição"], "") ||
    itens
      .slice(0, 3)
      .map((item) => `${item.quantidade}x ${item.nome}`)
      .join(", ") ||
    "Sem itens detalhados";

  return {
    id: valorTexto(registro, ["id", "vendaId", "codigo", "código"], gerarIdFallback(origem, indice)),
    dataISO: formatarDataISO(data),
    dataTexto: formatarDataBR(data),
    horaTexto: formatarHoraBR(data),
    operador: valorTexto(registro, ["operador", "usuario", "usuário", "caixaOperador", "responsavel"], "Adm"),
    tipoVenda,
    identificacao,
    cliente,
    formaPagamento,
    valorBruto,
    desconto,
    taxa,
    valorLiquido,
    quantidadeItens,
    itensResumo,
    itens,
    caixaId: valorTexto(registro, ["caixaId", "idCaixa"], ""),
    origem,
    registroOriginal: registro,
  };
}

function baixarCSV(nomeArquivo: string, linhas: string[][]): void {
  const conteudo = linhas
    .map((linha) =>
      linha
        .map((celula) => {
          const valor = String(celula ?? "").replace(/"/g, '""');
          return `"${valor}"`;
        })
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + conteudo], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(url);
}

export default function RelatorioVendasDetalhadasPage() {
  const [vendas, setVendas] = useState<VendaNormalizada[]>([]);
  const [busca, setBusca] = useState("");
  const [dataInicial, setDataInicial] = useState(primeiroDiaMesISO());
  const [dataFinal, setDataFinal] = useState(hojeISO());
  const [operador, setOperador] = useState("Todos");
  const [tipoVenda, setTipoVenda] = useState("Todos");
  const [formaPagamento, setFormaPagamento] = useState("Todos");
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaNormalizada | null>(null);

  function carregarDados() {
    const vendasDetalhadas = lerListaLocalStorage(STORAGE_VENDAS_DETALHADAS)
      .filter(ehVendaDetalhadaValida)
      .map((registro, indice) => normalizarVenda(registro, indice, "Venda detalhada"));

    const historicoCaixa = lerListaLocalStorage(STORAGE_CAIXAS_HISTORICO)
      .filter(ehVendaDetalhadaValida)
      .map((registro, indice) => normalizarVenda(registro, indice, "Histórico do caixa"));

    const chavesExistentes = new Set(
      vendasDetalhadas.map((venda) => `${venda.dataISO}-${venda.horaTexto}-${venda.valorBruto}-${venda.itensResumo}`)
    );

    const historicoSemDuplicar = historicoCaixa.filter((venda) => {
      const chave = `${venda.dataISO}-${venda.horaTexto}-${venda.valorBruto}-${venda.itensResumo}`;
      return !chavesExistentes.has(chave);
    });

    const listaFinal = [...vendasDetalhadas, ...historicoSemDuplicar].sort((a, b) => {
      const dataA = new Date(`${a.dataISO}T${a.horaTexto || "00:00"}`).getTime();
      const dataB = new Date(`${b.dataISO}T${b.horaTexto || "00:00"}`).getTime();

      return dataB - dataA;
    });

    setVendas(listaFinal);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const operadoresDisponiveis = useMemo(() => {
    const lista = Array.from(new Set(vendas.map((venda) => venda.operador).filter(Boolean)));
    return ["Todos", ...lista.sort()];
  }, [vendas]);

  const tiposDisponiveis = useMemo(() => {
    const encontrados = Array.from(new Set(vendas.map((venda) => venda.tipoVenda).filter(Boolean)));
    const combinados = Array.from(new Set([...TIPOS_PADRAO, ...encontrados]));
    return ["Todos", ...combinados.sort()];
  }, [vendas]);

  const formasDisponiveis = useMemo(() => {
    const encontrados = Array.from(new Set(vendas.map((venda) => venda.formaPagamento).filter(Boolean)));
    const combinados = Array.from(new Set([...FORMAS_PADRAO, ...encontrados]));
    return ["Todos", ...combinados.sort()];
  }, [vendas]);

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return vendas.filter((venda) => {
      const dentroDataInicial = !dataInicial || venda.dataISO >= dataInicial;
      const dentroDataFinal = !dataFinal || venda.dataISO <= dataFinal;
      const bateOperador = operador === "Todos" || venda.operador === operador;
      const bateTipo = tipoVenda === "Todos" || venda.tipoVenda === tipoVenda;
      const bateForma = formaPagamento === "Todos" || venda.formaPagamento === formaPagamento;

      const textoBusca = [
        venda.id,
        venda.dataTexto,
        venda.horaTexto,
        venda.operador,
        venda.tipoVenda,
        venda.identificacao,
        venda.cliente,
        venda.formaPagamento,
        venda.itensResumo,
        venda.caixaId,
        venda.origem,
      ]
        .join(" ")
        .toLowerCase();

      const bateBusca = !termo || textoBusca.includes(termo);

      return dentroDataInicial && dentroDataFinal && bateOperador && bateTipo && bateForma && bateBusca;
    });
  }, [vendas, busca, dataInicial, dataFinal, operador, tipoVenda, formaPagamento]);

  const resumo = useMemo(() => {
    const quantidade = vendasFiltradas.length;
    const bruto = vendasFiltradas.reduce((soma, venda) => soma + venda.valorBruto, 0);
    const liquido = vendasFiltradas.reduce((soma, venda) => soma + venda.valorLiquido, 0);
    const taxas = vendasFiltradas.reduce((soma, venda) => soma + venda.taxa, 0);
    const descontos = vendasFiltradas.reduce((soma, venda) => soma + venda.desconto, 0);
    const itens = vendasFiltradas.reduce((soma, venda) => soma + venda.quantidadeItens, 0);

    return {
      quantidade,
      bruto,
      liquido,
      taxas,
      descontos,
      itens,
      ticketMedio: quantidade > 0 ? bruto / quantidade : 0,
    };
  }, [vendasFiltradas]);

  const resumoPorForma = useMemo(() => {
    const mapa = new Map<string, ResumoForma>();

    vendasFiltradas.forEach((venda) => {
      const atual =
        mapa.get(venda.formaPagamento) ||
        ({
          forma: venda.formaPagamento,
          quantidade: 0,
          bruto: 0,
          liquido: 0,
          taxa: 0,
        } satisfies ResumoForma);

      atual.quantidade += 1;
      atual.bruto += venda.valorBruto;
      atual.liquido += venda.valorLiquido;
      atual.taxa += venda.taxa;

      mapa.set(venda.formaPagamento, atual);
    });

    return Array.from(mapa.values()).sort((a, b) => b.bruto - a.bruto);
  }, [vendasFiltradas]);

  function limparFiltros() {
    setBusca("");
    setDataInicial(primeiroDiaMesISO());
    setDataFinal(hojeISO());
    setOperador("Todos");
    setTipoVenda("Todos");
    setFormaPagamento("Todos");
  }

  function exportarExcelCSV() {
    const linhas = [
      [
        "Data",
        "Hora",
        "Operador",
        "Tipo",
        "Identificação",
        "Cliente",
        "Forma de pagamento",
        "Qtd. itens",
        "Itens",
        "Valor bruto",
        "Desconto",
        "Taxas",
        "Valor líquido",
        "Caixa",
        "Origem",
      ],
      ...vendasFiltradas.map((venda) => [
        venda.dataTexto,
        venda.horaTexto,
        venda.operador,
        venda.tipoVenda,
        venda.identificacao,
        venda.cliente,
        venda.formaPagamento,
        String(venda.quantidadeItens),
        venda.itensResumo,
        moeda(venda.valorBruto),
        moeda(venda.desconto),
        moeda(venda.taxa),
        moeda(venda.valorLiquido),
        venda.caixaId,
        venda.origem,
      ]),
    ];

    baixarCSV(`relatorio-vendas-detalhadas-${dataInicial || "inicio"}-${dataFinal || "fim"}.csv`, linhas);
  }

  return (
    <main className="min-h-screen bg-[#f7f1e8] text-zinc-900">
      <header className="bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-400">
              Samambaia Restaurante e Pizzaria
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
              Relatórios | Vendas Detalhadas
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              Conferência de vendas por período, operador, atendimento e forma de recebimento.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
            >
              Dashboard
            </a>
            <a
              href="/pdv"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
            >
              Acessar PDV
            </a>
            <button
              type="button"
              onClick={carregarDados}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-orange-100"
            >
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Vendas</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{resumo.quantidade}</p>
            <p className="mt-1 text-xs text-zinc-500">Quantidade no filtro</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Valor vendido</p>
            <p className="mt-2 text-3xl font-black text-orange-600">{moeda(resumo.bruto)}</p>
            <p className="mt-1 text-xs text-zinc-500">Total bruto cobrado</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Valor líquido</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{moeda(resumo.liquido)}</p>
            <p className="mt-1 text-xs text-zinc-500">Após taxas e descontos</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Taxas</p>
            <p className="mt-2 text-3xl font-black text-red-600">{moeda(resumo.taxas)}</p>
            <p className="mt-1 text-xs text-zinc-500">Maquininha/apps</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Ticket médio</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{moeda(resumo.ticketMedio)}</p>
            <p className="mt-1 text-xs text-zinc-500">Média por venda</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Itens</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{resumo.itens}</p>
            <p className="mt-1 text-xs text-zinc-500">Quantidade vendida</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Data inicial</span>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Data final</span>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Operador</span>
              <select
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                {operadoresDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Tipo</span>
              <select
                value={tipoVenda}
                onChange={(e) => setTipoVenda(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                {tiposDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Forma</span>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                {formasDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={limparFiltros}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, mesa, comanda, operador, item, forma de pagamento..."
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
            />

            <button
              type="button"
              onClick={exportarExcelCSV}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-black text-white transition hover:bg-orange-600"
            >
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-orange-100 bg-white p-4 lg:col-span-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-black text-zinc-950">Vendas encontradas</h2>
                <p className="text-sm text-zinc-500">
                  Clique em “ver detalhes” para conferir os itens de cada venda.
                </p>
              </div>

              <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
                {vendasFiltradas.length} registro(s)
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-zinc-950 text-white">
                    <th className="px-3 py-3 font-black">Data</th>
                    <th className="px-3 py-3 font-black">Tipo</th>
                    <th className="px-3 py-3 font-black">Cliente/Identificação</th>
                    <th className="px-3 py-3 font-black">Operador</th>
                    <th className="px-3 py-3 font-black">Forma</th>
                    <th className="px-3 py-3 font-black">Itens</th>
                    <th className="px-3 py-3 text-right font-black">Bruto</th>
                    <th className="px-3 py-3 text-right font-black">Taxa</th>
                    <th className="px-3 py-3 text-right font-black">Líquido</th>
                    <th className="px-3 py-3 text-center font-black">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {vendasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                        Nenhuma venda encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    vendasFiltradas.map((venda, indice) => (
                      <tr
                        key={`${venda.id}-${indice}`}
                        className={indice % 2 === 0 ? "bg-white" : "bg-orange-50/40"}
                      >
                        <td className="px-3 py-3 align-top">
                          <p className="font-bold text-zinc-950">{venda.dataTexto}</p>
                          <p className="text-xs text-zinc-500">{venda.horaTexto}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white">
                            {venda.tipoVenda}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-bold text-zinc-950">{venda.cliente || venda.identificacao}</p>
                          <p className="text-xs text-zinc-500">{venda.identificacao}</p>
                        </td>
                        <td className="px-3 py-3 align-top">{venda.operador}</td>
                        <td className="px-3 py-3 align-top">{venda.formaPagamento}</td>
                        <td className="max-w-[280px] px-3 py-3 align-top">
                          <p className="line-clamp-2 text-zinc-700">{venda.itensResumo}</p>
                          <p className="mt-1 text-xs font-bold text-zinc-500">{venda.quantidadeItens} item(ns)</p>
                        </td>
                        <td className="px-3 py-3 text-right align-top font-bold text-zinc-950">
                          {moeda(venda.valorBruto)}
                        </td>
                        <td className="px-3 py-3 text-right align-top font-bold text-red-600">
                          {moeda(venda.taxa)}
                        </td>
                        <td className="px-3 py-3 text-right align-top font-black text-emerald-700">
                          {moeda(venda.valorLiquido)}
                        </td>
                        <td className="px-3 py-3 text-center align-top">
                          <button
                            type="button"
                            onClick={() => setVendaSelecionada(venda)}
                            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600"
                          >
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-2xl border border-orange-100 bg-white p-4">
            <h2 className="text-lg font-black text-zinc-950">Por forma de recebimento</h2>
            <p className="mt-1 text-sm text-zinc-500">Resumo automático do período filtrado.</p>

            <div className="mt-4 space-y-3">
              {resumoPorForma.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">Sem vendas para resumir.</p>
              ) : (
                resumoPorForma.map((item) => (
                  <div key={item.forma} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-zinc-950">{item.forma}</p>
                      <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white">
                        {item.quantidade} venda(s)
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase text-zinc-500">Bruto</p>
                        <p className="font-black text-zinc-950">{moeda(item.bruto)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-zinc-500">Líquido</p>
                        <p className="font-black text-emerald-700">{moeda(item.liquido)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs font-bold uppercase text-zinc-500">Taxas</p>
                        <p className="font-black text-red-600">{moeda(item.taxa)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
          <h2 className="text-lg font-black text-zinc-950">Observação importante</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Este relatório mostra somente vendas reais que possuem itens lançados. Eventos internos de caixa,
            como abertura, fechamento, conferência, reforço, sangria, retirada e suprimento, não entram no
            faturamento deste relatório.
          </p>
        </div>
      </section>

      {vendaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                  Detalhes da venda
                </p>
                <h3 className="mt-1 text-xl font-black text-zinc-950">
                  {vendaSelecionada.tipoVenda} — {vendaSelecionada.dataTexto} às {vendaSelecionada.horaTexto}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {vendaSelecionada.cliente || vendaSelecionada.identificacao} · {vendaSelecionada.formaPagamento}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setVendaSelecionada(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>

            <div className="p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Bruto</p>
                  <p className="mt-1 text-xl font-black text-zinc-950">{moeda(vendaSelecionada.valorBruto)}</p>
                </div>

                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Desconto</p>
                  <p className="mt-1 text-xl font-black text-zinc-950">{moeda(vendaSelecionada.desconto)}</p>
                </div>

                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Taxa</p>
                  <p className="mt-1 text-xl font-black text-red-600">{moeda(vendaSelecionada.taxa)}</p>
                </div>

                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Líquido</p>
                  <p className="mt-1 text-xl font-black text-emerald-700">
                    {moeda(vendaSelecionada.valorLiquido)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Operador</p>
                  <p className="mt-1 font-bold text-zinc-950">{vendaSelecionada.operador}</p>
                </div>

                <div className="rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Caixa</p>
                  <p className="mt-1 font-bold text-zinc-950">{vendaSelecionada.caixaId || "Não informado"}</p>
                </div>

                <div className="rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Identificação</p>
                  <p className="mt-1 font-bold text-zinc-950">{vendaSelecionada.identificacao}</p>
                </div>

                <div className="rounded-xl border border-zinc-100 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Origem do registro</p>
                  <p className="mt-1 font-bold text-zinc-950">{vendaSelecionada.origem}</p>
                </div>
              </div>

              <div className="mt-5">
                <h4 className="text-lg font-black text-zinc-950">Itens</h4>

                {vendaSelecionada.itens.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
                    Esta venda não possui itens detalhados no registro. Resumo salvo:{" "}
                    {vendaSelecionada.itensResumo}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[680px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-zinc-950 text-white">
                          <th className="px-3 py-3 text-left font-black">Item</th>
                          <th className="px-3 py-3 text-left font-black">Categoria</th>
                          <th className="px-3 py-3 text-right font-black">Qtd.</th>
                          <th className="px-3 py-3 text-right font-black">Unit.</th>
                          <th className="px-3 py-3 text-right font-black">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendaSelecionada.itens.map((item, indice) => (
                          <tr key={`${item.id}-${indice}`} className={indice % 2 === 0 ? "bg-white" : "bg-orange-50/40"}>
                            <td className="px-3 py-3 font-bold text-zinc-950">{item.nome}</td>
                            <td className="px-3 py-3 text-zinc-600">
                              {[item.categoria, item.tipo].filter(Boolean).join(" / ") || "-"}
                            </td>
                            <td className="px-3 py-3 text-right">{item.quantidade}</td>
                            <td className="px-3 py-3 text-right">{moeda(item.valorUnitario)}</td>
                            <td className="px-3 py-3 text-right font-black">{moeda(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
