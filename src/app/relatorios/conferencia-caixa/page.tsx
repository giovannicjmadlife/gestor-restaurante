"use client";

import React, { useEffect, useMemo, useState } from "react";

type RegistroBruto = Record<string, unknown>;

type EventoCaixa = {
  id: string;
  caixaId: string;
  dataISO: string;
  dataTexto: string;
  horaTexto: string;
  operador: string;
  evento: string;
  modulo: string;
  identificacao: string;
  formaPagamento: string;
  valor: number;
  observacao: string;
  bruto: RegistroBruto;
};

type CaixaNormalizado = {
  id: string;
  operador: string;
  status: string;
  dataAberturaISO: string;
  dataAberturaTexto: string;
  horaAberturaTexto: string;
  dataFechamentoTexto: string;
  horaFechamentoTexto: string;
  valorAbertura: number;
  valorInformadoFechamento: number;
  observacao: string;
  bruto: RegistroBruto;
};

type ResumoCaixa = {
  caixa: CaixaNormalizado;
  eventos: EventoCaixa[];
  vendas: EventoCaixa[];
  reforcos: EventoCaixa[];
  sangrias: EventoCaixa[];
  aberturas: EventoCaixa[];
  fechamentos: EventoCaixa[];
  totalVendas: number;
  totalReforcos: number;
  totalSangrias: number;
  totalAbertura: number;
  totalDinheiro: number;
  totalPix: number;
  totalCredito: number;
  totalDebito: number;
  totalCorrentista: number;
  totalOutros: number;
  calculado: number;
  informado: number;
  diferenca: number;
};

type ConferenciaSalva = {
  id: string;
  caixaId: string;
  dataHora: string;
  operador: string;
  dinheiroInformado: number;
  pixInformado: number;
  debitoInformado: number;
  creditoInformado: number;
  correntistaInformado: number;
  outrosInformado: number;
  totalInformado: number;
  totalCalculado: number;
  diferenca: number;
  observacao: string;
};

const STORAGE_CAIXAS = "gestor-restaurante-caixas";
const STORAGE_CAIXA_ATUAL = "gestor-restaurante-caixa-atual";
const STORAGE_CAIXAS_HISTORICO = "gestor-restaurante-caixas-historico";
const STORAGE_CONFERENCIAS = "gestor-restaurante-caixas-conferencias";

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

function lerObjetoLocalStorage(chave: string): RegistroBruto | null {
  if (typeof window === "undefined") return null;

  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;

    const convertido = JSON.parse(bruto);
    return convertido && typeof convertido === "object" && !Array.isArray(convertido) ? convertido : null;
  } catch {
    return null;
  }
}

function salvarListaLocalStorage(chave: string, lista: unknown[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chave, JSON.stringify(lista));
}

