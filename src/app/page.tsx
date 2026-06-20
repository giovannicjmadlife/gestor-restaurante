"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { useEffect, useMemo, useState } from "react";
import {
  LS_CONTAS_RECEBER,
  LS_ENTRADAS,
  LS_FOLHA,
  LS_INVESTIMENTOS,
  LS_SAIDAS,
  LS_VENDAS_DETALHADAS,
  RegistroFinanceiro,
  anoAtualISO,
  buscarFinanceiroSupabase,
  dataDoRegistro,
  descontoRegistro,
  formaResumoRegistro,
  formatarMoeda,
  hojeISO,
  itensDoRegistro,
  lerArrayLocalStorage,
  mesAtualISO,
  numeroSeguro,
  pagamentosDoRegistro,
  taxaRegistro,
  valorBrutoRegistro,
  valorLiquidoRegistro,
} from "@/lib/financeiroSupabase";

type LancamentoDashboard = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  categoria: string;
  valor: number;
};

type MovimentoDia = {
  data: string;
  bruto: number;
  liquido: number;
  taxas: number;
  despesasPagas: number;
  contasReceber: number;
  contasPagar: number;
  saldoReal: number;
  saldoPrevisto: number;
};

type MovimentoMes = {
  mes: string;
  bruto: number;
  liquido: number;
  taxas: number;
  despesasPagas: number;
  contasReceber: number;
  contasPagar: number;
  saldoReal: number;
  saldoPrevisto: number;
};

const ITENS_POR_PAGINA = 15;
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function statusNormalizado(item: RegistroFinanceiro) {
  return String(item.status || "").trim().toLowerCase();
}

function estaPago(item: RegistroFinanceiro) {
  const status = statusNormalizado(item);
  return status === "pago" || status === "recebido";
}

function estaAberto(item: RegistroFinanceiro) {
  const status = statusNormalizado(item);
  return status === "pendente" || status === "vencido" || status === "atrasado" || status === "planejado";
}

function valorRegistro(item: RegistroFinanceiro) {
  return numeroSeguro(item.valor) || valorLiquidoRegistro(item) || valorBrutoRegistro(item);
}

function deduplicarReceitas(entradas: RegistroFinanceiro[], vendasDetalhadas: RegistroFinanceiro[]) {
  const mapa = new Map<string, RegistroFinanceiro>();

  entradas.forEach((item, index) => {
    mapa.set(String(item.id || `entrada-${index}`), item);
  });

  vendasDetalhadas.forEach((item, index) => {
    const id = String(item.id || `venda-${index}`);
    if (!mapa.has(id)) mapa.set(id, item);
  });

  return Array.from(mapa.values());
}

function registroNoDia(item: RegistroFinanceiro, dia: string) {
  return dataDoRegistro(item) === dia;
}

function registroNoMes(item: RegistroFinanceiro, mes: string) {
  return dataDoRegistro(item).slice(0, 7) === mes;
}

function registroNoAno(item: RegistroFinanceiro, ano: string) {
  return dataDoRegistro(item).slice(0, 4) === ano;
}

function labelData(data: string) {
  if (!data) return "-";
  return data.split("-").reverse().join("/");
}

function labelMes(mes: string) {
  const [ano, numeroMes] = mes.split("-");
  const indice = Number(numeroMes) - 1;
  return `${MESES[indice] || numeroMes}/${ano}`;
}

function mesDoAno(ano: string, indice: number) {
  return `${ano}-${String(indice + 1).padStart(2, "0")}`;
}

function paginaDe<T>(lista: T[], paginaAtual: number) {
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  return lista.slice(inicio, inicio + ITENS_POR_PAGINA);
}

function totalPaginas(totalItens: number) {
  return Math.max(Math.ceil(totalItens / ITENS_POR_PAGINA), 1);
}

function somarValores(lista: RegistroFinanceiro[]) {
  return lista.reduce((acc, item) => acc + valorRegistro(item), 0);
}

function somarBruto(lista: RegistroFinanceiro[]) {
  return lista.reduce((acc, item) => acc + valorBrutoRegistro(item), 0);
}

function somarLiquido(lista: RegistroFinanceiro[]) {
  return lista.reduce((acc, item) => acc + valorLiquidoRegistro(item), 0);
}

function somarTaxas(lista: RegistroFinanceiro[]) {
  return lista.reduce((acc, item) => acc + taxaRegistro(item), 0);
}

