"use client";

import React, { useEffect, useMemo, useState } from "react";

type StatusMesa = "Livre" | "Consumindo" | "Reservada" | "Fechamento";

type Mesa = {
  id: string;
  numero: number;
  status: StatusMesa;
  cliente: string;
  pessoas: number;
  observacao: string;
  abertaEm: string;
  atualizadaEm: string;
};

type ItemConsumo = {
  id: string;
  produtoId?: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  categoria?: string;
  tipo?: string;
  observacao?: string;
};

type ConsumoMesa = {
  mesaId: string;
  itens: ItemConsumo[];
  atualizadoEm: string;
};

type AtendimentoAtual = {
  tipo: "Mesa";
  modo: "lancar" | "pagar";
  mesaId: string;
  mesaNumero: number;
  cliente: string;
  pessoas: number;
  itens: ItemConsumo[];
  voltarPara: string;
  criadoEm: string;
};

const STORAGE_MESAS = "gestor-restaurante-mesas";
const STORAGE_MESA_CONSUMOS = "gestor-restaurante-mesa-consumos";
const STORAGE_ATENDIMENTO_ATUAL = "gestor-restaurante-pdv-atendimento-atual";

const NOME_RESTAURANTE = "SAMAMBAIA RESTAURANTE E PIZZARIA";
const CNPJ_RESTAURANTE = "44.824.459/0001-85";

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataHoraBR(dataISO?: string): string {
  if (!dataISO) return "-";

  const data = new Date(dataISO);

  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function lerLocalStorage<T>(chave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const valor = window.localStorage.getItem(chave);
    if (!valor) return fallback;

    return JSON.parse(valor) as T;
  } catch {
    return fallback;
  }
}

function salvarLocalStorage<T>(chave: string, valor: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chave, JSON.stringify(valor));
}

function criarMesasPadrao(): Mesa[] {
  const agora = new Date().toISOString();

  return Array.from({ length: 30 }, (_, index) => ({
    id: `mesa-${index + 1}`,
    numero: index + 1,
    status: "Livre" as StatusMesa,
    cliente: "",
    pessoas: 1,
    observacao: "",
    abertaEm: "",
    atualizadaEm: agora,
  }));
}

function normalizarStatusMesa(status: unknown): StatusMesa {
  if (status === "Consumindo") return "Consumindo";
  if (status === "Reservada") return "Reservada";
  if (status === "Fechamento") return "Fechamento";
  return "Livre";
}

function normalizarMesa(mesa: Partial<Mesa>, index: number): Mesa {
  const agora = new Date().toISOString();

  return {
    id: typeof mesa.id === "string" && mesa.id ? mesa.id : `mesa-${index + 1}`,
    numero: typeof mesa.numero === "number" && mesa.numero > 0 ? mesa.numero : index + 1,
    status: normalizarStatusMesa(mesa.status),
    cliente: typeof mesa.cliente === "string" ? mesa.cliente : "",
    pessoas: typeof mesa.pessoas === "number" && mesa.pessoas > 0 ? mesa.pessoas : 1,
    observacao: typeof mesa.observacao === "string" ? mesa.observacao : "",
    abertaEm: typeof mesa.abertaEm === "string" ? mesa.abertaEm : "",
    atualizadaEm: typeof mesa.atualizadaEm === "string" ? mesa.atualizadaEm : agora,
  };
}

function normalizarMesas(lista: unknown): Mesa[] {
  if (!Array.isArray(lista)) return criarMesasPadrao();

  const mesas = lista.map((item, index) =>
    normalizarMesa((item && typeof item === "object" ? item : {}) as Partial<Mesa>, index)
  );

  if (mesas.length === 0) return criarMesasPadrao();

  return mesas;
}