function extrairData(obj: RegistroBruto, chavesExtras: string[] = []): Date {
  const chaves = [
    ...chavesExtras,
    "dataHora",
    "dataHoraEvento",
    "dataHoraVenda",
    "dataAbertura",
    "abertoEm",
    "dataFechamento",
    "fechadoEm",
    "finalizadoEm",
    "criadoEm",
    "createdAt",
    "dataCriacao",
    "data",
    "date",
  ];

  for (const chave of chaves) {
    const valor = obj[chave];

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

function normalizarTextoComparacao(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function textoDoRegistro(registro: RegistroBruto): string {
  return [
    registro.evento,
    registro.tipoEvento,
    registro.acao,
    registro["ação"],
    registro.tipo,
    registro.tipoVenda,
    registro.tipoAtendimento,
    registro.tipoDocumento,
    registro.documento,
    registro.modulo,
    registro["módulo"],
    registro.identificacao,
    registro["identificação"],
    registro.descricao,
    registro["descrição"],
    registro.forma,
    registro.formaPagamento,
    registro.formaRecebimento,
    registro.pagamento,
    registro.meioPagamento,
    registro.origem,
    registro.observacao,
    registro["observação"],
    registro.obs,
  ]
    .map((valor) => texto(valor).toLowerCase())
    .join(" ");
}

function normalizarFormaPagamento(forma: string): string {
  const f = normalizarTextoComparacao(forma);

  if (f.includes("pix")) return "PIX";
  if (f.includes("dinheiro")) return "Dinheiro";
  if (f.includes("debito")) return "Débito";
  if (f.includes("credito")) return "Crédito";
  if (f.includes("correntista") || f.includes("fiado") || f.includes("conta")) return "Correntista";
  if (f.includes("conferencia")) return "Conferência";

  return forma || "Outros";
}

function normalizarEventoNome(registro: RegistroBruto): string {
  const bruto = valorTexto(
    registro,
    ["evento", "tipoEvento", "acao", "ação", "tipo", "descricao", "descrição"],
    ""
  );

  const textoCompleto = [
    bruto,
    registro.formaPagamento,
    registro.formaRecebimento,
    registro.forma,
    registro.pagamento,
    registro.meioPagamento,
    registro.modulo,
    registro.módulo,
    registro.tipoVenda,
    registro.tipoAtendimento,
    registro.origem,
    registro.identificacao,
    registro.identificação,
    registro.observacao,
    registro.observação,
    registro.obs,
  ]
    .map((valor) => texto(valor))
    .join(" ");

  const t = normalizarTextoComparacao(textoCompleto);

  if (t.includes("abertura") || t.includes("abrir caixa")) return "Abertura";
  if (t.includes("fechamento") || t.includes("fechar caixa")) return "Fechamento";
  if (t.includes("reforco") || t.includes("suprimento")) return "Reforço";
  if (t.includes("sangria") || t.includes("retirada")) return "Sangria";
  if (t.includes("saida") || t.includes("despesa")) return "Saída";
  if (t.includes("conferencia")) return "Conferência";
  if (t.includes("cancelamento")) return "Cancelamento";
  if (t.includes("venda") || t.includes("pagamento")) return "Venda";

  const modulo = normalizarTextoComparacao(valorTexto(registro, ["modulo", "módulo", "tipoVenda"], ""));
  const temItens = Array.isArray(registro.itens) || Array.isArray(registro.produtos) || Array.isArray(registro.carrinho);

  if (temItens || modulo.includes("balcao") || modulo.includes("mesa") || modulo.includes("comanda")) return "Venda";

  return bruto || "Evento";
}

function normalizarModulo(registro: RegistroBruto): string {
  const bruto = valorTexto(registro, ["modulo", "módulo", "tipoVenda", "tipoAtendimento", "origem"], "");
  const t = normalizarTextoComparacao(bruto);

  if (t.includes("mesa")) return "Mesa";
  if (t.includes("comanda")) return "Comanda";
  if (t.includes("delivery") || t.includes("entrega")) return "Delivery";
  if (t.includes("balcao")) return "Balcão";
  if (t.includes("caixa")) return "Caixa";

  return bruto || "Caixa";
}

function ehEventoVenda(evento: EventoCaixa): boolean {
  const eventoNormalizado = normalizarTextoComparacao(evento.evento);
  const moduloNormalizado = normalizarTextoComparacao(evento.modulo);
  const identificacaoNormalizada = normalizarTextoComparacao(evento.identificacao);

  if (ehEventoSaida(evento)) return false;
  if (eventoNormalizado.includes("cancelamento")) return false;
  if (eventoNormalizado.includes("abertura")) return false;
  if (eventoNormalizado.includes("fechamento")) return false;
  if (eventoNormalizado.includes("reforco")) return false;
  if (eventoNormalizado.includes("sangria")) return false;
  if (eventoNormalizado.includes("retirada")) return false;
  if (eventoNormalizado.includes("conferencia")) return false;
  if (identificacaoNormalizada === "caixa") return false;

  return (
    eventoNormalizado.includes("venda") ||
    eventoNormalizado.includes("pagamento") ||
    moduloNormalizado.includes("balcao") ||
    moduloNormalizado.includes("mesa") ||
    moduloNormalizado.includes("comanda") ||
    moduloNormalizado.includes("delivery")
  );
}

function ehEventoSaida(evento: EventoCaixa): boolean {
  const textoCompleto = normalizarTextoComparacao(
    [
      evento.evento,
      evento.formaPagamento,
      evento.modulo,
      evento.identificacao,
      evento.observacao,
      textoDoRegistro(evento.bruto),
    ].join(" ")
  );

  return (
    evento.valor < 0 ||
    textoCompleto.includes("sangria") ||
    textoCompleto.includes("retirada") ||
    textoCompleto.includes("saida") ||
    textoCompleto.includes("despesa")
  );
}

function ehEventoEntrada(evento: EventoCaixa): boolean {
  const textoCompleto = normalizarTextoComparacao(
    [
      evento.evento,
      evento.formaPagamento,
      evento.modulo,
      evento.identificacao,
      evento.observacao,
      textoDoRegistro(evento.bruto),
    ].join(" ")
  );

  return (
    textoCompleto.includes("abertura") ||
    textoCompleto.includes("reforco") ||
    textoCompleto.includes("suprimento") ||
    textoCompleto.includes("venda") ||
    textoCompleto.includes("pagamento")
  );
}

function textoMovimentoEvento(evento: EventoCaixa): string {
  if (ehEventoSaida(evento)) return "Saída";
  if (ehEventoEntrada(evento)) return "Entrada";
  return "Neutro";
}

function classeMovimentoEvento(evento: EventoCaixa): string {
  if (ehEventoSaida(evento)) {
    return "rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700";
  }

  if (ehEventoEntrada(evento)) {
    return "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700";
  }

  return "rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-700";
}

function classeValorEvento(evento: EventoCaixa): string {
  if (ehEventoSaida(evento)) return "px-3 py-3 text-right font-black text-red-600";
  if (ehEventoEntrada(evento)) return "px-3 py-3 text-right font-black text-emerald-700";
  return "px-3 py-3 text-right font-black text-zinc-950";
}

function moedaEventoComSinal(evento: EventoCaixa): string {
  const valorAbs = Math.abs(evento.valor);

  if (ehEventoSaida(evento)) return `- ${moeda(valorAbs)}`;
  if (ehEventoEntrada(evento)) return `+ ${moeda(valorAbs)}`;

  return moeda(evento.valor);
}

function moedaSaida(valor: number): string {
  if (valor === 0) return moeda(0);
  return `- ${moeda(Math.abs(valor))}`;
}

function normalizarCaixa(registro: RegistroBruto, indice: number): CaixaNormalizado {
  const dataAbertura = extrairData(registro, ["dataAbertura", "abertoEm", "inicio", "createdAt"]);
  const dataFechamentoBruta =
    registro.dataFechamento || registro.fechadoEm || registro.encerradoEm || registro.finalizadoEm || null;

  const dataFechamento =
    typeof dataFechamentoBruta === "string" || typeof dataFechamentoBruta === "number"
      ? new Date(dataFechamentoBruta)
      : null;

  const dataFechamentoValida = dataFechamento && !Number.isNaN(dataFechamento.getTime()) ? dataFechamento : null;

  const statusBruto = valorTexto(registro, ["status", "situacao", "situação"], "");
  const status =
    statusBruto ||
    (dataFechamentoValida ? "Fechado" : "Aberto");

  return {
    id: valorTexto(registro, ["id", "caixaId", "codigo", "código"], `caixa-${indice + 1}`),
    operador: valorTexto(registro, ["operador", "usuario", "usuário", "responsavel", "caixaOperador"], "Adm"),
    status,
    dataAberturaISO: formatarDataISO(dataAbertura),
    dataAberturaTexto: formatarDataBR(dataAbertura),
    horaAberturaTexto: formatarHoraBR(dataAbertura),
    dataFechamentoTexto: dataFechamentoValida ? formatarDataBR(dataFechamentoValida) : "-",
    horaFechamentoTexto: dataFechamentoValida ? formatarHoraBR(dataFechamentoValida) : "-",
    valorAbertura: valorNumero(registro, ["valorAbertura", "abertura", "valorInicial", "trocoInicial", "valor"], 0),
    valorInformadoFechamento: valorNumero(
      registro,
      ["valorInformadoFechamento", "valorInformado", "informado", "valorConferido", "totalInformado"],
      0
    ),
    observacao: valorTexto(registro, ["observacao", "observação", "obs"], ""),
    bruto: registro,
  };
}

function normalizarEvento(registro: RegistroBruto, indice: number): EventoCaixa {
  const data = extrairData(registro);
  const evento = normalizarEventoNome(registro);
  const modulo = normalizarModulo(registro);
  const formaPagamento = normalizarFormaPagamento(
    valorTexto(registro, ["formaPagamento", "formaRecebimento", "forma", "pagamento", "meioPagamento"], "")
  );

  const valor = valorNumero(
    registro,
    [
      "valor",
      "valorBruto",
      "totalBruto",
      "totalCobrar",
      "totalACobrar",
      "valorTotal",
      "total",
      "valorVenda",
      "subtotal",
      "valorAbertura",
      "valorReforco",
      "valorReforço",
      "valorSangria",
      "valorRetirada",
      "valorInformado",
    ],
    0
  );

  return {
    id: valorTexto(registro, ["id", "eventoId", "codigo", "código"], `evento-${indice + 1}`),
    caixaId: valorTexto(registro, ["caixaId", "idCaixa"], ""),
    dataISO: formatarDataISO(data),
    dataTexto: formatarDataBR(data),
    horaTexto: formatarHoraBR(data),
    operador: valorTexto(registro, ["operador", "usuario", "usuário", "responsavel", "caixaOperador"], "Adm"),
    evento,
    modulo,
    identificacao: valorTexto(registro, ["identificacao", "identificação", "mesa", "numeroMesa", "numeroComanda", "comanda"], modulo),
    formaPagamento: formaPagamento || "Outros",
    valor,
    observacao: valorTexto(registro, ["observacao", "observação", "obs", "descricao", "descrição"], ""),
    bruto: registro,
  };
}

function caixaPertenceAoEvento(caixa: CaixaNormalizado, evento: EventoCaixa): boolean {
  if (evento.caixaId && evento.caixaId === caixa.id) return true;

  const mesmaData = evento.dataISO === caixa.dataAberturaISO;
  const mesmoOperador = evento.operador === caixa.operador || !evento.operador || !caixa.operador;

  return mesmaData && mesmoOperador;
}

function montarResumoCaixa(caixa: CaixaNormalizado, eventosTodos: EventoCaixa[]): ResumoCaixa {
  const eventos = eventosTodos
    .filter((evento) => caixaPertenceAoEvento(caixa, evento))
    .sort((a, b) => `${b.dataISO} ${b.horaTexto}`.localeCompare(`${a.dataISO} ${a.horaTexto}`));

  const vendas = eventos.filter(ehEventoVenda);
  const reforcos = eventos.filter((evento) => normalizarTextoComparacao(evento.evento).includes("reforco"));
  const sangrias = eventos.filter((evento) => ehEventoSaida(evento));
  const aberturas = eventos.filter((evento) => normalizarTextoComparacao(evento.evento).includes("abertura"));
  const fechamentos = eventos.filter((evento) => normalizarTextoComparacao(evento.evento).includes("fechamento"));

  const totalVendas = vendas.reduce((soma, evento) => soma + evento.valor, 0);
  const totalReforcos = reforcos.reduce((soma, evento) => soma + Math.abs(evento.valor), 0);
  const totalSangrias = sangrias.reduce((soma, evento) => soma + Math.abs(evento.valor), 0);
  const totalAberturaEventos = aberturas.reduce((soma, evento) => soma + Math.abs(evento.valor), 0);
  const totalAbertura = caixa.valorAbertura || totalAberturaEventos;

  const vendasPorForma = (forma: string) =>
    vendas
      .filter((evento) => evento.formaPagamento === forma)
      .reduce((soma, evento) => soma + evento.valor, 0);

  const totalDinheiroVendas = vendasPorForma("Dinheiro");
  const totalPix = vendasPorForma("PIX");
  const totalCredito = vendasPorForma("Crédito");
  const totalDebito = vendasPorForma("Débito");
  const totalCorrentista = vendasPorForma("Correntista");
  const totalOutros = vendas
    .filter(
      (evento) =>
        !["Dinheiro", "PIX", "Crédito", "Débito", "Correntista"].includes(evento.formaPagamento)
    )
    .reduce((soma, evento) => soma + evento.valor, 0);

  const totalDinheiro = totalAbertura + totalDinheiroVendas + totalReforcos - totalSangrias;
  const calculado = totalDinheiro + totalPix + totalCredito + totalDebito + totalCorrentista + totalOutros;
  const informado = caixa.valorInformadoFechamento;
  const diferenca = informado > 0 ? informado - calculado : 0;

  return {
    caixa,
    eventos,
    vendas,
    reforcos,
    sangrias,
    aberturas,
    fechamentos,
    totalVendas,
    totalReforcos,
    totalSangrias,
    totalAbertura,
    totalDinheiro,
    totalPix,
    totalCredito,
    totalDebito,
    totalCorrentista,
    totalOutros,
    calculado,
    informado,
    diferenca,
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

export default function ConferenciaCaixaPage() {
  const [caixas, setCaixas] = useState<CaixaNormalizado[]>([]);
  const [eventos, setEventos] = useState<EventoCaixa[]>([]);
  const [conferencias, setConferencias] = useState<ConferenciaSalva[]>([]);
  const [busca, setBusca] = useState("");
  const [dataInicial, setDataInicial] = useState(primeiroDiaMesISO());
  const [dataFinal, setDataFinal] = useState(hojeISO());
  const [operador, setOperador] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [resumoSelecionado, setResumoSelecionado] = useState<ResumoCaixa | null>(null);
  const [historicoSelecionado, setHistoricoSelecionado] = useState<ResumoCaixa | null>(null);
  const [dinheiroInformado, setDinheiroInformado] = useState("");
  const [pixInformado, setPixInformado] = useState("");
  const [debitoInformado, setDebitoInformado] = useState("");
  const [creditoInformado, setCreditoInformado] = useState("");
  const [correntistaInformado, setCorrentistaInformado] = useState("");
  const [outrosInformado, setOutrosInformado] = useState("");
  const [observacaoConferencia, setObservacaoConferencia] = useState("");

  function carregarDados() {
    const listaCaixas = lerListaLocalStorage(STORAGE_CAIXAS).map(normalizarCaixa);
    const caixaAtual = lerObjetoLocalStorage(STORAGE_CAIXA_ATUAL);
    const caixaAtualNormalizado = caixaAtual ? normalizarCaixa(caixaAtual, listaCaixas.length) : null;

    const caixasComAtual = [...listaCaixas];

    if (caixaAtualNormalizado && !caixasComAtual.some((caixa) => caixa.id === caixaAtualNormalizado.id)) {
      caixasComAtual.unshift(caixaAtualNormalizado);
    }

    const listaEventos = lerListaLocalStorage(STORAGE_CAIXAS_HISTORICO).map(normalizarEvento);
    const listaConferencias = lerListaLocalStorage(STORAGE_CONFERENCIAS).map((item, indice) => ({
      id: valorTexto(item, ["id"], `conferencia-${indice + 1}`),
      caixaId: valorTexto(item, ["caixaId"], ""),
      dataHora: valorTexto(item, ["dataHora"], ""),
      operador: valorTexto(item, ["operador"], "Adm"),
      dinheiroInformado: valorNumero(item, ["dinheiroInformado"], 0),
      pixInformado: valorNumero(item, ["pixInformado"], 0),
      debitoInformado: valorNumero(item, ["debitoInformado"], 0),
      creditoInformado: valorNumero(item, ["creditoInformado"], 0),
      correntistaInformado: valorNumero(item, ["correntistaInformado"], 0),
      outrosInformado: valorNumero(item, ["outrosInformado"], 0),
      totalInformado: valorNumero(item, ["totalInformado"], 0),
      totalCalculado: valorNumero(item, ["totalCalculado"], 0),
      diferenca: valorNumero(item, ["diferenca"], 0),
      observacao: valorTexto(item, ["observacao"], ""),
    }));

    setCaixas(caixasComAtual);
    setEventos(listaEventos);
    setConferencias(listaConferencias);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const resumos = useMemo(() => {
    return caixas.map((caixa) => montarResumoCaixa(caixa, eventos));
  }, [caixas, eventos]);

  const operadoresDisponiveis = useMemo(() => {
    const lista = Array.from(new Set(caixas.map((caixa) => caixa.operador).filter(Boolean)));
    return ["Todos", ...lista.sort()];
  }, [caixas]);

  const resumosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return resumos.filter((resumo) => {
      const caixa = resumo.caixa;

      const dentroDataInicial = !dataInicial || caixa.dataAberturaISO >= dataInicial;
      const dentroDataFinal = !dataFinal || caixa.dataAberturaISO <= dataFinal;
      const bateOperador = operador === "Todos" || caixa.operador === operador;
      const bateStatus = status === "Todos" || normalizarTextoComparacao(caixa.status) === normalizarTextoComparacao(status);

      const textoBusca = [
        caixa.id,
        caixa.operador,
        caixa.status,
        caixa.dataAberturaTexto,
        caixa.horaAberturaTexto,
        caixa.dataFechamentoTexto,
        caixa.horaFechamentoTexto,
        caixa.observacao,
      ]
        .join(" ")
        .toLowerCase();

      const bateBusca = !termo || textoBusca.includes(termo);

      return dentroDataInicial && dentroDataFinal && bateOperador && bateStatus && bateBusca;
    });
  }, [resumos, busca, dataInicial, dataFinal, operador, status]);

  const totalizadores = useMemo(() => {
    const caixasQuantidade = resumosFiltrados.length;
    const vendas = resumosFiltrados.reduce((soma, resumo) => soma + resumo.totalVendas, 0);
    const reforcos = resumosFiltrados.reduce((soma, resumo) => soma + resumo.totalReforcos, 0);
    const sangrias = resumosFiltrados.reduce((soma, resumo) => soma + resumo.totalSangrias, 0);
    const calculado = resumosFiltrados.reduce((soma, resumo) => soma + resumo.calculado, 0);
    const informado = resumosFiltrados.reduce((soma, resumo) => soma + resumo.informado, 0);
    const diferenca = informado > 0 ? informado - calculado : 0;

    return {
      caixasQuantidade,
      vendas,
      reforcos,
      sangrias,
      calculado,
      informado,
      diferenca,
    };
  }, [resumosFiltrados]);

  function abrirConferencia(resumo: ResumoCaixa) {
    setResumoSelecionado(resumo);
    setDinheiroInformado(resumo.totalDinheiro ? String(resumo.totalDinheiro.toFixed(2)).replace(".", ",") : "");
    setPixInformado(resumo.totalPix ? String(resumo.totalPix.toFixed(2)).replace(".", ",") : "");
    setDebitoInformado(resumo.totalDebito ? String(resumo.totalDebito.toFixed(2)).replace(".", ",") : "");
    setCreditoInformado(resumo.totalCredito ? String(resumo.totalCredito.toFixed(2)).replace(".", ",") : "");
    setCorrentistaInformado(resumo.totalCorrentista ? String(resumo.totalCorrentista.toFixed(2)).replace(".", ",") : "");
    setOutrosInformado(resumo.totalOutros ? String(resumo.totalOutros.toFixed(2)).replace(".", ",") : "");
    setObservacaoConferencia("");
  }

  function fecharConferencia() {
    setResumoSelecionado(null);
    setDinheiroInformado("");
    setPixInformado("");
    setDebitoInformado("");
    setCreditoInformado("");
    setCorrentistaInformado("");
    setOutrosInformado("");
    setObservacaoConferencia("");
  }

  const valoresConferencia = useMemo(() => {
    const dinheiro = numero(dinheiroInformado);
    const pix = numero(pixInformado);
    const debito = numero(debitoInformado);
    const credito = numero(creditoInformado);
    const correntista = numero(correntistaInformado);
    const outros = numero(outrosInformado);
    const totalInformado = dinheiro + pix + debito + credito + correntista + outros;
    const totalCalculado = resumoSelecionado?.calculado || 0;
    const diferenca = totalInformado - totalCalculado;

    return {
      dinheiro,
      pix,
      debito,
      credito,
      correntista,
      outros,
      totalInformado,
      totalCalculado,
      diferenca,
    };
  }, [
    dinheiroInformado,
    pixInformado,
    debitoInformado,
    creditoInformado,
    correntistaInformado,
    outrosInformado,
    resumoSelecionado,
  ]);

  function salvarConferencia() {
    if (!resumoSelecionado) return;

    const novaConferencia: ConferenciaSalva = {
      id: `conferencia-${Date.now()}`,
      caixaId: resumoSelecionado.caixa.id,
      dataHora: new Date().toISOString(),
      operador: resumoSelecionado.caixa.operador,
      dinheiroInformado: valoresConferencia.dinheiro,
      pixInformado: valoresConferencia.pix,
      debitoInformado: valoresConferencia.debito,
      creditoInformado: valoresConferencia.credito,
      correntistaInformado: valoresConferencia.correntista,
      outrosInformado: valoresConferencia.outros,
      totalInformado: valoresConferencia.totalInformado,
      totalCalculado: valoresConferencia.totalCalculado,
      diferenca: valoresConferencia.diferenca,
      observacao: observacaoConferencia,
    };

    const listaAtualizada = [novaConferencia, ...conferencias];
    salvarListaLocalStorage(STORAGE_CONFERENCIAS, listaAtualizada);
    setConferencias(listaAtualizada);
    fecharConferencia();
    alert("Conferência salva com sucesso.");
  }

  function limparFiltros() {
    setBusca("");
    setDataInicial(primeiroDiaMesISO());
    setDataFinal(hojeISO());
    setOperador("Todos");
    setStatus("Todos");
  }

  function exportarCSV() {
    const linhas = [
      [
        "Operador",
        "Status",
        "Data abertura",
        "Hora abertura",
        "Data fechamento",
        "Hora fechamento",
        "Abertura",
        "Reforço",
        "Sangria",
        "Vendas",
        "Calculado",
        "Informado",
        "Diferença",
      ],
      ...resumosFiltrados.map((resumo) => [
        resumo.caixa.operador,
        resumo.caixa.status,
        resumo.caixa.dataAberturaTexto,
        resumo.caixa.horaAberturaTexto,
        resumo.caixa.dataFechamentoTexto,
        resumo.caixa.horaFechamentoTexto,
        moeda(resumo.totalAbertura),
        moeda(resumo.totalReforcos),
        moedaSaida(resumo.totalSangrias),
        moeda(resumo.totalVendas),
        moeda(resumo.calculado),
        moeda(resumo.informado),
        moeda(resumo.diferenca),
      ]),
    ];

    baixarCSV(`conferencia-caixa-${dataInicial || "inicio"}-${dataFinal || "fim"}.csv`, linhas);
  }

  function statusDiferenca(valor: number): string {
    if (valor === 0) return "text-emerald-700";
    if (valor > 0) return "text-blue-700";
    return "text-red-700";
  }

  function textoDiferenca(valor: number): string {
    if (valor === 0) return "OK";
    if (valor > 0) return "Sobra";
    return "Falta";
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
              Financeiro | Conferência de Caixa
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              Confira abertura, vendas, reforços, sangrias, fechamento e diferença de caixa.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/relatorios/vendas-detalhadas"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
            >
              Vendas detalhadas
            </a>
            <a
              href="/pdv/operacoes-caixa"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
            >
              Operações de caixa
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Caixas</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{totalizadores.caixasQuantidade}</p>
            <p className="mt-1 text-xs text-zinc-500">No filtro atual</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Vendas</p>
            <p className="mt-2 text-3xl font-black text-orange-600">{moeda(totalizadores.vendas)}</p>
            <p className="mt-1 text-xs text-zinc-500">Total vendido</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Reforços</p>
            <p className="mt-2 text-3xl font-black text-blue-700">{moeda(totalizadores.reforcos)}</p>
            <p className="mt-1 text-xs text-zinc-500">Entrada manual no caixa</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Sangrias</p>
            <p className="mt-2 text-3xl font-black text-red-600">{moedaSaida(totalizadores.sangrias)}</p>
            <p className="mt-1 text-xs text-zinc-500">Retiradas do caixa</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Calculado</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{moeda(totalizadores.calculado)}</p>
            <p className="mt-1 text-xs text-zinc-500">Sistema</p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Diferença</p>
            <p className={`mt-2 text-3xl font-black ${statusDiferenca(totalizadores.diferenca)}`}>
              {moeda(totalizadores.diferenca)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{textoDiferenca(totalizadores.diferenca)}</p>
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
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                <option value="Todos">Todos</option>
                <option value="Aberto">Aberto</option>
                <option value="Fechado">Fechado</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={limparFiltros}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700"
              >
                Limpar
              </button>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={exportarCSV}
                className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-600"
              >
                Exportar Excel
              </button>
            </div>
          </div>

          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por operador, status, código do caixa ou observação..."
            className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black text-zinc-950">Caixas encontrados</h2>
              <p className="text-sm text-zinc-500">
                Veja os valores automáticos do sistema e faça a conferência por forma de recebimento.
              </p>
            </div>

            <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
              {resumosFiltrados.length} caixa(s)
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1260px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-zinc-950 text-white">
                  <th className="px-3 py-3 font-black">Operador</th>
                  <th className="px-3 py-3 font-black">Status</th>
                  <th className="px-3 py-3 font-black">Abertura</th>
                  <th className="px-3 py-3 font-black">Fechamento</th>
                  <th className="px-3 py-3 text-right font-black">Abertura R$</th>
                  <th className="px-3 py-3 text-right font-black">Reforço</th>
                  <th className="px-3 py-3 text-right font-black">Sangria</th>
                  <th className="px-3 py-3 text-right font-black">Vendas</th>
                  <th className="px-3 py-3 text-right font-black">Calculado</th>
                  <th className="px-3 py-3 text-right font-black">Informado</th>
                  <th className="px-3 py-3 text-right font-black">Diferença</th>
                  <th className="px-3 py-3 text-center font-black">Ações</th>
                </tr>
              </thead>

              <tbody>
                {resumosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-zinc-500">
                      Nenhum caixa encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  resumosFiltrados.map((resumo, indice) => (
                    <tr
                      key={`${resumo.caixa.id}-${indice}`}
                      className={indice % 2 === 0 ? "bg-white" : "bg-orange-50/40"}
                    >
                      <td className="px-3 py-3 align-top">
                        <p className="font-black text-zinc-950">{resumo.caixa.operador}</p>
                        <p className="text-xs text-zinc-500">{resumo.caixa.id}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={
                            normalizarTextoComparacao(resumo.caixa.status).includes("aberto")
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800"
                              : "rounded-full bg-zinc-200 px-3 py-1 text-xs font-black text-zinc-800"
                          }
                        >
                          {resumo.caixa.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-bold">{resumo.caixa.dataAberturaTexto}</p>
                        <p className="text-xs text-zinc-500">{resumo.caixa.horaAberturaTexto}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-bold">{resumo.caixa.dataFechamentoTexto}</p>
                        <p className="text-xs text-zinc-500">{resumo.caixa.horaFechamentoTexto}</p>
                      </td>
                      <td className="px-3 py-3 text-right align-top font-bold">{moeda(resumo.totalAbertura)}</td>
                      <td className="px-3 py-3 text-right align-top font-bold text-blue-700">{moeda(resumo.totalReforcos)}</td>
                      <td className="px-3 py-3 text-right align-top font-bold text-red-600">{moedaSaida(resumo.totalSangrias)}</td>
                      <td className="px-3 py-3 text-right align-top font-bold text-orange-600">{moeda(resumo.totalVendas)}</td>
                      <td className="px-3 py-3 text-right align-top font-black">{moeda(resumo.calculado)}</td>
                      <td className="px-3 py-3 text-right align-top font-bold">{resumo.informado > 0 ? moeda(resumo.informado) : "-"}</td>
                      <td className={`px-3 py-3 text-right align-top font-black ${statusDiferenca(resumo.diferenca)}`}>
                        {resumo.informado > 0 ? moeda(resumo.diferenca) : "-"}
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoricoSelecionado(resumo)}
                            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-white transition hover:bg-zinc-700"
                          >
                            Histórico
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirConferencia(resumo)}
                            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600"
                          >
                            Conferir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
          <h2 className="text-lg font-black text-zinc-950">Como o cálculo é feito</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            O dinheiro calculado considera valor de abertura + vendas em dinheiro + reforços - sangrias.
            PIX, crédito, débito, correntista e outros entram separados. A diferença é calculada comparando
            o total informado pelo operador com o total automático do sistema.
          </p>
        </div>
      </section>

      {historicoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                  Histórico do caixa
                </p>
                <h3 className="mt-1 text-xl font-black text-zinc-950">
                  {historicoSelecionado.caixa.operador} — {historicoSelecionado.caixa.dataAberturaTexto}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {historicoSelecionado.eventos.length} evento(s) encontrado(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHistoricoSelecionado(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>

            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-950 text-white">
                      <th className="px-3 py-3 text-left font-black">Data/Hora</th>
                      <th className="px-3 py-3 text-left font-black">Evento</th>
                      <th className="px-3 py-3 text-left font-black">Movimento</th>
                      <th className="px-3 py-3 text-left font-black">Forma</th>
                      <th className="px-3 py-3 text-left font-black">Módulo</th>
                      <th className="px-3 py-3 text-left font-black">Identificação</th>
                      <th className="px-3 py-3 text-right font-black">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoSelecionado.eventos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                          Nenhum evento encontrado para este caixa.
                        </td>
                      </tr>
                    ) : (
                      historicoSelecionado.eventos.map((evento, indice) => (
                        <tr key={`${evento.id}-${indice}`} className={indice % 2 === 0 ? "bg-white" : "bg-orange-50/40"}>
                          <td className="px-3 py-3">
                            <p className="font-bold">{evento.dataTexto}</p>
                            <p className="text-xs text-zinc-500">{evento.horaTexto}</p>
                          </td>
                          <td className="px-3 py-3 font-bold">{evento.evento}</td>
                          <td className="px-3 py-3">
                            <span className={classeMovimentoEvento(evento)}>
                              {textoMovimentoEvento(evento)}
                            </span>
                          </td>
                          <td className="px-3 py-3">{evento.formaPagamento}</td>
                          <td className="px-3 py-3">{evento.modulo}</td>
                          <td className="px-3 py-3">{evento.identificacao}</td>
                          <td className={classeValorEvento(evento)}>{moedaEventoComSinal(evento)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {resumoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                  Conferência do caixa
                </p>
                <h3 className="mt-1 text-xl font-black text-zinc-950">
                  {resumoSelecionado.caixa.operador} — {resumoSelecionado.caixa.dataAberturaTexto}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Informe os valores conferidos para comparar com o automático do sistema.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharConferencia}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>

            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-950 text-white">
                      <th className="px-3 py-3 text-left font-black">Forma</th>
                      <th className="px-3 py-3 text-right font-black">Valor automático</th>
                      <th className="px-3 py-3 text-right font-black">Valor informado</th>
                      <th className="px-3 py-3 text-right font-black">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        nome: "Dinheiro",
                        automatico: resumoSelecionado.totalDinheiro,
                        valor: dinheiroInformado,
                        setValor: setDinheiroInformado,
                      },
                      {
                        nome: "PIX",
                        automatico: resumoSelecionado.totalPix,
                        valor: pixInformado,
                        setValor: setPixInformado,
                      },
                      {
                        nome: "Débito",
                        automatico: resumoSelecionado.totalDebito,
                        valor: debitoInformado,
                        setValor: setDebitoInformado,
                      },
                      {
                        nome: "Crédito",
                        automatico: resumoSelecionado.totalCredito,
                        valor: creditoInformado,
                        setValor: setCreditoInformado,
                      },
                      {
                        nome: "Correntista",
                        automatico: resumoSelecionado.totalCorrentista,
                        valor: correntistaInformado,
                        setValor: setCorrentistaInformado,
                      },
                      {
                        nome: "Outros",
                        automatico: resumoSelecionado.totalOutros,
                        valor: outrosInformado,
                        setValor: setOutrosInformado,
                      },
                    ].map((linha, indice) => {
                      const informadoLinha = numero(linha.valor);
                      const diferencaLinha = informadoLinha - linha.automatico;

                      return (
                        <tr key={linha.nome} className={indice % 2 === 0 ? "bg-white" : "bg-orange-50/40"}>
                          <td className="px-3 py-3 font-black">{linha.nome}</td>
                          <td className="px-3 py-3 text-right font-black">{moeda(linha.automatico)}</td>
                          <td className="px-3 py-3 text-right">
                            <input
                              type="text"
                              value={linha.valor}
                              onChange={(e) => linha.setValor(e.target.value)}
                              className="w-40 rounded-lg border border-zinc-200 px-3 py-2 text-right outline-none focus:border-orange-500"
                              placeholder="0,00"
                            />
                          </td>
                          <td className={`px-3 py-3 text-right font-black ${statusDiferenca(diferencaLinha)}`}>
                            {moeda(diferencaLinha)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-900 text-white">
                      <td className="px-3 py-3 font-black">Total</td>
                      <td className="px-3 py-3 text-right font-black">{moeda(valoresConferencia.totalCalculado)}</td>
                      <td className="px-3 py-3 text-right font-black">{moeda(valoresConferencia.totalInformado)}</td>
                      <td className="px-3 py-3 text-right font-black">{moeda(valoresConferencia.diferenca)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Abertura</p>
                  <p className="mt-1 text-xl font-black">{moeda(resumoSelecionado.totalAbertura)}</p>
                </div>
                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Reforço</p>
                  <p className="mt-1 text-xl font-black text-blue-700">{moeda(resumoSelecionado.totalReforcos)}</p>
                </div>
                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">Sangria</p>
                  <p className="mt-1 text-xl font-black text-red-600">{moedaSaida(resumoSelecionado.totalSangrias)}</p>
                </div>
                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase text-zinc-500">{textoDiferenca(valoresConferencia.diferenca)}</p>
                  <p className={`mt-1 text-xl font-black ${statusDiferenca(valoresConferencia.diferenca)}`}>
                    {moeda(valoresConferencia.diferenca)}
                  </p>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Observação da conferência
                </span>
                <textarea
                  value={observacaoConferencia}
                  onChange={(e) => setObservacaoConferencia(e.target.value)}
                  className="mt-1 min-h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                  placeholder="Exemplo: diferença conferida com operador, valor de sangria confirmado, fechamento ok..."
                />
              </label>

              <div className="mt-5 flex flex-col gap-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={fecharConferencia}
                  className="rounded-lg bg-zinc-200 px-5 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarConferencia}
                  className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-600"
                >
                  Salvar conferência
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
