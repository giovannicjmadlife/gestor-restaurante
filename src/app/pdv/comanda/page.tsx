"use client";

import { useEffect, useMemo, useState } from "react";

type StatusComanda = "Consumindo" | "Fechamento";

type Comanda = {
  id: string;
  nome: string;
  documento: string;
  status: StatusComanda;
  criadaEm: string;
  observacao: string;
};

type CartItem = {
  id: string;
  produtoId: string;
  codigo: string;
  nome: string;
  categoria: string;
  tipo: string;
  precoUnitario: number;
  quantidade: number;
  total: number;
  porQuilo: boolean;
  unidade: "un" | "kg";
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

const LS_COMANDAS = "gestor-restaurante-comandas";
const LS_COMANDA_CONSUMOS = "gestor-restaurante-comanda-consumos";
const LS_ATENDIMENTO_ATUAL = "gestor-restaurante-pdv-atendimento-atual";

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

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getStatusClass(status: StatusComanda) {
  if (status === "Fechamento") {
    return "border-red-700 bg-red-500 text-white";
  }

  return "border-sky-700 bg-sky-500 text-white";
}

export default function ComandaPage() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [consumos, setConsumos] = useState<ComandaConsumo[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"Todos" | StatusComanda>(
    "Todos"
  );

  const [modalAberto, setModalAberto] = useState(false);
  const [comandaSelecionada, setComandaSelecionada] =
    useState<Comanda | null>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacao, setObservacao] = useState("");

  function carregarDados() {
    const comandasSalvas = safeJsonArray<Comanda>(
      localStorage.getItem(LS_COMANDAS)
    );

    const consumosSalvos = safeJsonArray<ComandaConsumo>(
      localStorage.getItem(LS_COMANDA_CONSUMOS)
    );

    setComandas(comandasSalvas);
    setConsumos(consumosSalvos);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function salvarComandas(novasComandas: Comanda[]) {
    setComandas(novasComandas);
    localStorage.setItem(LS_COMANDAS, JSON.stringify(novasComandas));
  }

  function salvarConsumos(novosConsumos: ComandaConsumo[]) {
    setConsumos(novosConsumos);
    localStorage.setItem(LS_COMANDA_CONSUMOS, JSON.stringify(novosConsumos));
  }

  function getConsumoAberto(comandaId: string) {
    return consumos.find(
      (consumo) =>
        consumo.comandaId === comandaId && consumo.status === "Aberto"
    );
  }

  const resumo = useMemo(() => {
    const abertas = comandas.filter(
      (comanda) => comanda.status === "Consumindo"
    ).length;

    const fechamento = comandas.filter(
      (comanda) => comanda.status === "Fechamento"
    ).length;

    const valorAReceber = consumos
      .filter((consumo) => consumo.status === "Aberto")
      .reduce((total, consumo) => total + (consumo.total || 0), 0);

    return {
      abertas,
      fechamento,
      total: comandas.length,
      valorAReceber,
    };
  }, [comandas, consumos]);

  const consumoSelecionado = useMemo(() => {
    if (!comandaSelecionada) return null;
    return getConsumoAberto(comandaSelecionada.id);
  }, [comandaSelecionada, consumos]);

  const comandasFiltradas = useMemo(() => {
    const buscaNormalizada = normalizeText(busca);

    return comandas
      .filter((comanda) => {
        const consumo = getConsumoAberto(comanda.id);

        const texto = normalizeText(
          `${comanda.nome} ${comanda.documento} ${comanda.status} ${
            consumo?.total || ""
          }`
        );

        const bateBusca = !buscaNormalizada || texto.includes(buscaNormalizada);

        const bateStatus =
          filtroStatus === "Todos" || comanda.status === filtroStatus;

        return bateBusca && bateStatus;
      })
      .sort((a, b) => {
        return new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime();
      });
  }, [comandas, consumos, busca, filtroStatus]);

  function abrirNovaComanda() {
    setComandaSelecionada(null);
    setNome("");
    setDocumento("");
    setObservacao("");
    setModalAberto(true);
  }

  function abrirModalComanda(comanda: Comanda) {
    setComandaSelecionada(comanda);
    setNome(comanda.nome);
    setDocumento(comanda.documento);
    setObservacao(comanda.observacao);
    setModalAberto(true);
  }

  function criarOuAtualizarComanda(status: StatusComanda) {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      alert("Informe o nome da comanda ou cliente.");
      return null;
    }

    const agora = new Date();

    if (comandaSelecionada) {
      let comandaAtualizada: Comanda | null = null;

      const novasComandas = comandas.map((comanda) => {
        if (comanda.id !== comandaSelecionada.id) return comanda;

        comandaAtualizada = {
          ...comanda,
          nome: nomeLimpo,
          documento: documento.trim(),
          observacao: observacao.trim(),
          status,
        };

        return comandaAtualizada;
      });

      salvarComandas(novasComandas);
      return comandaAtualizada;
    }

    const novaComanda: Comanda = {
      id: uid(),
      nome: nomeLimpo,
      documento: documento.trim(),
      status,
      criadaEm: agora.toISOString(),
      observacao: observacao.trim(),
    };

    salvarComandas([novaComanda, ...comandas]);
    return novaComanda;
  }

  function salvarComanda() {
    const comanda = criarOuAtualizarComanda("Consumindo");

    if (!comanda) return;

    setModalAberto(false);
    setComandaSelecionada(null);

    alert("Comanda salva com sucesso.");
  }

  function enviarParaPdv(status: StatusComanda) {
    const comanda = criarOuAtualizarComanda(status);

    if (!comanda) return;

    const atendimento: AtendimentoAtual = {
      tipo: "Comanda",
      comandaId: comanda.id,
      comandaNome: comanda.nome,
      documento: comanda.documento,
      cliente: comanda.nome,
      iniciadoEm: new Date().toISOString(),
    };

    localStorage.setItem(LS_ATENDIMENTO_ATUAL, JSON.stringify(atendimento));

    window.location.href = "/pdv";
  }

  function lancarEditarConsumo() {
    enviarParaPdv("Consumindo");
  }

  function fecharPagarNoPdv() {
    if (!comandaSelecionada) {
      alert("Salve a comanda antes de fechar.");
      return;
    }

    const consumo = getConsumoAberto(comandaSelecionada.id);

    if (!consumo || consumo.itens.length === 0) {
      alert("Esta comanda ainda não tem consumo lançado.");
      return;
    }

    enviarParaPdv("Fechamento");
  }

  function colocarEmFechamento() {
    const comanda = criarOuAtualizarComanda("Fechamento");

    if (!comanda) return;

    setModalAberto(false);
    setComandaSelecionada(null);

    alert("Comanda colocada em fechamento.");
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

  function gerarHtmlContaComanda() {
    if (!comandaSelecionada || !consumoSelecionado) return "";

    const agora = new Date();

    const itensHtml = consumoSelecionado.itens
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
          <title>Conta da comanda</title>
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
            h1, p { margin: 0; }
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
            .comanda {
              margin-top: 6px;
              font-size: 24px;
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
            <p class="comanda">Comanda ${escapeHtml(comandaSelecionada.nome)}</p>
          </div>

          <div class="info">
            <p><strong>Data:</strong> ${escapeHtml(agora.toLocaleString("pt-BR"))}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(
              consumoSelecionado.cliente || comandaSelecionada.nome || "-"
            )}</p>
            <p><strong>Documento:</strong> ${escapeHtml(
              consumoSelecionado.documento || comandaSelecionada.documento || "-"
            )}</p>
          </div>

          <table>
            <tbody>${itensHtml}</tbody>
          </table>

          <div class="total">
            <span>Total da comanda</span>
            <strong>${money(consumoSelecionado.total)}</strong>
          </div>

          <div class="footer">
            <p>Conferência de consumo</p>
            <p>Não é documento fiscal</p>
          </div>
        </body>
      </html>
    `;
  }

  function gerarHtmlPedidoCozinhaComanda() {
    if (!comandaSelecionada || !consumoSelecionado) return "";

    const agora = new Date();

    const itensHtml = consumoSelecionado.itens
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
          <title>Pedido cozinha comanda</title>
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
            h1, p { margin: 0; }
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
            <p class="place">Comanda ${escapeHtml(comandaSelecionada.nome)}</p>
          </div>

          <div class="info">
            <p><strong>Data:</strong> ${escapeHtml(agora.toLocaleString("pt-BR"))}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(
              consumoSelecionado.cliente || comandaSelecionada.nome || "-"
            )}</p>
            <p><strong>Documento:</strong> ${escapeHtml(
              consumoSelecionado.documento || comandaSelecionada.documento || "-"
            )}</p>
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

  function imprimirContaComanda() {
    if (!comandaSelecionada || !consumoSelecionado) {
      alert("Esta comanda ainda não possui consumo para imprimir.");
      return;
    }

    if (consumoSelecionado.itens.length === 0) {
      alert("Esta comanda ainda não possui itens lançados.");
      return;
    }

    imprimirHtml(gerarHtmlContaComanda());
  }

  function imprimirPedidoCozinhaComanda() {
    if (!comandaSelecionada || !consumoSelecionado) {
      alert("Esta comanda ainda não possui consumo para imprimir na cozinha.");
      return;
    }

    if (consumoSelecionado.itens.length === 0) {
      alert("Esta comanda ainda não possui itens lançados.");
      return;
    }

    imprimirHtml(gerarHtmlPedidoCozinhaComanda());
  }

  function liberarComanda() {
    if (!comandaSelecionada) {
      setModalAberto(false);
      return;
    }

    const consumo = getConsumoAberto(comandaSelecionada.id);

    if (consumo && consumo.itens.length > 0) {
      alert(
        `Esta comanda possui consumo aberto de ${money(
          consumo.total
        )}. Use "Fechar / pagar no PDV" antes de liberar.`
      );
      return;
    }

    const confirmar = confirm(
      `Deseja liberar/remover a comanda ${comandaSelecionada.nome}?`
    );

    if (!confirmar) return;

    const novasComandas = comandas.filter(
      (comanda) => comanda.id !== comandaSelecionada.id
    );

    salvarComandas(novasComandas);

    setModalAberto(false);
    setComandaSelecionada(null);

    alert("Comanda liberada.");
  }

  function cancelarConsumoELiberar() {
    if (!comandaSelecionada) return;

    const consumo = getConsumoAberto(comandaSelecionada.id);

    const confirmar = confirm(
      consumo
        ? `Deseja cancelar o consumo de ${money(
            consumo.total
          )} e liberar a comanda?`
        : "Deseja liberar esta comanda?"
    );

    if (!confirmar) return;

    if (consumo) {
      const novosConsumos = consumos.filter((item) => item.id !== consumo.id);
      salvarConsumos(novosConsumos);
    }

    const novasComandas = comandas.filter(
      (comanda) => comanda.id !== comandaSelecionada.id
    );

    salvarComandas(novasComandas);
    localStorage.removeItem(LS_ATENDIMENTO_ATUAL);

    setModalAberto(false);
    setComandaSelecionada(null);

    alert("Comanda liberada com sucesso.");
  }

  return (
    <main className="min-h-screen bg-[#f7f3ee] text-[#111111]">
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
              <p className="text-base font-bold text-white">Adm</p>
            </div>
          </div>

          <nav className="mt-3 space-y-1 px-2">
            <a
              href="/pdv"
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">🧾</span>
              Balcão
            </a>

            <a
              href="/pdv/comanda"
              className="flex w-full items-center gap-2 rounded-md bg-[#f97316] px-3 py-3 text-left text-sm font-bold text-white"
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

            <a
              href="/"
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">🔄</span>
              Painel
            </a>
          </nav>
        </aside>

        <section className="flex-1 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold lowercase text-slate-500">pdv</p>
              <h1 className="text-2xl font-black text-[#f97316]">
                Comandas
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/pdv"
                className="rounded-xl bg-[#111111] px-4 py-3 text-sm font-black uppercase text-white hover:bg-[#232323]"
              >
                voltar para balcão
              </a>

              <button
                onClick={abrirNovaComanda}
                className="rounded-xl bg-[#f97316] px-4 py-3 text-sm font-black uppercase text-white hover:bg-[#ea580c]"
              >
                nova comanda
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[#f1d2ba] bg-white p-4 text-center">
              <p className="text-3xl font-black text-[#f97316]">
                {money(resumo.valorAReceber)}
              </p>
              <p className="text-sm font-bold text-slate-600">Valor a receber</p>
            </div>

            <div className="rounded-xl bg-sky-500 p-4 text-center text-white">
              <p className="text-3xl font-black">{resumo.abertas}</p>
              <p className="text-sm font-bold">Consumindo</p>
            </div>

            <div className="rounded-xl bg-red-500 p-4 text-center text-white">
              <p className="text-3xl font-black">{resumo.fechamento}</p>
              <p className="text-sm font-bold">Fechamento</p>
            </div>

            <div className="rounded-xl bg-[#111111] p-4 text-center text-[#f97316]">
              <p className="text-3xl font-black">{resumo.total}</p>
              <p className="text-sm font-bold">Comandas abertas</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#f1d2ba] bg-white p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex h-11 overflow-hidden rounded-lg border border-[#e8d2c0] bg-[#fffaf6]">
                <div className="flex w-11 items-center justify-center">🔎</div>
                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Procurar comanda"
                  className="flex-1 bg-transparent px-2 text-sm outline-none"
                />
              </div>

              <select
                value={filtroStatus}
                onChange={(event) =>
                  setFiltroStatus(event.target.value as "Todos" | StatusComanda)
                }
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                <option>Todos</option>
                <option>Consumindo</option>
                <option>Fechamento</option>
              </select>

              <button
                onClick={abrirNovaComanda}
                className="h-11 rounded-lg bg-[#f97316] text-sm font-black uppercase text-white hover:bg-[#ea580c]"
              >
                nova comanda
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#f1d2ba] bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase text-[#111111]">
                  Clientes Comanda
                </h2>
                <div className="mt-2 h-1 w-14 rounded bg-[#f97316]" />
              </div>

              <p className="text-sm font-semibold text-slate-600">
                Clique em uma comanda para ver consumo, lançar mais produtos ou
                fechar/pagar.
              </p>
            </div>

            {comandasFiltradas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-[#fffaf6] p-8 text-center">
                <p className="text-lg font-black text-[#111111]">
                  Nenhuma comanda aberta
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Clique em “Nova comanda” para começar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {comandasFiltradas.map((comanda) => {
                  const consumo = getConsumoAberto(comanda.id);

                  return (
                    <button
                      key={comanda.id}
                      onClick={() => abrirModalComanda(comanda)}
                      className={`min-h-[170px] rounded-xl border-2 p-4 text-left transition hover:scale-[1.01] ${getStatusClass(
                        comanda.status
                      )}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase opacity-80">
                            Comanda
                          </p>
                          <h3 className="mt-1 text-2xl font-black">
                            {comanda.nome}
                          </h3>
                        </div>

                        <span className="rounded-full bg-black/20 px-2 py-1 text-[11px] font-black uppercase">
                          {comanda.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm font-bold">
                        <p>Documento: {comanda.documento || "-"}</p>
                        <p>Criada: {formatDateTime(comanda.criadaEm)}</p>
                      </div>

                      {consumo ? (
                        <div className="mt-4 rounded-lg bg-black/25 px-3 py-2 text-center">
                          <p className="text-xs font-black uppercase">
                            Consumo aberto
                          </p>
                          <p className="text-2xl font-black">
                            {money(consumo.total)}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg bg-white/20 px-3 py-2 text-center text-sm font-black">
                          Sem consumo lançado
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10">
          <div className="w-full max-w-[720px] rounded-2xl border-2 border-[#f97316] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase text-slate-500">
                  {comandaSelecionada ? "Comanda selecionada" : "Nova comanda"}
                </p>
                <h2 className="text-3xl font-black text-[#111111]">
                  {comandaSelecionada?.nome || "Adicionar comanda"}
                </h2>
              </div>

              <button
                onClick={() => setModalAberto(false)}
                className="text-3xl font-black text-[#111111]"
              >
                ✕
              </button>
            </div>

            {comandaSelecionada && (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-[#111111] p-4 text-white">
                  <div className="flex justify-between">
                    <span className="font-bold text-white/70">
                      Status atual
                    </span>
                    <strong className="text-xl text-[#f97316]">
                      {comandaSelecionada.status}
                    </strong>
                  </div>

                  <div className="mt-2 flex justify-between">
                    <span className="font-bold text-white/70">Criada em</span>
                    <strong>{formatDateTime(comandaSelecionada.criadaEm)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border-2 border-[#f1d2ba] bg-[#fffaf6] p-4">
                  <p className="text-xs font-black uppercase text-slate-500">
                    Total lançado
                  </p>
                  <p className="mt-1 text-4xl font-black text-[#f97316]">
                    {money(consumoSelecionado?.total || 0)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-600">
                    {consumoSelecionado
                      ? `${consumoSelecionado.itens.length} item(ns) em aberto`
                      : "Nenhum consumo lançado"}
                  </p>
                </div>
              </div>
            )}

            <label className="mt-5 block text-sm font-black uppercase text-[#111111]">
              Nome do cliente / comanda
            </label>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex: Giovanni, Marcos, Hotel 12"
              className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
            />

            <label className="mt-4 block text-sm font-black uppercase text-[#111111]">
              Documento
            </label>
            <input
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
              placeholder="CPF/CNPJ, quarto, placa, referência..."
              className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
            />

            <label className="mt-4 block text-sm font-black uppercase text-[#111111]">
              Observação
            </label>
            <textarea
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              placeholder="Observações da comanda"
              className="mt-2 min-h-[80px] w-full rounded-xl border-2 border-[#f1d2ba] px-3 py-3 text-base font-bold outline-none"
            />

            <div className="mt-5 rounded-2xl border-2 border-[#f1d2ba] bg-[#fffaf6] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black uppercase text-[#111111]">
                  Consumo lançado
                </h3>

                <strong className="text-2xl font-black text-[#f97316]">
                  {money(consumoSelecionado?.total || 0)}
                </strong>
              </div>

              {!consumoSelecionado || consumoSelecionado.itens.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-semibold text-slate-500">
                  Nenhum produto lançado nesta comanda ainda.
                </div>
              ) : (
                <div className="max-h-[260px] space-y-3 overflow-y-auto">
                  {consumoSelecionado.itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-white p-3"
                    >
                      <div>
                        <p className="font-black uppercase text-[#111111]">
                          {item.nome}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {item.porQuilo
                            ? `${item.quantidade.toFixed(3)} kg x ${money(
                                item.precoUnitario
                              )}`
                            : `${item.quantidade} un x ${money(
                                item.precoUnitario
                              )}`}
                        </p>
                      </div>

                      <strong className="text-lg font-black text-[#111111]">
                        {money(item.total)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                onClick={lancarEditarConsumo}
                className="rounded-xl bg-[#f97316] py-4 text-base font-black uppercase text-white hover:bg-[#ea580c]"
              >
                Lançar / editar consumo
              </button>

              <button
                onClick={fecharPagarNoPdv}
                className="rounded-xl bg-[#111111] py-4 text-base font-black uppercase text-[#f97316] hover:bg-[#232323]"
              >
                Fechar / pagar no PDV
              </button>

              <button
                onClick={imprimirContaComanda}
                className="rounded-xl border-2 border-[#f97316] bg-white py-4 text-base font-black uppercase text-[#f97316] hover:bg-[#fff4eb]"
              >
                Imprimir conta
              </button>

              <button
                onClick={imprimirPedidoCozinhaComanda}
                className="rounded-xl bg-[#111111] py-4 text-base font-black uppercase text-white hover:bg-[#232323]"
              >
                Imprimir cozinha
              </button>

              <button
                onClick={salvarComanda}
                className="rounded-xl bg-green-600 py-4 text-base font-black uppercase text-white hover:bg-green-700"
              >
                Criar / atualizar
              </button>

              <button
                onClick={colocarEmFechamento}
                className="rounded-xl bg-red-500 py-4 text-base font-black uppercase text-white hover:bg-red-600"
              >
                Colocar em fechamento
              </button>

              <button
                onClick={liberarComanda}
                className="rounded-xl bg-slate-700 py-4 text-base font-black uppercase text-white hover:bg-slate-800"
              >
                Liberar comanda
              </button>

              <button
                onClick={() => setModalAberto(false)}
                className="rounded-xl border-2 border-[#f97316] bg-white py-4 text-base font-black uppercase text-[#f97316]"
              >
                Cancelar
              </button>
            </div>

            {comandaSelecionada && (
              <button
                onClick={cancelarConsumoELiberar}
                className="mt-3 w-full rounded-xl border-2 border-red-600 bg-white py-3 text-sm font-black uppercase text-red-600 hover:bg-red-50"
              >
                Cancelar consumo e liberar comanda
              </button>
            )}

            <p className="mt-4 text-xs text-slate-500">
              Use “Lançar / editar consumo” para adicionar produtos na comanda.
              Use “Fechar / pagar no PDV” quando o cliente pedir a conta.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