function normalizarItemConsumo(item: Partial<ItemConsumo>, index: number): ItemConsumo {
  const quantidade = typeof item.quantidade === "number" && item.quantidade > 0 ? item.quantidade : 1;
  const valorUnitario = typeof item.valorUnitario === "number" ? item.valorUnitario : 0;
  const total =
    typeof item.total === "number" && item.total > 0 ? item.total : quantidade * valorUnitario;

  return {
    id: typeof item.id === "string" && item.id ? item.id : `item-${index + 1}-${Date.now()}`,
    produtoId: typeof item.produtoId === "string" ? item.produtoId : "",
    nome: typeof item.nome === "string" && item.nome ? item.nome : "Item sem nome",
    quantidade,
    valorUnitario,
    total,
    categoria: typeof item.categoria === "string" ? item.categoria : "",
    tipo: typeof item.tipo === "string" ? item.tipo : "",
    observacao: typeof item.observacao === "string" ? item.observacao : "",
  };
}

function normalizarConsumos(lista: unknown): ConsumoMesa[] {
  if (!Array.isArray(lista)) return [];

  return lista
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const bruto = item as Partial<ConsumoMesa>;
      const itensBrutos = Array.isArray(bruto.itens) ? bruto.itens : [];

      return {
        mesaId: typeof bruto.mesaId === "string" ? bruto.mesaId : "",
        itens: itensBrutos.map((produto, index) =>
          normalizarItemConsumo(
            (produto && typeof produto === "object" ? produto : {}) as Partial<ItemConsumo>,
            index
          )
        ),
        atualizadoEm: typeof bruto.atualizadoEm === "string" ? bruto.atualizadoEm : new Date().toISOString(),
      };
    })
    .filter((consumo) => consumo.mesaId);
}

function totalConsumo(itens: ItemConsumo[]): number {
  return itens.reduce((soma, item) => soma + item.total, 0);
}

function quantidadeItens(itens: ItemConsumo[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade, 0);
}

function classeStatus(status: StatusMesa): string {
  if (status === "Livre") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "Consumindo") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  if (status === "Reservada") {
    return "border-yellow-200 bg-yellow-50 text-yellow-800";
  }

  return "border-red-200 bg-red-50 text-red-800";
}

function badgeStatus(status: StatusMesa): string {
  if (status === "Livre") {
    return "bg-emerald-600 text-white";
  }

  if (status === "Consumindo") {
    return "bg-blue-600 text-white";
  }

  if (status === "Reservada") {
    return "bg-yellow-500 text-zinc-950";
  }

  return "bg-red-600 text-white";
}

function abrirJanelaImpressao(titulo: string, conteudo: string): void {
  if (typeof window === "undefined") return;

  const janela = window.open("", "_blank", "width=420,height=640");

  if (!janela) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
    return;
  }

  janela.document.open();
  janela.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 12px;
            font-family: Arial, Helvetica, sans-serif;
            color: #111;
            font-size: 12px;
          }

          .cupom {
            width: 80mm;
            max-width: 100%;
            margin: 0 auto;
          }

          .center {
            text-align: center;
          }

          .titulo {
            font-weight: 800;
            font-size: 14px;
            margin-bottom: 4px;
          }

          .linha {
            border-top: 1px dashed #111;
            margin: 8px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            padding: 3px 0;
            vertical-align: top;
          }

          th {
            text-align: left;
          }

          .right {
            text-align: right;
          }

          .total {
            font-size: 16px;
            font-weight: 800;
          }

          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="cupom">
          ${conteudo}
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  janela.document.close();
}

