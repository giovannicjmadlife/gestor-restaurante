"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { useEffect, useMemo, useState } from "react";
import {
  Colaborador,
  LS_FOLHA,
  LS_SAIDAS,
  RegistroFinanceiro,
  buscarFinanceiroSupabase,
  dataDoRegistro,
  deduplicarPorId,
  formatarMoeda,
  lerArrayLocalStorage,
  numeroSeguro,
  salvarArrayLocalStorage,
  salvarFinanceiroSupabase,
} from "@/lib/financeiroSupabase";

type ContaPagarView = {
  id: string;
  origem: "saida" | "folha";
  data: string;
  categoria: string;
  descricao: string;
  formaPagamento: string;
  status: "Pendente" | "Vencido" | "Atrasado";
  valor: number;
  raw: RegistroFinanceiro;
};


function formatarData(data: string) {
  if (!data) return "-";
  return data.split("-").reverse().join("/");
}

function valorRegistro(item: RegistroFinanceiro) {
  return numeroSeguro(item.valor) || numeroSeguro(item.valorLiquido) || numeroSeguro(item.valorBruto);
}

function statusAberto(item: RegistroFinanceiro) {
  const status = String(item.status || "").toLowerCase();
  return status === "pendente" || status === "vencido" || status === "atrasado";
}


function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataPagamentoDoMes(competencia: string, diaPagamento: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Math.max(Math.trunc(diaPagamento || 5), 1), ultimoDia);
  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

function gerarFolhaMensal(colaboradores: Colaborador[], folhaAtual: RegistroFinanceiro[]) {
  const competencia = hojeISO().slice(0, 7);
  const idsAtuais = new Set(folhaAtual.map((item) => String(item.id)));
  const hoje = hojeISO();
  const novos = colaboradores
    .filter((colaborador) => colaborador.ativo !== false && numeroSeguro(colaborador.salarioMensal) > 0)
    .map((colaborador) => {
      const diaPagamento = numeroSeguro(colaborador.diaPagamento) || 5;
      const data = dataPagamentoDoMes(competencia, diaPagamento);
      const id = `folha-colaborador-${colaborador.id}-${competencia}`;

      return {
        id,
        data,
        nome: colaborador.nome,
        funcao: colaborador.funcao || "Outros",
        tipoPagamento: "Salário fixo",
        descricao: `Salário mensal automático de ${competencia.split("-").reverse().join("/")}`,
        status: data < hoje ? "Atrasado" : "Pendente",
        valor: numeroSeguro(colaborador.salarioMensal),
        colaboradorId: colaborador.id,
        competencia,
        diaPagamento,
        origem: "Colaboradores",
      };
    })
    .filter((item) => !idsAtuais.has(item.id));

  return {
    todos: deduplicarPorId([...novos, ...folhaAtual]),
    novos,
  };
}