function somarDescontos(lista: RegistroFinanceiro[]) {
  return lista.reduce((acc, item) => acc + descontoRegistro(item), 0);
}

function pegarAnos(...listas: RegistroFinanceiro[][]) {
  const anos = new Set<string>([anoAtualISO()]);

  listas.flat().forEach((item) => {
    const ano = dataDoRegistro(item).slice(0, 4);
    if (/^\d{4}$/.test(ano)) anos.add(ano);
  });

  return Array.from(anos).sort((a, b) => Number(b) - Number(a));
}

function corSaldo(valor: number) {
  return valor >= 0 ? "text-emerald-700" : "text-red-600";
}

export default function DashboardPage() {
  const [entradas, setEntradas] = useState<RegistroFinanceiro[]>([]);
  const [vendasDetalhadas, setVendasDetalhadas] = useState<RegistroFinanceiro[]>([]);
  const [saidas, setSaidas] = useState<RegistroFinanceiro[]>([]);
  const [contasReceber, setContasReceber] = useState<RegistroFinanceiro[]>([]);
  const [folhaPagamento, setFolhaPagamento] = useState<RegistroFinanceiro[]>([]);
  const [investimentos, setInvestimentos] = useState<RegistroFinanceiro[]>([]);
  const [erro, setErro] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtualISO());
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualISO());
  const [diaLancamentos, setDiaLancamentos] = useState("");
  const [tipoLancamento, setTipoLancamento] = useState("Todos");
  const [paginaDias, setPaginaDias] = useState(1);
  const [paginaLancamentos, setPaginaLancamentos] = useState(1);

  useEffect(() => {
    let ativo = true;

    const entradasLocais = lerArrayLocalStorage<RegistroFinanceiro>(LS_ENTRADAS);
    const vendasLocais = lerArrayLocalStorage<RegistroFinanceiro>(LS_VENDAS_DETALHADAS);
    const saidasLocais = lerArrayLocalStorage<RegistroFinanceiro>(LS_SAIDAS);
    const contasLocais = lerArrayLocalStorage<RegistroFinanceiro>(LS_CONTAS_RECEBER);
    const folhaLocal = lerArrayLocalStorage<RegistroFinanceiro>(LS_FOLHA);
    const investimentosLocais = lerArrayLocalStorage<RegistroFinanceiro>(LS_INVESTIMENTOS);

    setEntradas(entradasLocais);
    setVendasDetalhadas(vendasLocais);
    setSaidas(saidasLocais);
    setContasReceber(contasLocais);
    setFolhaPagamento(folhaLocal);
    setInvestimentos(investimentosLocais);

    buscarFinanceiroSupabase()
      .then((dados) => {
        if (!ativo) return;

        setEntradas(dados.entradas || []);
        setVendasDetalhadas(dados.vendasDetalhadas || []);
        setSaidas(dados.saidas || []);
        setContasReceber(dados.contasReceber || []);
        setFolhaPagamento(dados.folhaPagamento || []);
        setInvestimentos(dados.investimentos || []);
        setErro("");
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Não consegui carregar o Supabase. Mostrando cache local.");
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!mesSelecionado.startsWith(`${anoSelecionado}-`)) {
      setMesSelecionado(anoSelecionado === anoAtualISO() ? mesAtualISO() : `${anoSelecionado}-01`);
    }
  }, [anoSelecionado, mesSelecionado]);

  useEffect(() => {
    setPaginaDias(1);
    setPaginaLancamentos(1);
  }, [anoSelecionado, mesSelecionado, diaLancamentos, tipoLancamento]);

  const receitas = useMemo(() => deduplicarReceitas(entradas, vendasDetalhadas), [entradas, vendasDetalhadas]);

  const anosDisponiveis = useMemo(
    () => pegarAnos(receitas, saidas, contasReceber, folhaPagamento, investimentos),
    [receitas, saidas, contasReceber, folhaPagamento, investimentos]
  );

  const mesesDisponiveis = useMemo(
    () => Array.from({ length: 12 }, (_, indice) => mesDoAno(anoSelecionado, indice)),
    [anoSelecionado]
  );

  const resumo = useMemo(() => {
    const receitasHoje = receitas.filter((item) => registroNoDia(item, hojeISO()));
    const receitasMes = receitas.filter((item) => registroNoMes(item, mesSelecionado));
    const receitasAno = receitas.filter((item) => registroNoAno(item, anoSelecionado));

    const saidasPagasMesLista = saidas.filter((item) => registroNoMes(item, mesSelecionado) && estaPago(item));
    const folhaPagaMesLista = folhaPagamento.filter((item) => registroNoMes(item, mesSelecionado) && estaPago(item));
    const investimentosPagosMesLista = investimentos.filter((item) => registroNoMes(item, mesSelecionado) && estaPago(item));

    const saidasPagasAnoLista = saidas.filter((item) => registroNoAno(item, anoSelecionado) && estaPago(item));
    const folhaPagaAnoLista = folhaPagamento.filter((item) => registroNoAno(item, anoSelecionado) && estaPago(item));
    const investimentosPagosAnoLista = investimentos.filter((item) => registroNoAno(item, anoSelecionado) && estaPago(item));

    const contasAPagarMesLista = [
      ...saidas.filter((item) => registroNoMes(item, mesSelecionado) && estaAberto(item)),
      ...folhaPagamento.filter((item) => registroNoMes(item, mesSelecionado) && estaAberto(item)),
    ];

    const contasAPagarAnoLista = [
      ...saidas.filter((item) => registroNoAno(item, anoSelecionado) && estaAberto(item)),
      ...folhaPagamento.filter((item) => registroNoAno(item, anoSelecionado) && estaAberto(item)),
    ];

    const contasAReceberMesLista = contasReceber.filter((item) => registroNoMes(item, mesSelecionado) && estaAberto(item));
    const contasAReceberAnoLista = contasReceber.filter((item) => registroNoAno(item, anoSelecionado) && estaAberto(item));

    const investimentosPendentesMesLista = investimentos.filter((item) => registroNoMes(item, mesSelecionado) && estaAberto(item));
    const investimentosPendentesAnoLista = investimentos.filter((item) => registroNoAno(item, anoSelecionado) && estaAberto(item));

    const faturamentoHoje = somarBruto(receitasHoje);
    const liquidoHoje = somarLiquido(receitasHoje);
    const taxasHoje = somarTaxas(receitasHoje);
    const descontosHoje = somarDescontos(receitasHoje);

    const faturamentoMes = somarBruto(receitasMes);
    const liquidoMes = somarLiquido(receitasMes);
    const taxasMes = somarTaxas(receitasMes);
    const descontosMes = somarDescontos(receitasMes);
    const saidasPagasMes = somarValores(saidasPagasMesLista);
    const folhaPagaMes = somarValores(folhaPagaMesLista);
    const investimentosPagosMes = somarValores(investimentosPagosMesLista);
    const despesasPagasMes = saidasPagasMes + folhaPagaMes + investimentosPagosMes;
    const contasAPagarMes = somarValores(contasAPagarMesLista);
    const contasAReceberMes = somarValores(contasAReceberMesLista);
    const investimentosPendentesMes = somarValores(investimentosPendentesMesLista);
    const saldoRealMes = liquidoMes - despesasPagasMes;
    const saldoPrevistoMes = saldoRealMes + contasAReceberMes - contasAPagarMes - investimentosPendentesMes;

    const faturamentoAno = somarBruto(receitasAno);
    const liquidoAno = somarLiquido(receitasAno);
    const taxasAno = somarTaxas(receitasAno);
    const descontosAno = somarDescontos(receitasAno);
    const saidasPagasAno = somarValores(saidasPagasAnoLista);
    const folhaPagaAno = somarValores(folhaPagaAnoLista);
    const investimentosPagosAno = somarValores(investimentosPagosAnoLista);
    const despesasPagasAno = saidasPagasAno + folhaPagaAno + investimentosPagosAno;
    const contasAPagarAno = somarValores(contasAPagarAnoLista);
    const contasAReceberAno = somarValores(contasAReceberAnoLista);
    const investimentosPendentesAno = somarValores(investimentosPendentesAnoLista);
    const saldoRealAno = liquidoAno - despesasPagasAno;
    const saldoPrevistoAno = saldoRealAno + contasAReceberAno - contasAPagarAno - investimentosPendentesAno;

    return {
      faturamentoHoje,
      liquidoHoje,
      taxasHoje,
      descontosHoje,
      faturamentoMes,
      liquidoMes,
      taxasMes,
      descontosMes,
      saidasPagasMes,
      folhaPagaMes,
      investimentosPagosMes,
      despesasPagasMes,
      contasAPagarMes,
      contasAReceberMes,
      investimentosPendentesMes,
      saldoRealMes,
      saldoPrevistoMes,
      faturamentoAno,
      liquidoAno,
      taxasAno,
      descontosAno,
      saidasPagasAno,
      folhaPagaAno,
      investimentosPagosAno,
      despesasPagasAno,
      contasAPagarAno,
      contasAReceberAno,
      investimentosPendentesAno,
      saldoRealAno,
      saldoPrevistoAno,
      totalLancamentos:
        receitas.length + saidas.length + contasReceber.length + folhaPagamento.length + investimentos.length,
    };
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos, mesSelecionado, anoSelecionado]);

  const saudeMes = useMemo(() => {
    if (resumo.saldoPrevistoMes < 0) {
      return {
        titulo: "Risco",
        cor: "text-red-600",
        fundo: "bg-red-50",
        detalhe: "A previsão do mês está negativa. Olhe contas a pagar e despesas antes de assumir novos compromissos.",
      };
    }

    const compromissos = resumo.contasAPagarMes + resumo.investimentosPendentesMes;
    if (resumo.liquidoMes > 0 && compromissos > resumo.liquidoMes * 0.6) {
      return {
        titulo: "Atenção",
        cor: "text-orange-600",
        fundo: "bg-orange-50",
        detalhe: "O mês está positivo, mas os compromissos em aberto estão altos perto do líquido vendido.",
      };
    }

    return {
      titulo: "Boa",
      cor: "text-emerald-700",
      fundo: "bg-emerald-50",
      detalhe: "A previsão está positiva. Continue acompanhando despesas, contas e recebimentos.",
    };
  }, [resumo]);

  const formasPagamentoMes = useMemo(() => {
    const agrupado = new Map<string, { forma: string; quantidade: number; faturamento: number; liquido: number }>();

    receitas.filter((item) => registroNoMes(item, mesSelecionado)).forEach((item) => {
      const pagamentos = pagamentosDoRegistro(item);

      if (pagamentos.length === 0) {
        const forma = formaResumoRegistro(item);
        const atual = agrupado.get(forma) || { forma, quantidade: 0, faturamento: 0, liquido: 0 };
        atual.quantidade += 1;
        atual.faturamento += valorBrutoRegistro(item);
        atual.liquido += valorLiquidoRegistro(item);
        agrupado.set(forma, atual);
        return;
      }

      pagamentos.forEach((pagamento) => {
        const forma = String(pagamento.forma || "Não informado");
        const atual = agrupado.get(forma) || { forma, quantidade: 0, faturamento: 0, liquido: 0 };
        atual.quantidade += 1;
        atual.faturamento += numeroSeguro(pagamento.valorPago);
        atual.liquido += numeroSeguro(pagamento.valorLiquido);
        agrupado.set(forma, atual);
      });
    });

    const lista = Array.from(agrupado.values()).sort((a, b) => b.faturamento - a.faturamento);
    const maiorValor = lista[0]?.faturamento || 0;

    return lista.map((item) => ({
      ...item,
      percentual: maiorValor > 0 ? Math.max((item.faturamento / maiorValor) * 100, 4) : 0,
    }));
  }, [receitas, mesSelecionado]);

  const movimentoPorDia = useMemo(() => {
    const mapa = new Map<string, MovimentoDia>();

    const pegarDia = (data: string) => {
      const atual = mapa.get(data) || {
        data,
        bruto: 0,
        liquido: 0,
        taxas: 0,
        despesasPagas: 0,
        contasReceber: 0,
        contasPagar: 0,
        saldoReal: 0,
        saldoPrevisto: 0,
      };
      mapa.set(data, atual);
      return atual;
    };

    receitas.filter((item) => registroNoMes(item, mesSelecionado)).forEach((item) => {
      const dia = pegarDia(dataDoRegistro(item));
      dia.bruto += valorBrutoRegistro(item);
      dia.liquido += valorLiquidoRegistro(item);
      dia.taxas += taxaRegistro(item);
    });

    [...saidas, ...folhaPagamento, ...investimentos]
      .filter((item) => registroNoMes(item, mesSelecionado) && estaPago(item))
      .forEach((item) => {
        pegarDia(dataDoRegistro(item)).despesasPagas += valorRegistro(item);
      });

    contasReceber.filter((item) => registroNoMes(item, mesSelecionado) && estaAberto(item)).forEach((item) => {
      pegarDia(dataDoRegistro(item)).contasReceber += valorRegistro(item);
    });

    [...saidas, ...folhaPagamento]
      .filter((item) => registroNoMes(item, mesSelecionado) && estaAberto(item))
      .forEach((item) => {
        pegarDia(dataDoRegistro(item)).contasPagar += valorRegistro(item);
      });

    return Array.from(mapa.values())
      .map((dia) => {
        const saldoReal = dia.liquido - dia.despesasPagas;
        const saldoPrevisto = saldoReal + dia.contasReceber - dia.contasPagar;
        return { ...dia, saldoReal, saldoPrevisto };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos, mesSelecionado]);

  const movimentoPorMes = useMemo(() => {
    return Array.from({ length: 12 }, (_, indice): MovimentoMes => {
      const mes = mesDoAno(anoSelecionado, indice);
      const receitasMes = receitas.filter((item) => registroNoMes(item, mes));
      const despesasPagas = somarValores(
        [...saidas, ...folhaPagamento, ...investimentos].filter((item) => registroNoMes(item, mes) && estaPago(item))
      );
      const contasReceberMes = somarValores(contasReceber.filter((item) => registroNoMes(item, mes) && estaAberto(item)));
      const contasPagarMes = somarValores(
        [...saidas, ...folhaPagamento].filter((item) => registroNoMes(item, mes) && estaAberto(item))
      );
      const bruto = somarBruto(receitasMes);
      const liquido = somarLiquido(receitasMes);
      const taxas = somarTaxas(receitasMes);
      const saldoReal = liquido - despesasPagas;
      const saldoPrevisto = saldoReal + contasReceberMes - contasPagarMes;

      return {
        mes,
        bruto,
        liquido,
        taxas,
        despesasPagas,
        contasReceber: contasReceberMes,
        contasPagar: contasPagarMes,
        saldoReal,
        saldoPrevisto,
      };
    });
  }, [anoSelecionado, receitas, saidas, contasReceber, folhaPagamento, investimentos]);

  const produtosMaisVendidos = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantidade: number; total: number }>();

    vendasDetalhadas.filter((venda) => registroNoMes(venda, mesSelecionado)).forEach((venda) => {
      itensDoRegistro(venda).forEach((item) => {
        const atual = mapa.get(item.nome) || { nome: item.nome, quantidade: 0, total: 0 };
        atual.quantidade += numeroSeguro(item.quantidade);
        atual.total += numeroSeguro(item.total);
        mapa.set(item.nome, atual);
      });
    });

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [vendasDetalhadas, mesSelecionado]);

  const comissoes = useMemo(() => {
    const mapa = new Map<string, { nome: string; vendas: number; comissao: number }>();

    vendasDetalhadas.filter((venda) => registroNoMes(venda, mesSelecionado)).forEach((venda) => {
      const nome = String(venda.colaboradorNome || "").trim();
      const percentual = numeroSeguro(venda.colaboradorPercentual);
      if (!nome || percentual <= 0) return;

      const atual = mapa.get(nome) || { nome, vendas: 0, comissao: 0 };
      const liquidoVenda = valorLiquidoRegistro(venda);
      atual.vendas += liquidoVenda;
      atual.comissao += (liquidoVenda * percentual) / 100;
      mapa.set(nome, atual);
    });

    return Array.from(mapa.values()).sort((a, b) => b.comissao - a.comissao).slice(0, 8);
  }, [vendasDetalhadas, mesSelecionado]);

  const lancamentos = useMemo<LancamentoDashboard[]>(() => {
    const mapear = (lista: RegistroFinanceiro[], tipo: string, sinal: "entrada" | "saida" = "entrada") =>
      lista.map((item, index) => ({
        id: `${tipo}-${item.id || index}`,
        data: dataDoRegistro(item),
        tipo,
        descricao: String(item.descricao || item.cliente || item.origem || item.nome || item.categoria || "-"),
        categoria: String(item.categoria || item.funcao || "-"),
        valor: valorRegistro(item) * (sinal === "saida" ? -1 : 1),
      }));

    return [
      ...mapear(receitas, "Entrada"),
      ...mapear(saidas, "Saída", "saida"),
      ...mapear(contasReceber, "Conta a receber"),
      ...mapear(folhaPagamento, "Folha", "saida"),
      ...mapear(investimentos, "Investimento", "saida"),
    ].sort((a, b) => b.data.localeCompare(a.data));
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos]);

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((item) => {
      if (tipoLancamento !== "Todos" && item.tipo !== tipoLancamento) return false;
      if (diaLancamentos) return item.data === diaLancamentos;
      return item.data.slice(0, 7) === mesSelecionado;
    });
  }, [lancamentos, tipoLancamento, diaLancamentos, mesSelecionado]);

  const diasPaginados = paginaDe(movimentoPorDia, paginaDias);
  const lancamentosPaginados = paginaDe(lancamentosFiltrados, paginaLancamentos);
  const totalPaginasDias = totalPaginas(movimentoPorDia.length);
  const totalPaginasLancamentos = totalPaginas(lancamentosFiltrados.length);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="dashboard" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">Visão geral</p>
            <h1 className="text-3xl font-bold text-slate-950">Dashboard financeiro</h1>
            <p className="text-sm text-slate-600">
              Faturamento, líquido real, despesas, contas, previsão e movimento por dia atualizado pelo Supabase.
            </p>
            {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{erro}</p>}
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Filtros do dashboard</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use mês e ano para enxergar o restaurante sem misturar períodos diferentes.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">
                  Ano
                  <select
                    value={anoSelecionado}
                    onChange={(event) => setAnoSelecionado(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-500"
                  >
                    {anosDisponiveis.map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Mês
                  <select
                    value={mesSelecionado}
                    onChange={(event) => setMesSelecionado(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-500"
                  >
                    {mesesDisponiveis.map((mes) => (
                      <option key={mes} value={mes}>
                        {labelMes(mes)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Dia dos lançamentos
                  <input
                    type="date"
                    value={diaLancamentos}
                    onChange={(event) => setDiaLancamentos(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-500"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card titulo="Faturado hoje" valor={resumo.faturamentoHoje} detalhe={`Líquido: ${formatarMoeda(resumo.liquidoHoje)}`} cor="text-emerald-700" />
            <Card titulo="Taxas hoje" valor={resumo.taxasHoje} detalhe={`Descontos: ${formatarMoeda(resumo.descontosHoje)}`} cor="text-red-600" />
            <Card titulo="Bruto do mês" valor={resumo.faturamentoMes} detalhe={labelMes(mesSelecionado)} cor="text-slate-950" />
            <Card titulo="Líquido do mês" valor={resumo.liquidoMes} detalhe={`Taxas: ${formatarMoeda(resumo.taxasMes)}`} cor="text-emerald-700" />
            <Card titulo="Despesas pagas no mês" valor={resumo.despesasPagasMes} detalhe="Saídas + folha + investimentos pagos." cor="text-red-600" />
            <Card titulo="Contas a pagar do mês" valor={resumo.contasAPagarMes} detalhe="Somente mês selecionado." cor="text-orange-600" />
            <Card titulo="Contas a receber do mês" valor={resumo.contasAReceberMes} detalhe="Pendentes ou atrasadas no mês." cor="text-blue-700" />
            <Card titulo="Saldo previsto do mês" valor={resumo.saldoPrevistoMes} detalhe="Saldo real + receber - pagar - investir." cor={corSaldo(resumo.saldoPrevistoMes)} />
            <Card titulo="Bruto do ano" valor={resumo.faturamentoAno} detalhe={`Ano selecionado: ${anoSelecionado}`} cor="text-slate-950" />
            <Card titulo="Líquido do ano" valor={resumo.liquidoAno} detalhe={`Taxas no ano: ${formatarMoeda(resumo.taxasAno)}`} cor="text-emerald-700" />
            <Card titulo="Pago no ano" valor={resumo.despesasPagasAno} detalhe="Saídas + folha + investimentos pagos." cor="text-red-600" />
            <Card titulo="Previsão final do ano" valor={resumo.saldoPrevistoAno} detalhe="Líquido - pagos + receber - pagar." cor={corSaldo(resumo.saldoPrevistoAno)} />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card titulo="Já entrou líquido no mês" valor={resumo.liquidoMes} detalhe="Dinheiro que sobrou das vendas após taxas." cor="text-emerald-700" />
            <Card titulo="Ainda vou receber" valor={resumo.contasAReceberMes} detalhe="Contas a receber do mês selecionado." cor="text-blue-700" />
            <Card titulo="Ainda vou pagar" valor={resumo.contasAPagarMes + resumo.investimentosPendentesMes} detalhe="Contas + investimentos em aberto." cor="text-orange-600" />
            <div className={`rounded-2xl border border-slate-200 p-5 ${saudeMes.fundo}`}>
              <p className="text-sm text-slate-500">Saúde do mês</p>
              <strong className={`mt-2 block text-2xl ${saudeMes.cor}`}>{saudeMes.titulo}</strong>
              <p className="mt-2 text-xs font-medium text-slate-600">{saudeMes.detalhe}</p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Movimento por dia — {labelMes(mesSelecionado)}</h2>
                <p className="text-sm text-slate-500">Resumo diário com bruto, líquido, despesas e previsão.</p>
              </div>
              <Paginacao pagina={paginaDias} totalPaginas={totalPaginasDias} onPagina={setPaginaDias} />
            </div>

            <TabelaMovimentoDia itens={diasPaginados} />
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-950">Movimento mensal do ano — {anoSelecionado}</h2>
            <p className="mt-1 text-sm text-slate-500">Cada linha mostra um mês do ano selecionado.</p>
            <TabelaMovimentoMes itens={movimentoPorMes} />
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Formas de pagamento — {labelMes(mesSelecionado)}</h2>
                <p className="text-sm text-slate-500">Usa pagamentos divididos, taxas e valor líquido real.</p>
              </div>
              <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                Lançamentos: {resumo.totalLancamentos}
              </div>
            </div>

            {formasPagamentoMes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhuma venda no mês selecionado.
              </div>
            ) : (
              <div className="space-y-4">
                {formasPagamentoMes.map((item) => (
                  <div key={item.forma}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-slate-950">{item.forma}</span>
                      <span className="font-semibold text-slate-600">
                        {item.quantidade} registro(s) · {formatarMoeda(item.faturamento)} bruto · {formatarMoeda(item.liquido)} líquido
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${item.percentual}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ResumoLista titulo={`Produtos mais vendidos — ${labelMes(mesSelecionado)}`} vazio="Nenhum item vendido no mês selecionado.">
              {produtosMaisVendidos.map((item) => (
                <div key={item.nome} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{item.nome} · {item.quantidade.toLocaleString("pt-BR")} un/kg</span>
                  <strong className="text-sm text-emerald-700">{formatarMoeda(item.total)}</strong>
                </div>
              ))}
            </ResumoLista>

            <ResumoLista titulo={`Comissões por colaborador — ${labelMes(mesSelecionado)}`} vazio="Nenhuma comissão no mês selecionado.">
              {comissoes.map((item) => (
                <div key={item.nome} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{item.nome} · vendas {formatarMoeda(item.vendas)}</span>
                  <strong className="text-sm text-purple-700">{formatarMoeda(item.comissao)}</strong>
                </div>
              ))}
            </ResumoLista>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Lançamentos filtrados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Mostrando {diaLancamentos ? labelData(diaLancamentos) : labelMes(mesSelecionado)} com paginação.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="text-sm font-semibold text-slate-700">
                  Tipo
                  <select
                    value={tipoLancamento}
                    onChange={(event) => setTipoLancamento(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-orange-500"
                  >
                    {['Todos', 'Entrada', 'Saída', 'Conta a receber', 'Folha', 'Investimento'].map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setDiaLancamentos("")}
                  className="rounded-xl border border-orange-200 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50"
                >
                  Limpar dia
                </button>
                <Paginacao pagina={paginaLancamentos} totalPaginas={totalPaginasLancamentos} onPagina={setPaginaLancamentos} />
              </div>
            </div>

            <TabelaLancamentos itens={lancamentosPaginados} />
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ titulo, valor, detalhe, cor }: { titulo: string; valor: number; detalhe: string; cor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{titulo}</p>
      <strong className={`mt-2 block text-2xl ${cor}`}>{formatarMoeda(valor)}</strong>
      <p className="mt-2 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}

function Paginacao({
  pagina,
  totalPaginas,
  onPagina,
}: {
  pagina: number;
  totalPaginas: number;
  onPagina: (pagina: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => onPagina(Math.max(pagina - 1, 1))}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
        {pagina}/{totalPaginas}
      </span>
      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => onPagina(Math.min(pagina + 1, totalPaginas))}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próxima
      </button>
    </div>
  );
}

function TabelaMovimentoDia({ itens }: { itens: MovimentoDia[] }) {
  if (itens.length === 0) {
    return <Vazio texto="Nenhum movimento encontrado para o mês selecionado." />;
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3">Dia</th>
            <th className="px-3 py-3 text-right">Bruto</th>
            <th className="px-3 py-3 text-right">Líquido</th>
            <th className="px-3 py-3 text-right">Taxas</th>
            <th className="px-3 py-3 text-right">Despesas pagas</th>
            <th className="px-3 py-3 text-right">A receber</th>
            <th className="px-3 py-3 text-right">A pagar</th>
            <th className="px-3 py-3 text-right">Previsto</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.data} className="border-b border-slate-100 text-sm">
              <td className="px-3 py-4 font-bold text-slate-700">{labelData(item.data)}</td>
              <td className="px-3 py-4 text-right font-semibold text-slate-950">{formatarMoeda(item.bruto)}</td>
              <td className="px-3 py-4 text-right font-semibold text-emerald-700">{formatarMoeda(item.liquido)}</td>
              <td className="px-3 py-4 text-right font-semibold text-red-600">{formatarMoeda(item.taxas)}</td>
              <td className="px-3 py-4 text-right font-semibold text-red-600">{formatarMoeda(item.despesasPagas)}</td>
              <td className="px-3 py-4 text-right font-semibold text-blue-700">{formatarMoeda(item.contasReceber)}</td>
              <td className="px-3 py-4 text-right font-semibold text-orange-600">{formatarMoeda(item.contasPagar)}</td>
              <td className={`px-3 py-4 text-right font-bold ${corSaldo(item.saldoPrevisto)}`}>{formatarMoeda(item.saldoPrevisto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaMovimentoMes({ itens }: { itens: MovimentoMes[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3">Mês</th>
            <th className="px-3 py-3 text-right">Bruto</th>
            <th className="px-3 py-3 text-right">Líquido</th>
            <th className="px-3 py-3 text-right">Taxas</th>
            <th className="px-3 py-3 text-right">Despesas pagas</th>
            <th className="px-3 py-3 text-right">A receber</th>
            <th className="px-3 py-3 text-right">A pagar</th>
            <th className="px-3 py-3 text-right">Previsto</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.mes} className="border-b border-slate-100 text-sm">
              <td className="px-3 py-4 font-bold text-slate-700">{labelMes(item.mes)}</td>
              <td className="px-3 py-4 text-right font-semibold text-slate-950">{formatarMoeda(item.bruto)}</td>
              <td className="px-3 py-4 text-right font-semibold text-emerald-700">{formatarMoeda(item.liquido)}</td>
              <td className="px-3 py-4 text-right font-semibold text-red-600">{formatarMoeda(item.taxas)}</td>
              <td className="px-3 py-4 text-right font-semibold text-red-600">{formatarMoeda(item.despesasPagas)}</td>
              <td className="px-3 py-4 text-right font-semibold text-blue-700">{formatarMoeda(item.contasReceber)}</td>
              <td className="px-3 py-4 text-right font-semibold text-orange-600">{formatarMoeda(item.contasPagar)}</td>
              <td className={`px-3 py-4 text-right font-bold ${corSaldo(item.saldoPrevisto)}`}>{formatarMoeda(item.saldoPrevisto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaLancamentos({ itens }: { itens: LancamentoDashboard[] }) {
  if (itens.length === 0) {
    return <Vazio texto="Nenhum lançamento encontrado para o filtro selecionado." />;
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3">Data</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Descrição</th>
            <th className="px-3 py-3">Categoria</th>
            <th className="px-3 py-3 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 text-sm">
              <td className="px-3 py-4 text-slate-700">{labelData(item.data)}</td>
              <td className="px-3 py-4 font-bold text-slate-700">{item.tipo}</td>
              <td className="px-3 py-4 font-medium text-slate-950">{item.descricao}</td>
              <td className="px-3 py-4 text-slate-700">{item.categoria}</td>
              <td className={`px-3 py-4 text-right font-bold ${item.valor >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatarMoeda(Math.abs(item.valor))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      {texto}
    </div>
  );
}

function ResumoLista({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode }) {
  const temItens = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-5 text-xl font-bold text-slate-950">{titulo}</h2>
      {temItens ? <div className="space-y-3">{children}</div> : <p className="text-sm text-slate-500">{vazio}</p>}
    </div>
  );
}