function montarConteudoConta(mesa: Mesa, itens: ItemConsumo[]): string {
  const linhas = itens
    .map(
      (item) => `
        <tr>
          <td>
            ${item.quantidade}x ${item.nome}
          </td>
          <td class="right">${moeda(item.total)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="center">
      <div class="titulo">${NOME_RESTAURANTE}</div>
      <div>CNPJ: ${CNPJ_RESTAURANTE}</div>
      <div>CONTA DA MESA ${mesa.numero}</div>
    </div>

    <div class="linha"></div>

    <div>Data/Hora: ${new Date().toLocaleString("pt-BR")}</div>
    <div>Cliente: ${mesa.cliente || "Mesa sem nome"}</div>
    <div>Pessoas: ${mesa.pessoas || 1}</div>

    <div class="linha"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${linhas || `<tr><td colspan="2">Sem consumo lançado.</td></tr>`}
      </tbody>
    </table>

    <div class="linha"></div>

    <table>
      <tr>
        <td class="total">TOTAL</td>
        <td class="right total">${moeda(totalConsumo(itens))}</td>
      </tr>
    </table>

    <div class="linha"></div>

    <div class="center">Não é documento fiscal.</div>
  `;
}

function montarConteudoCozinha(mesa: Mesa, itens: ItemConsumo[]): string {
  const linhas = itens
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${item.quantidade}x ${item.nome}</strong>
            ${item.categoria || item.tipo ? `<br/><small>${[item.categoria, item.tipo].filter(Boolean).join(" / ")}</small>` : ""}
            ${item.observacao ? `<br/><small>Obs.: ${item.observacao}</small>` : ""}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="center">
      <div class="titulo">${NOME_RESTAURANTE}</div>
      <div>CNPJ: ${CNPJ_RESTAURANTE}</div>
      <div>PEDIDO PARA PRODUÇÃO</div>
    </div>

    <div class="linha"></div>

    <div>Data/Hora: ${new Date().toLocaleString("pt-BR")}</div>
    <div>Mesa: ${mesa.numero}</div>
    <div>Cliente: ${mesa.cliente || "Mesa sem nome"}</div>
    <div>Pessoas: ${mesa.pessoas || 1}</div>

    <div class="linha"></div>

    <table>
      <tbody>
        ${linhas || `<tr><td>Sem itens para produção.</td></tr>`}
      </tbody>
    </table>

    <div class="linha"></div>

    <div class="center">Sem valores para cozinha.</div>
  `;
}

export default function MesaPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [consumos, setConsumos] = useState<ConsumoMesa[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusMesa | "Todas">("Todas");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"numero" | "status" | "valor">("numero");

  const [clienteModal, setClienteModal] = useState("");
  const [pessoasModal, setPessoasModal] = useState("1");
  const [observacaoModal, setObservacaoModal] = useState("");

  function carregarDados() {
    const mesasSalvas = normalizarMesas(lerLocalStorage<unknown>(STORAGE_MESAS, []));
    const consumosSalvos = normalizarConsumos(lerLocalStorage<unknown>(STORAGE_MESA_CONSUMOS, []));

    setMesas(mesasSalvas);
    setConsumos(consumosSalvos);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function salvarMesas(novasMesas: Mesa[]) {
    setMesas(novasMesas);
    salvarLocalStorage(STORAGE_MESAS, novasMesas);
  }

  function salvarConsumos(novosConsumos: ConsumoMesa[]) {
    setConsumos(novosConsumos);
    salvarLocalStorage(STORAGE_MESA_CONSUMOS, novosConsumos);
  }

  function obterConsumoMesa(mesaId: string): ConsumoMesa {
    return (
      consumos.find((consumo) => consumo.mesaId === mesaId) || {
        mesaId,
        itens: [],
        atualizadoEm: new Date().toISOString(),
      }
    );
  }

  function obterItensMesa(mesaId: string): ItemConsumo[] {
    return obterConsumoMesa(mesaId).itens;
  }

  function atualizarMesa(mesaAtualizada: Mesa): Mesa {
    const novaMesa: Mesa = {
      ...mesaAtualizada,
      atualizadaEm: new Date().toISOString(),
    };

    const novasMesas = mesas.map((mesa) => (mesa.id === novaMesa.id ? novaMesa : mesa));
    salvarMesas(novasMesas);

    if (mesaSelecionada?.id === novaMesa.id) {
      setMesaSelecionada(novaMesa);
      setClienteModal(novaMesa.cliente);
      setPessoasModal(String(novaMesa.pessoas || 1));
      setObservacaoModal(novaMesa.observacao);
    }

    return novaMesa;
  }

  function abrirModalMesa(mesa: Mesa) {
    setMesaSelecionada(mesa);
    setClienteModal(mesa.cliente);
    setPessoasModal(String(mesa.pessoas || 1));
    setObservacaoModal(mesa.observacao);
  }

  function fecharModalMesa() {
    setMesaSelecionada(null);
    setClienteModal("");
    setPessoasModal("1");
    setObservacaoModal("");
  }

  function salvarDadosMesa(statusDesejado?: StatusMesa): Mesa | null {
    if (!mesaSelecionada) return null;

    const pessoasNumero = Number(pessoasModal);
    const pessoas = Number.isFinite(pessoasNumero) && pessoasNumero > 0 ? pessoasNumero : 1;
    const itens = obterItensMesa(mesaSelecionada.id);
    const statusFinal: StatusMesa =
      statusDesejado || (itens.length > 0 ? "Consumindo" : mesaSelecionada.status);

    const mesaAtualizada: Mesa = {
      ...mesaSelecionada,
      cliente: clienteModal.trim(),
      pessoas,
      observacao: observacaoModal.trim(),
      status: statusFinal,
      abertaEm:
        mesaSelecionada.abertaEm ||
        (statusFinal !== "Livre" ? new Date().toISOString() : ""),
      atualizadaEm: new Date().toISOString(),
    };

    return atualizarMesa(mesaAtualizada);
  }

  function reservarMesa() {
    const mesaAtualizada = salvarDadosMesa("Reservada");

    if (!mesaAtualizada) {
      alert("Não foi possível reservar a mesa.");
      return;
    }

    alert(`Mesa ${mesaAtualizada.numero} reservada.`);
  }

  function colocarMesaEmFechamento() {
    const mesaAtualizada = salvarDadosMesa("Fechamento");

    if (!mesaAtualizada) {
      alert("Não foi possível colocar a mesa em fechamento.");
      return;
    }

    alert(`Mesa ${mesaAtualizada.numero} colocada em fechamento.`);
  }

  function liberarMesa() {
    if (!mesaSelecionada) return;

    const confirmar = window.confirm(
      `Deseja liberar a mesa ${mesaSelecionada.numero}? O consumo será mantido apenas se você não cancelar.`
    );

    if (!confirmar) return;

    const mesaAtualizada: Mesa = {
      ...mesaSelecionada,
      status: "Livre",
      cliente: "",
      pessoas: 1,
      observacao: "",
      abertaEm: "",
      atualizadaEm: new Date().toISOString(),
    };

    atualizarMesa(mesaAtualizada);
    alert(`Mesa ${mesaSelecionada.numero} liberada.`);
    fecharModalMesa();
  }

  function cancelarConsumoELiberarMesa() {
    if (!mesaSelecionada) return;

    const confirmar = window.confirm(
      `Deseja cancelar todo o consumo e liberar a mesa ${mesaSelecionada.numero}? Essa ação não pode ser desfeita.`
    );

    if (!confirmar) return;

    const novosConsumos = consumos.filter((consumo) => consumo.mesaId !== mesaSelecionada.id);
    salvarConsumos(novosConsumos);

    const mesaAtualizada: Mesa = {
      ...mesaSelecionada,
      status: "Livre",
      cliente: "",
      pessoas: 1,
      observacao: "",
      abertaEm: "",
      atualizadaEm: new Date().toISOString(),
    };

    atualizarMesa(mesaAtualizada);
    alert(`Consumo cancelado e mesa ${mesaSelecionada.numero} liberada.`);
    fecharModalMesa();
  }

  function limparTodasAsMesas() {
    const confirmar = window.confirm(
      "Deseja resetar todas as mesas? Isso libera as mesas e apaga todos os consumos lançados."
    );

    if (!confirmar) return;

    const mesasPadrao = criarMesasPadrao();
    salvarMesas(mesasPadrao);
    salvarConsumos([]);
    fecharModalMesa();
    alert("Mesas resetadas com sucesso.");
  }

  function lancarOuEditarConsumo() {
    const mesaAtualizada = salvarDadosMesa("Consumindo");

    if (!mesaAtualizada) {
      alert("Não foi possível localizar a mesa selecionada.");
      return;
    }

    const itens = obterItensMesa(mesaAtualizada.id);

    const atendimento: AtendimentoAtual = {
      tipo: "Mesa",
      modo: "lancar",
      mesaId: mesaAtualizada.id,
      mesaNumero: mesaAtualizada.numero,
      cliente: mesaAtualizada.cliente || "Mesa sem nome",
      pessoas: mesaAtualizada.pessoas || 1,
      itens,
      voltarPara: "/pdv/mesa",
      criadoEm: new Date().toISOString(),
    };

    salvarLocalStorage(STORAGE_ATENDIMENTO_ATUAL, atendimento);

    window.location.href = "/pdv";
  }

  function fecharPagarNoPDV() {
    const mesaAtualizada = salvarDadosMesa("Fechamento");

    if (!mesaAtualizada) {
      alert("Não foi possível localizar a mesa selecionada.");
      return;
    }

    const itens = obterItensMesa(mesaAtualizada.id);

    if (itens.length === 0) {
      alert("Esta mesa não possui consumo lançado.");
      return;
    }

    const atendimento: AtendimentoAtual = {
      tipo: "Mesa",
      modo: "pagar",
      mesaId: mesaAtualizada.id,
      mesaNumero: mesaAtualizada.numero,
      cliente: mesaAtualizada.cliente || "Mesa sem nome",
      pessoas: mesaAtualizada.pessoas || 1,
      itens,
      voltarPara: "/pdv/mesa",
      criadoEm: new Date().toISOString(),
    };

    salvarLocalStorage(STORAGE_ATENDIMENTO_ATUAL, atendimento);

    window.location.href = "/pdv";
  }

  function imprimirConta() {
    if (!mesaSelecionada) return;

    const mesaAtualizada = salvarDadosMesa(mesaSelecionada.status);

    if (!mesaAtualizada) {
      alert("Não foi possível imprimir a conta.");
      return;
    }

    const itens = obterItensMesa(mesaAtualizada.id);
    abrirJanelaImpressao(
      `Conta Mesa ${mesaAtualizada.numero}`,
      montarConteudoConta(mesaAtualizada, itens)
    );
  }

  function imprimirCozinha() {
    if (!mesaSelecionada) return;

    const mesaAtualizada = salvarDadosMesa(mesaSelecionada.status);

    if (!mesaAtualizada) {
      alert("Não foi possível imprimir o pedido da cozinha.");
      return;
    }

    const itens = obterItensMesa(mesaAtualizada.id);
    abrirJanelaImpressao(
      `Cozinha Mesa ${mesaAtualizada.numero}`,
      montarConteudoCozinha(mesaAtualizada, itens)
    );
  }

  const mesasComTotais = useMemo(() => {
    return mesas.map((mesa) => {
      const itens = obterItensMesa(mesa.id);
      const total = totalConsumo(itens);
      const itensQuantidade = quantidadeItens(itens);

      return {
        mesa,
        itens,
        total,
        itensQuantidade,
      };
    });
  }, [mesas, consumos]);

  const resumo = useMemo(() => {
    const valorReceber = mesasComTotais.reduce((soma, item) => soma + item.total, 0);
    const fechamento = mesas.filter((mesa) => mesa.status === "Fechamento").length;
    const consumindo = mesas.filter((mesa) => mesa.status === "Consumindo").length;
    const reservada = mesas.filter((mesa) => mesa.status === "Reservada").length;
    const livre = mesas.filter((mesa) => mesa.status === "Livre").length;
    const ocupadas = mesas.length - livre;
    const ocupacao = mesas.length > 0 ? Math.round((ocupadas / mesas.length) * 100) : 0;

    return {
      valorReceber,
      fechamento,
      consumindo,
      reservada,
      livre,
      ocupacao,
    };
  }, [mesas, mesasComTotais]);

  const mesasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const filtradas = mesasComTotais.filter(({ mesa, total }) => {
      const bateStatus = filtroStatus === "Todas" || mesa.status === filtroStatus;
      const textoBusca = [
        mesa.numero,
        mesa.status,
        mesa.cliente,
        mesa.observacao,
        total,
      ]
        .join(" ")
        .toLowerCase();

      const bateBusca = !termo || textoBusca.includes(termo);

      return bateStatus && bateBusca;
    });

    return filtradas.sort((a, b) => {
      if (ordenacao === "status") {
        return a.mesa.status.localeCompare(b.mesa.status) || a.mesa.numero - b.mesa.numero;
      }

      if (ordenacao === "valor") {
        return b.total - a.total || a.mesa.numero - b.mesa.numero;
      }

      return a.mesa.numero - b.mesa.numero;
    });
  }, [mesasComTotais, busca, filtroStatus, ordenacao]);

  const itensMesaSelecionada = mesaSelecionada ? obterItensMesa(mesaSelecionada.id) : [];
  const totalMesaSelecionada = totalConsumo(itensMesaSelecionada);

  return (
    <main className="min-h-screen bg-[#f7f1e8] text-zinc-900">
      <header className="bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-400">
              Samambaia Restaurante e Pizzaria
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
              PDV | Mapa de Mesas
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              Controle de mesas, consumo, conta, cozinha e fechamento no PDV.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/pdv"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
            >
              Voltar para balcão
            </a>
            <a
              href="/pdv/comanda"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
            >
              Comandas
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Valor a receber</p>
            <p className="mt-2 text-3xl font-black text-orange-600">{moeda(resumo.valorReceber)}</p>
            <p className="mt-1 text-xs text-zinc-500">Total lançado em mesas</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Fechamento</p>
            <p className="mt-2 text-3xl font-black text-red-600">{resumo.fechamento}</p>
            <p className="mt-1 text-xs text-zinc-500">Aguardando pagamento</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Consumindo</p>
            <p className="mt-2 text-3xl font-black text-blue-700">{resumo.consumindo}</p>
            <p className="mt-1 text-xs text-zinc-500">Mesas abertas</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Reservada</p>
            <p className="mt-2 text-3xl font-black text-yellow-600">{resumo.reservada}</p>
            <p className="mt-1 text-xs text-zinc-500">Reservas ativas</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Livre</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{resumo.livre}</p>
            <p className="mt-1 text-xs text-zinc-500">Mesas disponíveis</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Ocupação</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{resumo.ocupacao}%</p>
            <p className="mt-1 text-xs text-zinc-500">Uso atual do salão</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_180px]">
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por número da mesa, cliente, status ou observação..."
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
            />

            <select
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value as StatusMesa | "Todas")}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
            >
              <option value="Todas">Todas as mesas</option>
              <option value="Livre">Livre</option>
              <option value="Consumindo">Consumindo</option>
              <option value="Reservada">Reservada</option>
              <option value="Fechamento">Fechamento</option>
            </select>

            <select
              value={ordenacao}
              onChange={(event) => setOrdenacao(event.target.value as "numero" | "status" | "valor")}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
            >
              <option value="numero">Ordenar por número</option>
              <option value="status">Ordenar por status</option>
              <option value="valor">Ordenar por valor</option>
            </select>

            <button
              type="button"
              onClick={limparTodasAsMesas}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-700"
            >
              Resetar mesas
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {mesasFiltradas.map(({ mesa, total, itensQuantidade }) => (
            <button
              key={mesa.id}
              type="button"
              onClick={() => abrirModalMesa(mesa)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:brightness-95 ${classeStatus(
                mesa.status
              )}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Mesa</p>
                  <p className="mt-1 text-4xl font-black">{mesa.numero}</p>
                </div>

                <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeStatus(mesa.status)}`}>
                  {mesa.status}
                </span>
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-sm font-bold">
                  {mesa.cliente || (mesa.status === "Livre" ? "Disponível" : "Mesa sem nome")}
                </p>
                <p className="text-xs opacity-70">{mesa.pessoas || 1} pessoa(s)</p>
                <p className="text-xs opacity-70">{itensQuantidade} item(ns)</p>
              </div>

              <div className="mt-4 rounded-xl bg-white/70 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">Total</p>
                <p className="mt-1 text-2xl font-black">{moeda(total)}</p>
              </div>
            </button>
          ))}
        </div>

        {mesasFiltradas.length === 0 && (
          <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-8 text-center text-zinc-500">
            Nenhuma mesa encontrada para os filtros selecionados.
          </div>
        )}
      </section>

      {mesaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white">
            <div className="sticky top-0 z-10 flex flex-col gap-4 border-b border-zinc-100 bg-white p-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                  Mesa selecionada
                </p>
                <h2 className="mt-1 text-2xl font-black text-zinc-950">
                  Mesa {mesaSelecionada.numero}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Status atual: {mesaSelecionada.status} · Aberta em: {dataHoraBR(mesaSelecionada.abertaEm)}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModalMesa}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px]">
              <div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      Cliente / identificação
                    </span>
                    <input
                      type="text"
                      value={clienteModal}
                      onChange={(event) => setClienteModal(event.target.value)}
                      placeholder="Exemplo: João, Família Silva, Mesa 10..."
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      Pessoas
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={pessoasModal}
                      onChange={(event) => setPessoasModal(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                    />
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                    Observação
                  </span>
                  <textarea
                    value={observacaoModal}
                    onChange={(event) => setObservacaoModal(event.target.value)}
                    placeholder="Exemplo: aniversário, preferência, reserva, observação interna..."
                    className="mt-1 min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                  />
                </label>

                <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-zinc-950">Consumo lançado</h3>
                      <p className="text-sm text-zinc-500">
                        Itens que já foram enviados para esta mesa.
                      </p>
                    </div>

                    <p className="rounded-lg bg-white px-3 py-2 text-sm font-black text-orange-700">
                      {itensMesaSelecionada.length} item(ns)
                    </p>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-zinc-950 text-white">
                          <th className="px-3 py-3 text-left font-black">Item</th>
                          <th className="px-3 py-3 text-right font-black">Qtd.</th>
                          <th className="px-3 py-3 text-right font-black">Unit.</th>
                          <th className="px-3 py-3 text-right font-black">Total</th>
                        </tr>
                      </thead>

                      <tbody>
                        {itensMesaSelecionada.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                              Nenhum item lançado nesta mesa.
                            </td>
                          </tr>
                        ) : (
                          itensMesaSelecionada.map((item, index) => (
                            <tr
                              key={`${item.id}-${index}`}
                              className={index % 2 === 0 ? "bg-white" : "bg-orange-50"}
                            >
                              <td className="px-3 py-3">
                                <p className="font-black text-zinc-950">{item.nome}</p>
                                <p className="text-xs text-zinc-500">
                                  {[item.categoria, item.tipo].filter(Boolean).join(" / ") || "-"}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-right">{item.quantidade}</td>
                              <td className="px-3 py-3 text-right">{moeda(item.valorUnitario)}</td>
                              <td className="px-3 py-3 text-right font-black">{moeda(item.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-orange-100 bg-zinc-950 p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                    Total da mesa
                  </p>
                  <p className="mt-2 text-4xl font-black">{moeda(totalMesaSelecionada)}</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {quantidadeItens(itensMesaSelecionada)} item(ns) lançado(s)
                  </p>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={lancarOuEditarConsumo}
                    className="rounded-lg bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-600"
                  >
                    Lançar / editar consumo
                  </button>

                  <button
                    type="button"
                    onClick={fecharPagarNoPDV}
                    className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                  >
                    Fechar / pagar no PDV
                  </button>

                  <button
                    type="button"
                    onClick={imprimirConta}
                    className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-700"
                  >
                    Imprimir conta
                  </button>

                  <button
                    type="button"
                    onClick={imprimirCozinha}
                    className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-700"
                  >
                    Imprimir cozinha
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const mesaAtualizada = salvarDadosMesa();
                      if (mesaAtualizada) alert(`Mesa ${mesaAtualizada.numero} atualizada.`);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"
                  >
                    Abrir / atualizar
                  </button>

                  <button
                    type="button"
                    onClick={reservarMesa}
                    className="rounded-lg bg-yellow-500 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-yellow-400"
                  >
                    Reservar
                  </button>

                  <button
                    type="button"
                    onClick={colocarMesaEmFechamento}
                    className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                  >
                    Colocar em fechamento
                  </button>

                  <button
                    type="button"
                    onClick={liberarMesa}
                    className="rounded-lg bg-zinc-200 px-4 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-300"
                  >
                    Liberar mesa
                  </button>

                  <button
                    type="button"
                    onClick={cancelarConsumoELiberarMesa}
                    className="rounded-lg bg-red-100 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-200"
                  >
                    Cancelar consumo e liberar
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