export default function ContasAPagarPage() {
  const [saidas, setSaidas] = useState<RegistroFinanceiro[]>([]);
  const [folha, setFolha] = useState<RegistroFinanceiro[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    setSaidas(lerArrayLocalStorage<RegistroFinanceiro>(LS_SAIDAS));
    setFolha(lerArrayLocalStorage<RegistroFinanceiro>(LS_FOLHA));

    buscarFinanceiroSupabase()
      .then(async (dados) => {
        if (!ativo) return;
        const saidasSupabase = dados.saidas || [];
        const folhaBase = dados.folhaPagamento || [];
        const { todos: folhaComMensal, novos } = gerarFolhaMensal((dados.colaboradores || []) as Colaborador[], folhaBase);

        setSaidas(saidasSupabase);
        setFolha(folhaComMensal);
        salvarArrayLocalStorage(LS_SAIDAS, saidasSupabase);
        salvarArrayLocalStorage(LS_FOLHA, folhaComMensal);
        setErro("");

        if (novos.length > 0) {
          await salvarFinanceiroSupabase({ folhaPagamento: novos }).catch((error) => {
            console.error("Não foi possível criar folha mensal automática.", error);
            setErro("Folha mensal criada localmente, mas não sincronizou com o Supabase.");
          });
        }
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Não consegui carregar o Supabase. Mostrando cache local.");
      });

    return () => {
      ativo = false;
    };
  }, []);

  const contas = useMemo<ContaPagarView[]>(() => {
    const listaSaidas = saidas.filter(statusAberto).map((saida) => ({
      id: String(saida.id),
      origem: "saida" as const,
      data: dataDoRegistro(saida),
      categoria: String(saida.categoria || "Saída"),
      descricao: String(saida.descricao || "Saída cadastrada"),
      formaPagamento: String(saida.formaPagamento || saida.forma || "-"),
      status: String(saida.status || "Pendente") as ContaPagarView["status"],
      valor: valorRegistro(saida),
      raw: saida,
    }));

    const listaFolha = folha.filter(statusAberto).map((item) => ({
      id: String(item.id),
      origem: "folha" as const,
      data: dataDoRegistro(item),
      categoria: "Folha de pagamento",
      descricao: String(item.nome || item.descricao || "Pagamento da folha"),
      formaPagamento: String(item.tipoPagamento || "Folha"),
      status: String(item.status || "Pendente") as ContaPagarView["status"],
      valor: valorRegistro(item),
      raw: item,
    }));

    return [...listaSaidas, ...listaFolha].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [saidas, folha]);

  const resumo = useMemo(() => {
    const totalPendente = contas.filter((conta) => conta.status === "Pendente").reduce((soma, conta) => soma + conta.valor, 0);
    const totalVencido = contas.filter((conta) => conta.status === "Vencido" || conta.status === "Atrasado").reduce((soma, conta) => soma + conta.valor, 0);
    const totalGeral = contas.reduce((soma, conta) => soma + conta.valor, 0);
    return { totalPendente, totalVencido, totalGeral, quantidade: contas.length };
  }, [contas]);

  const resumoPorCategoria = useMemo(() => {
    const totais = contas.reduce<Record<string, number>>((acc, conta) => {
      acc[conta.categoria] = (acc[conta.categoria] || 0) + conta.valor;
      return acc;
    }, {});
    return Object.entries(totais).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
  }, [contas]);

  async function marcarComoPago(conta: ContaPagarView) {
    const confirmar = window.confirm("Deseja marcar esta conta como paga? O valor sairá do saldo real.");
    if (!confirmar) return;

    const atualizado = {
      ...conta.raw,
      status: "Pago",
      dataPagamento: new Date().toISOString().slice(0, 10),
      pagoEm: new Date().toISOString(),
    };

    if (conta.origem === "saida") {
      const novasSaidas = saidas.map((saida) => String(saida.id) === conta.id ? atualizado : saida);
      setSaidas(novasSaidas);
      salvarArrayLocalStorage(LS_SAIDAS, novasSaidas);
      await salvarFinanceiroSupabase({ saida: atualizado }).catch((error) => {
        console.error("Não foi possível sincronizar saída paga.", error);
        setErro("Marcado localmente, mas não sincronizou com o Supabase.");
      });
      return;
    }

    const novaFolha = folha.map((item) => String(item.id) === conta.id ? atualizado : item);
    setFolha(novaFolha);
    salvarArrayLocalStorage(LS_FOLHA, novaFolha);
    await salvarFinanceiroSupabase({ folha: atualizado }).catch((error) => {
      console.error("Não foi possível sincronizar folha paga.", error);
      setErro("Marcado localmente, mas não sincronizou com o Supabase.");
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <AdminSidebar active="contas-a-pagar" />

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.35em] text-orange-600">Financeiro</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Contas a pagar</h2>
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Saídas e folha pendentes/vencidas. Ao marcar como paga, o lançamento passa a sair do saldo líquido real.
                </p>
                {erro && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{erro}</p>}
              </div>

              <a href="/saidas" className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">Nova saída</a>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card titulo="Total a pagar" valor={resumo.totalGeral} detalhe="Pendentes + vencidas" cor="text-red-700" />
            <Card titulo="Pendentes" valor={resumo.totalPendente} detalhe="Aguardando pagamento" cor="text-amber-700" />
            <Card titulo="Vencidas/atrasadas" valor={resumo.totalVencido} detalhe="Precisam de atenção" cor="text-red-700" />
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">Quantidade</p>
              <strong className="mt-3 block text-2xl font-black">{resumo.quantidade}</strong>
              <p className="mt-2 text-xs text-slate-500">Contas em aberto</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Lista de contas</h3>
                <p className="mt-1 text-sm text-slate-500">Saídas e folha de pagamento em aberto.</p>
              </div>

              {contas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm font-bold text-slate-700">Nenhuma conta a pagar.</p>
                  <p className="mt-1 text-sm text-slate-500">Cadastre uma saída/folha com status Pendente, Vencido ou Atrasado.</p>
                  <a href="/saidas" className="mt-5 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-600">Cadastrar saída</a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="px-4 py-3 font-bold">Data</th>
                        <th className="px-4 py-3 font-bold">Origem</th>
                        <th className="px-4 py-3 font-bold">Categoria</th>
                        <th className="px-4 py-3 font-bold">Descrição</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 text-right font-bold">Valor</th>
                        <th className="px-4 py-3 text-right font-bold">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contas.map((conta) => (
                        <tr key={`${conta.origem}-${conta.id}`} className="border-b border-slate-100 transition hover:bg-slate-50">
                          <td className="px-4 py-4 font-medium">{formatarData(conta.data)}</td>
                          <td className="px-4 py-4">{conta.origem === "folha" ? "Folha" : "Saída"}</td>
                          <td className="px-4 py-4">{conta.categoria}</td>
                          <td className="px-4 py-4">{conta.descricao}</td>
                          <td className="px-4 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${conta.status === "Pendente" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{conta.status}</span>
                          </td>
                          <td className="px-4 py-4 text-right font-black text-red-700">{formatarMoeda(conta.valor)}</td>
                          <td className="px-4 py-4 text-right">
                            <button type="button" onClick={() => marcarComoPago(conta)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100">Marcar pago</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h3 className="text-xl font-black">Resumo por categoria</h3>
                <p className="mt-1 text-sm text-slate-500">Onde estão as contas em aberto.</p>
              </div>
              {resumoPorCategoria.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma categoria com conta em aberto.</div>
              ) : (
                <div className="grid gap-4">
                  {resumoPorCategoria.map((item) => {
                    const percentual = resumo.totalGeral > 0 ? (item.total / resumo.totalGeral) * 100 : 0;
                    return (
                      <div key={item.categoria}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-bold">{item.categoria}</span>
                          <span className="text-sm text-slate-600">{formatarMoeda(item.total)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${percentual}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ titulo, valor, detalhe, cor }: { titulo: string; valor: number; detalhe: string; cor: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <strong className={`mt-3 block text-2xl font-black ${cor}`}>{formatarMoeda(valor)}</strong>
      <p className="mt-2 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}
