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
  buscarFinanceiroSupabase,
  buscarTaxasSupabase,
  dataDoRegistro,
  descontoRegistro,
  formatarMoeda,
  lerArrayLocalStorage,
  numeroSeguro,
  registroEstaNoMes,
  taxaRegistroComCadastro,
  valorBrutoRegistro,
  valorLiquidoRegistroComCadastro,
} from "@/lib/financeiroSupabase";

type LancamentoRelatorio = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  categoria: string;
  status: string;
  valor: number;
};



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
  return numeroSeguro(item.valor) || valorLiquidoRegistroComCadastro(item) || valorBrutoRegistro(item);
}

function deduplicarReceitas(entradas: RegistroFinanceiro[], vendasDetalhadas: RegistroFinanceiro[]) {
  const mapa = new Map<string, RegistroFinanceiro>();
  entradas.forEach((item, index) => mapa.set(String(item.id || `entrada-${index}`), item));
  vendasDetalhadas.forEach((item, index) => {
    const id = String(item.id || `venda-${index}`);
    if (!mapa.has(id)) mapa.set(id, item);
  });
  return Array.from(mapa.values());
}

export default function RelatoriosPage() {
  const [entradas, setEntradas] = useState<RegistroFinanceiro[]>([]);
  const [vendasDetalhadas, setVendasDetalhadas] = useState<RegistroFinanceiro[]>([]);
  const [saidas, setSaidas] = useState<RegistroFinanceiro[]>([]);
  const [contasReceber, setContasReceber] = useState<RegistroFinanceiro[]>([]);
  const [folhaPagamento, setFolhaPagamento] = useState<RegistroFinanceiro[]>([]);
  const [investimentos, setInvestimentos] = useState<RegistroFinanceiro[]>([]);
  const [taxasMaquininhas, setTaxasMaquininhas] = useState<any[]>([]);
  const [taxasDelivery, setTaxasDelivery] = useState<any[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    setEntradas(lerArrayLocalStorage<RegistroFinanceiro>(LS_ENTRADAS));
    setVendasDetalhadas(lerArrayLocalStorage<RegistroFinanceiro>(LS_VENDAS_DETALHADAS));
    setSaidas(lerArrayLocalStorage<RegistroFinanceiro>(LS_SAIDAS));
    setContasReceber(lerArrayLocalStorage<RegistroFinanceiro>(LS_CONTAS_RECEBER));
    setFolhaPagamento(lerArrayLocalStorage<RegistroFinanceiro>(LS_FOLHA));
    setInvestimentos(lerArrayLocalStorage<RegistroFinanceiro>(LS_INVESTIMENTOS));

    Promise.all([buscarFinanceiroSupabase(), buscarTaxasSupabase()])
      .then(([dados, taxas]) => {
        if (!ativo) return;
        setEntradas(dados.entradas || []);
        setVendasDetalhadas(dados.vendasDetalhadas || []);
        setSaidas(dados.saidas || []);
        setContasReceber(dados.contasReceber || []);
        setFolhaPagamento(dados.folhaPagamento || []);
        setInvestimentos(dados.investimentos || []);
        setTaxasMaquininhas(taxas.maquininhas || []);
        setTaxasDelivery(taxas.delivery || []);
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

  const receitas = useMemo(() => deduplicarReceitas(entradas, vendasDetalhadas), [entradas, vendasDetalhadas]);

  const resumo = useMemo(() => {
    const receitasMes = receitas.filter((item) => registroEstaNoMes(item));
    const receitaBrutaMes = receitasMes.reduce((acc, item) => acc + valorBrutoRegistro(item), 0);
    const receitaLiquidaMes = receitasMes.reduce((acc, item) => acc + valorLiquidoRegistroComCadastro(item, taxasMaquininhas, taxasDelivery), 0);
    const taxasMes = receitasMes.reduce((acc, item) => acc + taxaRegistroComCadastro(item, taxasMaquininhas, taxasDelivery), 0);
    const descontosMes = receitasMes.reduce((acc, item) => acc + descontoRegistro(item), 0);

    const saidasPagasMes = saidas
      .filter((item) => registroEstaNoMes(item) && estaPago(item))
      .reduce((acc, item) => acc + valorRegistro(item), 0);

    const folhaPagaMes = folhaPagamento
      .filter((item) => registroEstaNoMes(item) && estaPago(item))
      .reduce((acc, item) => acc + valorRegistro(item), 0);

    const investimentosPagosMes = investimentos
      .filter((item) => registroEstaNoMes(item) && estaPago(item))
      .reduce((acc, item) => acc + valorRegistro(item), 0);

    const contasAPagar = [...saidas.filter(estaAberto), ...folhaPagamento.filter(estaAberto)]
      .reduce((acc, item) => acc + valorRegistro(item), 0);

    const contasAReceber = contasReceber
      .filter(estaAberto)
      .reduce((acc, item) => acc + valorRegistro(item), 0);

    const investimentosPendentes = investimentos
      .filter(estaAberto)
      .reduce((acc, item) => acc + valorRegistro(item), 0);

    const resultadoOperacional = receitaLiquidaMes - saidasPagasMes - folhaPagaMes - investimentosPagosMes;
    const saldoPrevisto = resultadoOperacional + contasAReceber - contasAPagar - investimentosPendentes;

    return {
      receitaBrutaMes,
      receitaLiquidaMes,
      taxasMes,
      descontosMes,
      saidasPagasMes,
      folhaPagaMes,
      investimentosPagosMes,
      contasAPagar,
      contasAReceber,
      investimentosPendentes,
      resultadoOperacional,
      saldoPrevisto,
      totalLancamentos: receitas.length + saidas.length + contasReceber.length + folhaPagamento.length + investimentos.length,
    };
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos, taxasMaquininhas, taxasDelivery]);

  const margemLucro = useMemo(() => {
    if (resumo.receitaLiquidaMes <= 0) return 0;
    return (resumo.resultadoOperacional / resumo.receitaLiquidaMes) * 100;
  }, [resumo.receitaLiquidaMes, resumo.resultadoOperacional]);

  const rankingEntradas = useMemo(() => {
    const mapa = new Map<string, number>();
    receitas.filter((item) => registroEstaNoMes(item)).forEach((item) => {
      const categoria = String(item.categoria || "Sem categoria");
      mapa.set(categoria, (mapa.get(categoria) || 0) + valorLiquidoRegistroComCadastro(item, taxasMaquininhas, taxasDelivery));
    });
    return Array.from(mapa.entries()).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [receitas, taxasMaquininhas, taxasDelivery]);

  const rankingSaidas = useMemo(() => {
    const mapa = new Map<string, number>();
    saidas.filter((item) => registroEstaNoMes(item) && estaPago(item)).forEach((item) => {
      const categoria = String(item.categoria || "Sem categoria");
      mapa.set(categoria, (mapa.get(categoria) || 0) + valorRegistro(item));
    });
    return Array.from(mapa.entries()).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [saidas]);

  const lancamentosRecentes = useMemo<LancamentoRelatorio[]>(() => {
    const mapear = (lista: RegistroFinanceiro[], tipo: string, statusPadrao: string, negativo = false) =>
      lista.map((item, index) => ({
        id: `${tipo}-${item.id || index}`,
        data: dataDoRegistro(item),
        tipo,
        descricao: String(item.descricao || item.cliente || item.origem || item.nome || item.categoria || "-"),
        categoria: String(item.categoria || item.funcao || "-"),
        status: String(item.status || statusPadrao),
        valor: valorRegistro(item) * (negativo ? -1 : 1),
      }));

    return [
      ...mapear(receitas, "Entrada", "Recebido"),
      ...mapear(saidas, "Saída", "-", true),
      ...mapear(contasReceber, "Conta a receber", "Pendente"),
      ...mapear(folhaPagamento, "Folha", "Pendente", true),
      ...mapear(investimentos, "Investimento", "Planejado", true),
    ]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 12);
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos, taxasMaquininhas, taxasDelivery]);

  const diagnostico = useMemo(() => {
    if (resumo.receitaLiquidaMes <= 0) return "Ainda não há receita líquida no mês para diagnóstico.";
    if (resumo.resultadoOperacional < 0) return "Resultado negativo no mês: revise saídas pagas, folha e investimentos já pagos.";
    if (resumo.contasAReceber > resumo.receitaLiquidaMes * 0.5) return "Há valor alto em contas a receber. Confira cobranças pendentes.";
    if (resumo.contasAPagar > resumo.receitaLiquidaMes * 0.5) return "Há muitas contas em aberto em relação à receita líquida do mês.";
    return "Resultado positivo: continue acompanhando taxas, despesas pagas, folha e recebíveis.";
  }, [resumo]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="relatorios" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">Análise geral</p>
            <h1 className="text-3xl font-bold text-slate-950">Relatórios</h1>
            <p className="text-sm text-slate-600">Resumo consolidado do faturamento líquido real, contas, folha, investimentos e saldo previsto.</p>
            {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{erro}</p>}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card titulo="Receita bruta do mês" valor={resumo.receitaBrutaMes} detalhe="Antes de taxas e descontos." cor="text-slate-950" />
            <Card titulo="Receita líquida real" valor={resumo.receitaLiquidaMes} detalhe="Depois das taxas." cor="text-emerald-700" />
            <Card titulo="Taxas descontadas" valor={resumo.taxasMes} detalhe={`Descontos: ${formatarMoeda(resumo.descontosMes)}`} cor="text-red-600" />
            <Card titulo="Resultado operacional" valor={resumo.resultadoOperacional} detalhe="Líquido - pagos." cor={resumo.resultadoOperacional >= 0 ? "text-emerald-700" : "text-red-600"} />
            <Card titulo="Despesas pagas" valor={resumo.saidasPagasMes} detalhe="Saídas pagas no mês." cor="text-red-600" />
            <Card titulo="Folha paga" valor={resumo.folhaPagaMes} detalhe="Folha marcada como paga." cor="text-purple-700" />
            <Card titulo="Contas a receber" valor={resumo.contasAReceber} detalhe="Pendentes ou atrasadas." cor="text-blue-700" />
            <Card titulo="Contas a pagar" valor={resumo.contasAPagar} detalhe="Saídas e folha em aberto." cor="text-orange-600" />
            <Card titulo="Investimentos pagos" valor={resumo.investimentosPagosMes} detalhe="Pagos no mês." cor="text-indigo-700" />
            <Card titulo="Investimentos em aberto" valor={resumo.investimentosPendentes} detalhe="Pendentes ou planejados." cor="text-indigo-700" />
            <Card titulo="Saldo previsto" valor={resumo.saldoPrevisto} detalhe="Resultado + receber - pagar - investimentos." cor={resumo.saldoPrevisto >= 0 ? "text-emerald-700" : "text-red-600"} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Margem operacional</p>
              <strong className={`mt-2 block text-2xl ${margemLucro >= 0 ? "text-emerald-700" : "text-red-600"}`}>{margemLucro.toFixed(1)}%</strong>
              <p className="mt-2 text-xs text-slate-500">Sobre a receita líquida real.</p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-950">Diagnóstico rápido</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">{diagnostico}</p>
            <p className="mt-3 text-xs text-slate-500">Total de lançamentos no sistema: {resumo.totalLancamentos}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ResumoLista titulo="Maiores categorias de entrada" vazio="Nenhuma entrada cadastrada ainda.">
              {rankingEntradas.map((item) => (
                <div key={item.categoria} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{item.categoria}</span>
                  <strong className="text-sm text-emerald-700">{formatarMoeda(item.total)}</strong>
                </div>
              ))}
            </ResumoLista>

            <ResumoLista titulo="Maiores categorias de saída paga" vazio="Nenhuma saída paga cadastrada ainda.">
              {rankingSaidas.map((item) => (
                <div key={item.categoria} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{item.categoria}</span>
                  <strong className="text-sm text-red-600">{formatarMoeda(item.total)}</strong>
                </div>
              ))}
            </ResumoLista>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-950">Lançamentos recentes</h2>
            <p className="mt-1 text-sm text-slate-500">Últimos registros consolidados de todos os módulos.</p>

            {lancamentosRecentes.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum lançamento encontrado.</div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Data</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Descrição</th>
                      <th className="px-3 py-3">Categoria</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosRecentes.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 text-sm">
                        <td className="px-3 py-4 text-slate-700">{formatarData(item.data)}</td>
                        <td className="px-3 py-4 font-bold text-slate-700">{item.tipo}</td>
                        <td className="px-3 py-4 font-medium text-slate-950">{item.descricao}</td>
                        <td className="px-3 py-4 text-slate-700">{item.categoria}</td>
                        <td className="px-3 py-4 text-slate-700">{item.status}</td>
                        <td className={`px-3 py-4 text-right font-bold ${item.valor >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatarMoeda(Math.abs(item.valor))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatarData(data: string) {
  if (!data) return "-";
  return data.split("-").reverse().join("/");
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

function ResumoLista({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode }) {
  const temItens = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-5 text-xl font-bold text-slate-950">{titulo}</h2>
      {temItens ? <div className="space-y-3">{children}</div> : <p className="text-sm text-slate-500">{vazio}</p>}
    </div>
  );
}
