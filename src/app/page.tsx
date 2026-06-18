"use client";

import AdminSidebar from "@/components/AdminSidebar";
import type { ReactNode } from "react";
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
  formaResumoRegistro,
  formatarMoeda,
  itensDoRegistro,
  lerArrayLocalStorage,
  numeroSeguro,
  pagamentosDoRegistro,
  registroEstaNoDia,
  registroEstaNoMes,
  taxaRegistroComCadastro,
  valorBrutoRegistro,
  valorLiquidoRegistroComCadastro,
} from "@/lib/financeiroSupabase";

function statusNormalizado(item: RegistroFinanceiro) {
  return String(item.status || "").trim().toLowerCase();
}

function estaPago(item: RegistroFinanceiro) {
  return statusNormalizado(item) === "pago" || statusNormalizado(item) === "recebido";
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

  entradas.forEach((item, index) => {
    mapa.set(String(item.id || `entrada-${index}`), item);
  });

  vendasDetalhadas.forEach((item, index) => {
    const id = String(item.id || `venda-${index}`);
    if (!mapa.has(id)) mapa.set(id, item);
  });

  return Array.from(mapa.values());
}

export default function DashboardPage() {
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
    const receitasHoje = receitas.filter((item) => registroEstaNoDia(item));
    const receitasMes = receitas.filter((item) => registroEstaNoMes(item));

    const faturamentoHoje = receitasHoje.reduce((acc, item) => acc + valorBrutoRegistro(item), 0);
    const liquidoHoje = receitasHoje.reduce(
      (acc, item) => acc + valorLiquidoRegistroComCadastro(item, taxasMaquininhas, taxasDelivery),
      0
    );
    const taxasHoje = receitasHoje.reduce(
      (acc, item) => acc + taxaRegistroComCadastro(item, taxasMaquininhas, taxasDelivery),
      0
    );
    const descontosHoje = receitasHoje.reduce((acc, item) => acc + descontoRegistro(item), 0);

    const faturamentoMes = receitasMes.reduce((acc, item) => acc + valorBrutoRegistro(item), 0);
    const liquidoMes = receitasMes.reduce(
      (acc, item) => acc + valorLiquidoRegistroComCadastro(item, taxasMaquininhas, taxasDelivery),
      0
    );
    const taxasMes = receitasMes.reduce(
      (acc, item) => acc + taxaRegistroComCadastro(item, taxasMaquininhas, taxasDelivery),
      0
    );
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

    const contasAPagar = [...saidas.filter(estaAberto), ...folhaPagamento.filter(estaAberto)].reduce(
      (acc, item) => acc + valorRegistro(item),
      0
    );

    const contasAReceber = contasReceber.filter(estaAberto).reduce((acc, item) => acc + valorRegistro(item), 0);

    const investimentosPendentes = investimentos.filter(estaAberto).reduce((acc, item) => acc + valorRegistro(item), 0);

    const saldoReal = liquidoMes - saidasPagasMes - folhaPagaMes - investimentosPagosMes;
    const saldoPrevisto = saldoReal + contasAReceber - contasAPagar - investimentosPendentes;

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
      contasAPagar,
      contasAReceber,
      investimentosPendentes,
      saldoReal,
      saldoPrevisto,
      totalLancamentos:
        receitas.length + saidas.length + contasReceber.length + folhaPagamento.length + investimentos.length,
    };
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos, taxasMaquininhas, taxasDelivery]);

  const formasPagamentoMes = useMemo(() => {
    const agrupado = new Map<string, { forma: string; quantidade: number; faturamento: number; liquido: number }>();

    receitas
      .filter((item) => registroEstaNoMes(item))
      .forEach((item) => {
        const pagamentos = pagamentosDoRegistro(item);

        if (pagamentos.length === 0) {
          const forma = formaResumoRegistro(item);
          const atual = agrupado.get(forma) || { forma, quantidade: 0, faturamento: 0, liquido: 0 };

          atual.quantidade += 1;
          atual.faturamento += valorBrutoRegistro(item);
          atual.liquido += valorLiquidoRegistroComCadastro(item, taxasMaquininhas, taxasDelivery);

          agrupado.set(forma, atual);
          return;
        }

        pagamentos.forEach((pagamento) => {
          const forma = String(pagamento.forma || "Não informado");
          const atual = agrupado.get(forma) || { forma, quantidade: 0, faturamento: 0, liquido: 0 };

          const valorPago = numeroSeguro(pagamento.valorPago);
          const valorLiquidoPagamento = numeroSeguro(pagamento.valorLiquido) || valorPago;

          atual.quantidade += 1;
          atual.faturamento += valorPago;
          atual.liquido += valorLiquidoPagamento;

          agrupado.set(forma, atual);
        });
      });

    const lista = Array.from(agrupado.values()).sort((a, b) => b.faturamento - a.faturamento);
    const maiorValor = lista[0]?.faturamento || 0;

    return lista.map((item) => ({
      ...item,
      percentual: maiorValor > 0 ? Math.max((item.faturamento / maiorValor) * 100, 4) : 0,
    }));
  }, [receitas, taxasMaquininhas, taxasDelivery]);

  const produtosMaisVendidos = useMemo(() => {
    const mapa = new Map<string, { nome: string; quantidade: number; total: number }>();

    vendasDetalhadas
      .filter((venda) => registroEstaNoMes(venda))
      .forEach((venda) => {
        itensDoRegistro(venda).forEach((item) => {
          const atual = mapa.get(item.nome) || { nome: item.nome, quantidade: 0, total: 0 };

          atual.quantidade += numeroSeguro(item.quantidade);
          atual.total += numeroSeguro(item.total);

          mapa.set(item.nome, atual);
        });
      });

    return Array.from(mapa.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [vendasDetalhadas]);

  const comissoes = useMemo(() => {
    const mapa = new Map<string, { nome: string; vendas: number; comissao: number }>();

    vendasDetalhadas
      .filter((venda) => registroEstaNoMes(venda))
      .forEach((venda) => {
        const nome = String(venda.colaboradorNome || "").trim();
        const percentual = numeroSeguro(venda.colaboradorPercentual);

        if (!nome || percentual <= 0) return;

        const atual = mapa.get(nome) || { nome, vendas: 0, comissao: 0 };

        const liquidoVenda = valorLiquidoRegistroComCadastro(venda, taxasMaquininhas, taxasDelivery);

        atual.vendas += liquidoVenda;
        atual.comissao += (liquidoVenda * percentual) / 100;

        mapa.set(nome, atual);
      });

    return Array.from(mapa.values())
      .sort((a, b) => b.comissao - a.comissao)
      .slice(0, 6);
  }, [vendasDetalhadas, taxasMaquininhas, taxasDelivery]);

  const ultimosLancamentos = useMemo(() => {
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
    ]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 8);
  }, [receitas, saidas, contasReceber, folhaPagamento, investimentos]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="dashboard" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">Visão geral</p>
            <h1 className="text-3xl font-bold text-slate-950">Dashboard financeiro</h1>
            <p className="text-sm text-slate-600">
              Faturamento bruto, líquido real, taxas, contas, folha, investimentos e saldo atualizado pelo Supabase.
            </p>

            {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{erro}</p>}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card
              titulo="Faturado hoje"
              valor={resumo.faturamentoHoje}
              detalhe={`Líquido: ${formatarMoeda(resumo.liquidoHoje)}`}
              cor="text-emerald-700"
            />
            <Card
              titulo="Taxas hoje"
              valor={resumo.taxasHoje}
              detalhe={`Descontos: ${formatarMoeda(resumo.descontosHoje)}`}
              cor="text-red-600"
            />
            <Card
              titulo="Faturamento do mês"
              valor={resumo.faturamentoMes}
              detalhe="Bruto antes das taxas."
              cor="text-slate-950"
            />
            <Card
              titulo="Líquido real do mês"
              valor={resumo.liquidoMes}
              detalhe={`Taxas: ${formatarMoeda(resumo.taxasMes)}`}
              cor="text-emerald-700"
            />
            <Card
              titulo="Saídas pagas no mês"
              valor={resumo.saidasPagasMes}
              detalhe="Somente contas já pagas."
              cor="text-red-600"
            />
            <Card
              titulo="Folha paga no mês"
              valor={resumo.folhaPagaMes}
              detalhe="Pagamentos marcados como pagos."
              cor="text-purple-700"
            />
            <Card
              titulo="Contas a receber"
              valor={resumo.contasAReceber}
              detalhe="Pendentes ou atrasadas."
              cor="text-blue-700"
            />
            <Card
              titulo="Contas a pagar"
              valor={resumo.contasAPagar}
              detalhe="Saídas e folha em aberto."
              cor="text-orange-600"
            />
            <Card
              titulo="Investimentos pagos"
              valor={resumo.investimentosPagosMes}
              detalhe="Pagos no mês atual."
              cor="text-indigo-700"
            />
            <Card
              titulo="Investimentos em aberto"
              valor={resumo.investimentosPendentes}
              detalhe="Pendentes ou planejados."
              cor="text-indigo-700"
            />
            <Card
              titulo="Saldo real do mês"
              valor={resumo.saldoReal}
              detalhe="Líquido - saídas/folha/investimentos pagos."
              cor={resumo.saldoReal >= 0 ? "text-emerald-700" : "text-red-600"}
            />
            <Card
              titulo="Saldo previsto"
              valor={resumo.saldoPrevisto}
              detalhe="Saldo real + receber - pagar - investimentos."
              cor={resumo.saldoPrevisto >= 0 ? "text-emerald-700" : "text-red-600"}
            />
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Formas de pagamento no mês</h2>
                <p className="text-sm text-slate-500">Usa pagamentos divididos, taxas e valor líquido real.</p>
              </div>

              <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                Lançamentos: {resumo.totalLancamentos}
              </div>
            </div>

            {formasPagamentoMes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhuma venda no mês para gerar o gráfico.
              </div>
            ) : (
              <div className="space-y-4">
                {formasPagamentoMes.map((item) => (
                  <div key={item.forma}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-slate-950">{item.forma}</span>
                      <span className="font-semibold text-slate-600">
                        {item.quantidade} registro(s) · {formatarMoeda(item.faturamento)} bruto ·{" "}
                        {formatarMoeda(item.liquido)} líquido
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
            <ResumoLista titulo="Produtos mais vendidos" vazio="Nenhum item vendido no mês.">
              {produtosMaisVendidos.map((item) => (
                <div
                  key={item.nome}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {item.nome} · {item.quantidade.toLocaleString("pt-BR")} un/kg
                  </span>
                  <strong className="text-sm text-emerald-700">{formatarMoeda(item.total)}</strong>
                </div>
              ))}
            </ResumoLista>

            <ResumoLista titulo="Comissões por colaborador" vazio="Nenhuma comissão no mês.">
              {comissoes.map((item) => (
                <div
                  key={item.nome}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {item.nome} · vendas {formatarMoeda(item.vendas)}
                  </span>
                  <strong className="text-sm text-purple-700">{formatarMoeda(item.comissao)}</strong>
                </div>
              ))}
            </ResumoLista>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-950">Últimos lançamentos</h2>
            <p className="mt-1 text-sm text-slate-500">Entradas, saídas, contas, folha e investimentos.</p>

            {ultimosLancamentos.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Nenhum lançamento encontrado.
              </div>
            ) : (
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
                    {ultimosLancamentos.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 text-sm">
                        <td className="px-3 py-4 text-slate-700">{item.data.split("-").reverse().join("/")}</td>
                        <td className="px-3 py-4 font-bold text-slate-700">{item.tipo}</td>
                        <td className="px-3 py-4 font-medium text-slate-950">{item.descricao}</td>
                        <td className="px-3 py-4 text-slate-700">{item.categoria}</td>
                        <td
                          className={`px-3 py-4 text-right font-bold ${
                            item.valor >= 0 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatarMoeda(Math.abs(item.valor))}
                        </td>
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

function Card({ titulo, valor, detalhe, cor }: { titulo: string; valor: number; detalhe: string; cor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{titulo}</p>
      <strong className={`mt-2 block text-2xl ${cor}`}>{formatarMoeda(valor)}</strong>
      <p className="mt-2 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}

function ResumoLista({ titulo, vazio, children }: { titulo: string; vazio: string; children: ReactNode }) {
  const temItens = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-5 text-xl font-bold text-slate-950">{titulo}</h2>
      {temItens ? <div className="space-y-3">{children}</div> : <p className="text-sm text-slate-500">{vazio}</p>}
    </div>
  );
}