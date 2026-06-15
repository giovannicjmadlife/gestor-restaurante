"use client";

import { useEffect, useMemo, useState } from "react";

type RegistroRaw = Record<string, unknown>;

type RegistroCaixa = {
  id: string;
  caixaId: string;
  data: string;
  dataHora: string;
  operador: string;
  tipoVenda: string;
  status: string;
  tipoDocumento: string;
  consumidor: string;
  formaPagamento: string;
  senha: string;
  valor: number;
  valorBruto: number;
  observacao: string;
  raw: RegistroRaw;
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

const LS_VENDAS_DETALHADAS = "gestor-restaurante-vendas-detalhadas";
const LS_CAIXA_ATUAL = "gestor-restaurante-caixa-atual";
const LS_CAIXAS = "gestor-restaurante-caixas";
const LS_CAIXAS_HISTORICO = "gestor-restaurante-caixas-historico";

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
    timeStyle: "medium",
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRegistroView(raw: RegistroRaw, index: number): RegistroCaixa {
  const dataHora =
    asString(raw.dataHora) ||
    asString(raw.criadoEm) ||
    asString(raw.abertoEm) ||
    asString(raw.fechadoEm) ||
    new Date().toISOString();

  const data = asString(raw.data) || dataHora.slice(0, 10) || todayInputDate();

  const valorBruto =
    asNumber(raw.valorBruto) ||
    asNumber(raw.valorLiquido) ||
    asNumber(raw.valor) ||
    0;

  const valor = asNumber(raw.valor) || valorBruto;

  return {
    id: asString(raw.id) || `registro-${index}`,
    caixaId: asString(raw.caixaId),
    data,
    dataHora,
    operador: asString(raw.operador, "Adm"),
    tipoVenda: asString(raw.tipoVenda, "Balcão"),
    status: asString(raw.status, "Finalizado"),
    tipoDocumento: asString(raw.tipoDocumento, "Gerencial"),
    consumidor:
      asString(raw.consumidor) ||
      asString(raw.cliente) ||
      asString(raw.descricao) ||
      "Não identificado",
    formaPagamento:
      asString(raw.formaPagamento) ||
      asString(raw.formaRecebimento) ||
      asString(raw.forma) ||
      "-",
    senha: asString(raw.senha) || asString(raw.numero) || String(index + 1),
    valor,
    valorBruto,
    observacao: asString(raw.observacao),
    raw,
  };
}

function getStatusClass(status: string) {
  const statusNormalizado = normalizeText(status);

  if (statusNormalizado.includes("finalizado")) {
    return "text-green-700";
  }

  if (statusNormalizado.includes("cancelado")) {
    return "text-red-700";
  }

  if (statusNormalizado.includes("abertura")) {
    return "text-blue-700";
  }

  if (statusNormalizado.includes("refor")) {
    return "text-emerald-700";
  }

  if (
    statusNormalizado.includes("sangria") ||
    statusNormalizado.includes("retirada")
  ) {
    return "text-orange-700";
  }

  if (statusNormalizado.includes("fechamento")) {
    return "text-purple-700";
  }

  return "text-slate-700";
}

function valorBaseRegistro(registro: RegistroCaixa) {
  return registro.valorBruto || registro.valor || 0;
}

function valorExibicaoRegistro(registro: RegistroCaixa) {
  const status = normalizeText(registro.status);
  const valor = Math.abs(valorBaseRegistro(registro));

  if (status.includes("sangria") || status.includes("retirada")) {
    return -valor;
  }

  return valor;
}

function valorRegistroNoTotal(registro: RegistroCaixa) {
  const status = normalizeText(registro.status);

  if (status.includes("cancelado")) return 0;
  if (status.includes("fechamento")) return 0;

  return valorExibicaoRegistro(registro);
}

function baixarCsv(nomeArquivo: string, linhas: string[][]) {
  const csv = linhas
    .map((linha) =>
      linha
        .map((celula) => {
          const texto = String(celula ?? "");
          return `"${texto.replace(/"/g, '""')}"`;
        })
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(url);
}

export default function OperacoesCaixaPage() {
  const [registros, setRegistros] = useState<RegistroCaixa[]>([]);
  const [caixaAtual, setCaixaAtual] = useState<CaixaAtual | null>(null);

  const [tipoDocumento, setTipoDocumento] = useState("Todos");
  const [tipoVenda, setTipoVenda] = useState("Todos");
  const [formaPagamento, setFormaPagamento] = useState("Todos");
  const [statusVenda, setStatusVenda] = useState("Todos");
  const [operador, setOperador] = useState("Todos");
  const [periodo, setPeriodo] = useState("hoje");
  const [busca, setBusca] = useState("");

  const [mostrarReforco, setMostrarReforco] = useState(false);
  const [mostrarSangria, setMostrarSangria] = useState(false);
  const [mostrarFechamento, setMostrarFechamento] = useState(false);

  const [valorReforco, setValorReforco] = useState("");
  const [motivoReforco, setMotivoReforco] = useState("");

  const [valorSangria, setValorSangria] = useState("");
  const [motivoSangria, setMotivoSangria] = useState("");

  const [fechamentoDinheiro, setFechamentoDinheiro] = useState("");
  const [fechamentoDebito, setFechamentoDebito] = useState("");
  const [fechamentoCredito, setFechamentoCredito] = useState("");
  const [fechamentoPix, setFechamentoPix] = useState("");
  const [considerarAbertura, setConsiderarAbertura] = useState(true);

  function carregarDados() {
    const vendas = safeJsonArray<RegistroRaw>(
      localStorage.getItem(LS_VENDAS_DETALHADAS)
    );

    const mapeados = vendas
      .map((registro, index) => getRegistroView(registro, index))
      .sort((a, b) => {
        const dataA = new Date(a.dataHora).getTime();
        const dataB = new Date(b.dataHora).getTime();

        return dataB - dataA;
      });

    setRegistros(mapeados);

    const caixaSalvo = safeJsonObject<CaixaAtual>(
      localStorage.getItem(LS_CAIXA_ATUAL)
    );

    if (caixaSalvo?.status === "Aberto") {
      setCaixaAtual(caixaSalvo);
    } else {
      setCaixaAtual(null);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const caixaAberto = caixaAtual?.status === "Aberto";

  const operadores = useMemo(() => {
    const lista = registros
      .map((registro) => registro.operador)
      .filter(Boolean);

    return ["Todos", ...Array.from(new Set(lista))];
  }, [registros]);

  const registrosDoCaixaAtual = useMemo(() => {
    if (!caixaAtual) return [];

    return registros.filter((registro) => registro.caixaId === caixaAtual.id);
  }, [registros, caixaAtual]);

  const automaticoFechamento = useMemo(() => {
    let dinheiro = considerarAbertura ? caixaAtual?.valorAbertura || 0 : 0;
    let debito = 0;
    let credito = 0;
    let pix = 0;

    registrosDoCaixaAtual.forEach((registro) => {
      const status = normalizeText(registro.status);
      const forma = normalizeText(registro.formaPagamento);
      const valor = Math.abs(valorBaseRegistro(registro));

      if (status.includes("fechamento")) {
        return;
      }

      if (status.includes("finalizado")) {
        if (forma.includes("dinheiro")) dinheiro += valor;
        else if (forma.includes("debito") || forma.includes("débito"))
          debito += valor;
        else if (forma.includes("credito") || forma.includes("crédito"))
          credito += valor;
        else if (forma.includes("pix")) pix += valor;
      }

      if (status.includes("refor")) {
        dinheiro += Math.abs(valorBaseRegistro(registro));
      }

      if (status.includes("sangria") || status.includes("retirada")) {
        dinheiro -= Math.abs(valorBaseRegistro(registro));
      }
    });

    const total = dinheiro + debito + credito + pix;

    return {
      dinheiro,
      debito,
      credito,
      pix,
      total,
    };
  }, [registrosDoCaixaAtual, caixaAtual, considerarAbertura]);

  const valoresInformadosFechamento = useMemo(() => {
    const dinheiro = asNumber(fechamentoDinheiro);
    const debito = asNumber(fechamentoDebito);
    const credito = asNumber(fechamentoCredito);
    const pix = asNumber(fechamentoPix);

    return {
      dinheiro,
      debito,
      credito,
      pix,
      total: dinheiro + debito + credito + pix,
    };
  }, [
    fechamentoDinheiro,
    fechamentoDebito,
    fechamentoCredito,
    fechamentoPix,
  ]);

  const diferencaFechamento = useMemo(() => {
    return Number(
      (
        valoresInformadosFechamento.total - automaticoFechamento.total
      ).toFixed(2)
    );
  }, [valoresInformadosFechamento, automaticoFechamento]);

  const registrosFiltrados = useMemo(() => {
    const buscaNormalizada = normalizeText(busca);

    return registros.filter((registro) => {
      const hoje = todayInputDate();

      const batePeriodo =
        periodo === "todos" ||
        (periodo === "hoje" && registro.data === hoje) ||
        (periodo === "caixa-atual" &&
          caixaAtual &&
          registro.caixaId === caixaAtual.id);

      const bateTipoDocumento =
        tipoDocumento === "Todos" || registro.tipoDocumento === tipoDocumento;

      const bateTipoVenda =
        tipoVenda === "Todos" || registro.tipoVenda === tipoVenda;

      const bateFormaPagamento =
        formaPagamento === "Todos" ||
        registro.formaPagamento === formaPagamento;

      const bateStatus =
        statusVenda === "Todos" || registro.status === statusVenda;

      const bateOperador =
        operador === "Todos" || registro.operador === operador;

      const texto = normalizeText(
        `${registro.dataHora} ${registro.operador} ${registro.tipoVenda} ${registro.status} ${registro.tipoDocumento} ${registro.consumidor} ${registro.senha} ${registro.formaPagamento} ${registro.valor}`
      );

      const bateBusca = !buscaNormalizada || texto.includes(buscaNormalizada);

      return (
        batePeriodo &&
        bateTipoDocumento &&
        bateTipoVenda &&
        bateFormaPagamento &&
        bateStatus &&
        bateOperador &&
        bateBusca
      );
    });
  }, [
    registros,
    periodo,
    caixaAtual,
    tipoDocumento,
    tipoVenda,
    formaPagamento,
    statusVenda,
    operador,
    busca,
  ]);

  const totalFiltrado = useMemo(() => {
    return registrosFiltrados.reduce((total, registro) => {
      return total + valorRegistroNoTotal(registro);
    }, 0);
  }, [registrosFiltrados]);

  function registrarEvento(evento: RegistroRaw) {
    const vendasAtuais = safeJsonArray<RegistroRaw>(
      localStorage.getItem(LS_VENDAS_DETALHADAS)
    );

    localStorage.setItem(
      LS_VENDAS_DETALHADAS,
      JSON.stringify([evento, ...vendasAtuais])
    );

    const historicoAtual = safeJsonArray<RegistroRaw>(
      localStorage.getItem(LS_CAIXAS_HISTORICO)
    );

    localStorage.setItem(
      LS_CAIXAS_HISTORICO,
      JSON.stringify([evento, ...historicoAtual])
    );

    carregarDados();
  }

  function criarEventoCaixa({
    status,
    consumidor,
    valor,
    observacao,
  }: {
    status: string;
    consumidor: string;
    valor: number;
    observacao: string;
  }) {
    const agora = new Date();

    const statusNormalizado = normalizeText(status);
    const valorAssinado =
      statusNormalizado.includes("sangria") ||
      statusNormalizado.includes("retirada")
        ? -Math.abs(valor)
        : Math.abs(valor);

    return {
      id: uid(),
      caixaId: caixaAtual?.id || "",
      data: todayInputDate(),
      dataHora: agora.toISOString(),
      operador: caixaAtual?.operador || "Adm",
      tipoVenda: "Caixa",
      status,
      tipoDocumento: "Evento de caixa",
      consumidor,
      formaPagamento: "Dinheiro",
      senha: "-",
      valorBruto: valorAssinado,
      valorLiquido: valorAssinado,
      valor: valorAssinado,
      observacao,
    };
  }

  function salvarReforco() {
    if (!caixaAberto) {
      alert("Abra o caixa antes de lançar reforço.");
      return;
    }

    const valor = asNumber(valorReforco);
    const motivo = motivoReforco.trim();

    if (valor <= 0) {
      alert("Informe um valor válido para o reforço.");
      return;
    }

    if (!motivo) {
      alert("Informe o motivo do reforço.");
      return;
    }

    const evento = criarEventoCaixa({
      status: "Reforço",
      consumidor: "Reforço de caixa",
      valor,
      observacao: motivo,
    });

    registrarEvento(evento);

    setValorReforco("");
    setMotivoReforco("");
    setMostrarReforco(false);

    alert("Reforço lançado com sucesso.");
  }

  function salvarSangria() {
    if (!caixaAberto) {
      alert("Abra o caixa antes de lançar sangria.");
      return;
    }

    const valor = asNumber(valorSangria);
    const motivo = motivoSangria.trim();

    if (valor <= 0) {
      alert("Informe um valor válido para a sangria.");
      return;
    }

    if (!motivo) {
      alert("Informe o motivo da sangria.");
      return;
    }

    const evento = criarEventoCaixa({
      status: "Sangria",
      consumidor: "Sangria / retirada do caixa",
      valor,
      observacao: motivo,
    });

    registrarEvento(evento);

    setValorSangria("");
    setMotivoSangria("");
    setMostrarSangria(false);

    alert("Sangria lançada com sucesso.");
  }

  function fecharCaixa() {
    if (!caixaAtual) {
      alert("Nenhum caixa aberto para fechar.");
      return;
    }

    const confirmar = confirm(
      `Deseja fechar o caixa agora?\n\nFalta/Sobra: ${money(
        diferencaFechamento
      )}`
    );

    if (!confirmar) return;

    const agora = new Date();

    const evento = {
      id: uid(),
      caixaId: caixaAtual.id,
      data: todayInputDate(),
      dataHora: agora.toISOString(),
      operador: caixaAtual.operador,
      tipoVenda: "Caixa",
      status: "Fechamento",
      tipoDocumento: "Evento de caixa",
      consumidor: "Fechamento de caixa",
      formaPagamento: "Conferência",
      senha: "-",
      valorBruto: valoresInformadosFechamento.total,
      valorLiquido: valoresInformadosFechamento.total,
      valor: valoresInformadosFechamento.total,
      automaticoDinheiro: automaticoFechamento.dinheiro,
      automaticoDebito: automaticoFechamento.debito,
      automaticoCredito: automaticoFechamento.credito,
      automaticoPix: automaticoFechamento.pix,
      automaticoTotal: automaticoFechamento.total,
      informadoDinheiro: valoresInformadosFechamento.dinheiro,
      informadoDebito: valoresInformadosFechamento.debito,
      informadoCredito: valoresInformadosFechamento.credito,
      informadoPix: valoresInformadosFechamento.pix,
      informadoTotal: valoresInformadosFechamento.total,
      diferenca: diferencaFechamento,
      observacao: `Fechamento do caixa. Diferença: ${money(
        diferencaFechamento
      )}`,
    };

    registrarEvento(evento);

    const caixaFechado: CaixaAtual = {
      ...caixaAtual,
      status: "Fechado",
      fechadoEm: agora.toISOString(),
    };

    const caixasAtuais = safeJsonArray<CaixaAtual>(
      localStorage.getItem(LS_CAIXAS)
    );

    const caixasAtualizados = caixasAtuais.map((caixa) => {
      if (caixa.id !== caixaAtual.id) return caixa;
      return caixaFechado;
    });

    localStorage.setItem(LS_CAIXAS, JSON.stringify(caixasAtualizados));
    localStorage.removeItem(LS_CAIXA_ATUAL);

    setCaixaAtual(null);
    setMostrarFechamento(false);
    setFechamentoDinheiro("");
    setFechamentoDebito("");
    setFechamentoCredito("");
    setFechamentoPix("");

    carregarDados();

    alert("Caixa fechado com sucesso.");
  }

  function exportarExcel() {
    const linhas = [
      [
        "Data/Hora",
        "Operador",
        "Tipo venda",
        "Status",
        "Tipo documento",
        "Consumidor",
        "Forma pagamento",
        "Senha/Número",
        "Valor",
        "Observação",
      ],
      ...registrosFiltrados.map((registro) => [
        formatDateTime(registro.dataHora),
        registro.operador,
        registro.tipoVenda,
        registro.status,
        registro.tipoDocumento,
        registro.consumidor,
        registro.formaPagamento,
        registro.senha,
        money(registro.valorBruto || registro.valor),
        registro.observacao,
      ]),
      ["", "", "", "", "", "", "", "TOTAL", money(totalFiltrado), ""],
    ];

    baixarCsv(`operacoes-caixa-${todayInputDate()}.csv`, linhas);
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
              <p className="text-base font-bold text-white">
                {caixaAtual?.operador || "Adm"}
              </p>
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

            <button className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]">
              <span className="text-lg">💳</span>
              Comanda
            </button>

            <button className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]">
              <span className="text-lg">🍽️</span>
              Mesa
            </button>

            <button className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm text-white/40">
              <span className="text-lg">🛵</span>
              Delivery
            </button>

            <button
              onClick={() => setMostrarFechamento(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-sm hover:bg-[#232323]"
            >
              <span className="text-lg">🏦</span>
              Caixa
            </button>

            <a
              href="/pdv/operacoes-caixa"
              className="flex w-full items-center gap-2 rounded-md bg-[#f97316] px-3 py-3 text-left text-sm font-bold text-white"
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
                Operações de caixa
              </h1>
            </div>

            <div
              className={`rounded-xl px-4 py-3 text-sm font-black ${
                caixaAberto
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {caixaAberto
                ? `Caixa aberto • ${caixaAtual?.operador}`
                : "Caixa fechado"}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#f1d2ba] bg-white p-5">
            <p className="text-sm font-bold lowercase text-slate-600">
              filtros da pesquisa
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
              <select
                value={tipoDocumento}
                onChange={(event) => setTipoDocumento(event.target.value)}
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                <option>Todos</option>
                <option>Gerencial</option>
                <option>Evento de caixa</option>
              </select>

              <select
                value={tipoVenda}
                onChange={(event) => setTipoVenda(event.target.value)}
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                <option>Todos</option>
                <option>Balcão</option>
                <option>Comanda</option>
                <option>Mesa</option>
                <option>Caixa</option>
              </select>

              <select
                value={formaPagamento}
                onChange={(event) => setFormaPagamento(event.target.value)}
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                <option>Todos</option>
                <option>Dinheiro</option>
                <option>PIX</option>
                <option>Débito</option>
                <option>Crédito</option>
                <option>Conferência</option>
              </select>

              <select
                value={statusVenda}
                onChange={(event) => setStatusVenda(event.target.value)}
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                <option>Todos</option>
                <option>Abertura</option>
                <option>Finalizado</option>
                <option>Cancelado</option>
                <option>Reforço</option>
                <option>Sangria</option>
                <option>Fechamento</option>
              </select>

              <select
                value={operador}
                onChange={(event) => setOperador(event.target.value)}
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                {operadores.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <select
                value={periodo}
                onChange={(event) => setPeriodo(event.target.value)}
                className="h-11 rounded-lg border border-[#e8d2c0] bg-[#fffaf6] px-3 text-sm outline-none"
              >
                <option value="hoje">hoje</option>
                <option value="caixa-atual">caixa atual</option>
                <option value="todos">todos</option>
              </select>

              <button className="h-11 rounded-lg bg-[#f97316] text-sm font-black uppercase text-white hover:bg-[#ea580c]">
                filtrar
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#f1d2ba] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportarExcel}
                  className="rounded-lg bg-[#111111] px-4 py-3 text-sm font-black uppercase text-white hover:bg-[#232323]"
                >
                  exportar excel
                </button>

                <button
                  onClick={() => setMostrarReforco(true)}
                  className="rounded-lg bg-green-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-green-700"
                >
                  reforço
                </button>

                <button
                  onClick={() => setMostrarSangria(true)}
                  className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-red-700"
                >
                  sangria
                </button>

                <button
                  onClick={() => setMostrarFechamento(true)}
                  className="rounded-lg bg-[#f97316] px-4 py-3 text-sm font-black uppercase text-white hover:bg-[#ea580c]"
                >
                  fechar caixa
                </button>
              </div>

              <div className="flex h-11 min-w-[280px] overflow-hidden rounded-lg border border-[#e8d2c0] bg-[#fffaf6]">
                <div className="flex w-11 items-center justify-center">🔎</div>
                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="procurar"
                  className="flex-1 bg-transparent px-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left">
                    <th className="px-2 py-3">ações</th>
                    <th className="px-2 py-3">data</th>
                    <th className="px-2 py-3">operador</th>
                    <th className="px-2 py-3">tipo venda</th>
                    <th className="px-2 py-3">status venda</th>
                    <th className="px-2 py-3">tipo documento</th>
                    <th className="px-2 py-3">consumidor</th>
                    <th className="px-2 py-3">senha</th>
                    <th className="px-2 py-3 text-right">valor</th>
                  </tr>
                </thead>

                <tbody>
                  {registrosFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-2 py-8 text-center text-slate-500"
                      >
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  ) : (
                    registrosFiltrados.map((registro, index) => (
                      <tr
                        key={registro.id}
                        className={`border-b border-slate-200 ${
                          index % 2 === 0 ? "bg-[#fffaf6]" : "bg-white"
                        }`}
                      >
                        <td className="px-2 py-3 font-black">⋮</td>
                        <td className="px-2 py-3">
                          {formatDateTime(registro.dataHora)}
                        </td>
                        <td className="px-2 py-3">{registro.operador}</td>
                        <td className="px-2 py-3">{registro.tipoVenda}</td>
                        <td
                          className={`px-2 py-3 font-bold ${getStatusClass(
                            registro.status
                          )}`}
                        >
                          {registro.status}
                        </td>
                        <td className="px-2 py-3">{registro.tipoDocumento}</td>
                        <td className="px-2 py-3">{registro.consumidor}</td>
                        <td className="px-2 py-3">{registro.senha}</td>
                        <td className="px-2 py-3 text-right font-bold">
                          {money(valorExibicaoRegistro(registro))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Mostrando {registrosFiltrados.length} registro(s)
              </p>

              <div className="rounded-xl bg-[#111111] px-5 py-3 text-white">
                <span className="mr-3 text-sm font-bold text-white/70">
                  Total sem fechamento:
                </span>
                <strong className="text-xl font-black text-[#f97316]">
                  {money(totalFiltrado)}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      {mostrarReforco && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20">
          <div className="w-[420px] rounded-2xl border-2 border-[#f97316] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase">Reforço de caixa</h2>
              <button
                onClick={() => setMostrarReforco(false)}
                className="text-2xl font-black"
              >
                ✕
              </button>
            </div>

            <label className="mt-5 block text-sm font-black uppercase">
              Valor
            </label>
            <input
              value={valorReforco}
              onChange={(event) => setValorReforco(event.target.value)}
              placeholder="R$0,00"
              className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
            />

            <label className="mt-4 block text-sm font-black uppercase">
              Motivo da adição
            </label>
            <input
              value={motivoReforco}
              onChange={(event) => setMotivoReforco(event.target.value)}
              placeholder="Campo obrigatório"
              className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
            />

            <button
              onClick={salvarReforco}
              className="mt-5 w-full rounded-xl bg-green-600 py-4 text-lg font-black uppercase text-white"
            >
              Reforçar o caixa
            </button>
          </div>
        </div>
      )}

      {mostrarSangria && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20">
          <div className="w-[420px] rounded-2xl border-2 border-[#f97316] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase">Sangria / retirada</h2>
              <button
                onClick={() => setMostrarSangria(false)}
                className="text-2xl font-black"
              >
                ✕
              </button>
            </div>

            <label className="mt-5 block text-sm font-black uppercase">
              Valor
            </label>
            <input
              value={valorSangria}
              onChange={(event) => setValorSangria(event.target.value)}
              placeholder="R$0,00"
              className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
            />

            <label className="mt-4 block text-sm font-black uppercase">
              Motivo da retirada
            </label>
            <input
              value={motivoSangria}
              onChange={(event) => setMotivoSangria(event.target.value)}
              placeholder="Campo obrigatório"
              className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
            />

            <button
              onClick={salvarSangria}
              className="mt-5 w-full rounded-xl bg-red-600 py-4 text-lg font-black uppercase text-white"
            >
              Retirar do caixa
            </button>
          </div>
        </div>
      )}

      {mostrarFechamento && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10">
          <div className="w-full max-w-[720px] rounded-2xl border-2 border-[#f97316] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase">
                Fechamento do caixa
              </h2>
              <button
                onClick={() => setMostrarFechamento(false)}
                className="text-2xl font-black"
              >
                ✕
              </button>
            </div>

            {!caixaAberto ? (
              <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
                <p className="font-black">Nenhum caixa aberto.</p>
                <p className="mt-1 text-sm">
                  Abra um caixa no PDV para poder fazer fechamento.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm font-bold text-green-700">
                  Insira os valores recebidos para o fechamento:
                </p>

                <label className="mt-4 flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={considerarAbertura}
                    onChange={(event) =>
                      setConsiderarAbertura(event.target.checked)
                    }
                  />
                  considerar abertura?
                </label>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-black uppercase">
                      Dinheiro + troco inicial
                    </label>
                    <input
                      value={fechamentoDinheiro}
                      onChange={(event) =>
                        setFechamentoDinheiro(event.target.value)
                      }
                      placeholder={money(automaticoFechamento.dinheiro)}
                      className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Automático: {money(automaticoFechamento.dinheiro)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-black uppercase">
                      Débito
                    </label>
                    <input
                      value={fechamentoDebito}
                      onChange={(event) =>
                        setFechamentoDebito(event.target.value)
                      }
                      placeholder={money(automaticoFechamento.debito)}
                      className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Automático: {money(automaticoFechamento.debito)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-black uppercase">
                      Crédito
                    </label>
                    <input
                      value={fechamentoCredito}
                      onChange={(event) =>
                        setFechamentoCredito(event.target.value)
                      }
                      placeholder={money(automaticoFechamento.credito)}
                      className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Automático: {money(automaticoFechamento.credito)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-black uppercase">PIX</label>
                    <input
                      value={fechamentoPix}
                      onChange={(event) =>
                        setFechamentoPix(event.target.value)
                      }
                      placeholder={money(automaticoFechamento.pix)}
                      className="mt-2 h-12 w-full rounded-xl border-2 border-[#f1d2ba] px-3 text-base font-bold outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Automático: {money(automaticoFechamento.pix)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-[#111111] p-4 text-white">
                  <div className="flex justify-between">
                    <span className="font-bold text-white/70">
                      Total automático
                    </span>
                    <strong className="text-xl text-white">
                      {money(automaticoFechamento.total)}
                    </strong>
                  </div>

                  <div className="mt-2 flex justify-between">
                    <span className="font-bold text-white/70">
                      Total informado
                    </span>
                    <strong className="text-xl text-white">
                      {money(valoresInformadosFechamento.total)}
                    </strong>
                  </div>

                  <div className="mt-4 rounded-xl bg-[#f97316] px-4 py-3 text-center text-[#111111]">
                    <p className="text-sm font-black uppercase">Falta/Sobra</p>
                    <p className="text-4xl font-black">
                      {money(diferencaFechamento)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={fecharCaixa}
                  className="mt-5 w-full rounded-xl bg-[#f97316] py-4 text-lg font-black uppercase text-white"
                >
                  Fechar o caixa
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}