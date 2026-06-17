"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Colaborador,
  LS_COLABORADORES,
  buscarColaboradoresSupabase,
  deduplicarPorId,
  formatarMoeda,
  lerArrayLocalStorage,
  numeroSeguro,
  salvarArrayLocalStorage,
  salvarColaboradoresSupabase,
} from "@/lib/financeiroSupabase";

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const linkBase =
  "block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white";
const linkAtivo = "block rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white";
const linkPdv =
  "block rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700";

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroSincronizacao, setErroSincronizacao] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarColaboradores() {
      setCarregando(true);
      setErroSincronizacao("");

      const colaboradoresLocais = lerArrayLocalStorage<Colaborador>(LS_COLABORADORES);

      if (ativo) {
        setColaboradores(colaboradoresLocais);
      }

      try {
        const colaboradoresSupabase = await buscarColaboradoresSupabase();
        const listaUnificada = deduplicarPorId([
          ...(colaboradoresSupabase || []),
          ...colaboradoresLocais,
        ]) as Colaborador[];

        if (!ativo) return;

        setColaboradores(listaUnificada);
        salvarArrayLocalStorage(LS_COLABORADORES, listaUnificada);
      } catch (erro) {
        if (!ativo) return;
        setErroSincronizacao(
          erro instanceof Error
            ? erro.message
            : "Não foi possível carregar colaboradores do Supabase. Usando cache local."
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarColaboradores();

    return () => {
      ativo = false;
    };
  }, []);

  async function salvarLista(novaLista: Colaborador[]) {
    setColaboradores(novaLista);
    salvarArrayLocalStorage(LS_COLABORADORES, novaLista);
    setErroSincronizacao("");
    setSalvando(true);

    try {
      await salvarColaboradoresSupabase(novaLista);
    } catch (erro) {
      setErroSincronizacao(
        erro instanceof Error
          ? erro.message
          : "Os colaboradores foram salvos no cache local, mas não sincronizaram com o Supabase."
      );
      throw erro;
    } finally {
      setSalvando(false);
    }
  }

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setPercentualComissao("");
    setTelefone("");
    setObservacoes("");
  }

  async function salvarColaborador(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nomeTratado = nome.trim();
    const percentual = numeroSeguro(percentualComissao);

    if (!nomeTratado) {
      alert("Informe o nome do colaborador.");
      return;
    }

    if (percentual < 0 || percentual > 100) {
      alert("Informe uma comissão entre 0% e 100%.");
      return;
    }

    const agora = new Date().toISOString();

    try {
      if (editandoId) {
        const atualizados = colaboradores.map((colaborador) => {
          if (colaborador.id !== editandoId) return colaborador;

          return {
            ...colaborador,
            nome: nomeTratado,
            percentualComissao: percentual,
            telefone: telefone.trim(),
            observacoes: observacoes.trim(),
            atualizadoEm: agora,
          };
        });

        await salvarLista(atualizados);
        limparFormulario();
        alert("Colaborador atualizado com sucesso.");
        return;
      }

      const novo: Colaborador = {
        id: uid(),
        nome: nomeTratado,
        percentualComissao: percentual,
        telefone: telefone.trim(),
        observacoes: observacoes.trim(),
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora,
      };

      await salvarLista([novo, ...colaboradores]);
      limparFormulario();
      alert("Colaborador cadastrado com sucesso.");
    } catch {
      alert(
        "Não consegui salvar no Supabase agora. Confira se a API /api/colaboradores e o SQL do Supabase foram aplicados."
      );
    }
  }

  function editarColaborador(colaborador: Colaborador) {
    setEditandoId(colaborador.id);
    setNome(colaborador.nome);
    setPercentualComissao(String(colaborador.percentualComissao ?? 0));
    setTelefone(colaborador.telefone || "");
    setObservacoes(colaborador.observacoes || "");
  }

  async function alternarStatus(id: string) {
    const atualizados = colaboradores.map((colaborador) => {
      if (colaborador.id !== id) return colaborador;

      return {
        ...colaborador,
        ativo: colaborador.ativo === false,
        atualizadoEm: new Date().toISOString(),
      };
    });

    try {
      await salvarLista(atualizados);
    } catch {
      alert("Não consegui sincronizar a alteração com o Supabase.");
    }
  }

  async function removerColaborador(id: string) {
    const confirmar = confirm(
      "Deseja remover este colaborador? As vendas antigas continuarão registradas com o nome dele."
    );

    if (!confirmar) return;

    try {
      await salvarLista(colaboradores.filter((colaborador) => colaborador.id !== id));
    } catch {
      alert("Não consegui remover no Supabase agora.");
    }
  }

  const resumo = useMemo(() => {
    const ativos = colaboradores.filter((colaborador) => colaborador.ativo !== false).length;
    const inativos = colaboradores.length - ativos;
    const mediaComissao =
      colaboradores.length > 0
        ? colaboradores.reduce(
            (total, colaborador) => total + numeroSeguro(colaborador.percentualComissao),
            0
          ) / colaboradores.length
        : 0;

    return { ativos, inativos, mediaComissao };
  }, [colaboradores]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 shrink-0 bg-slate-950 text-white">
          <div className="border-b border-white/10 px-6 py-6">
            <img
              src="/logo-01.png"
              alt="Samambaia Restaurante e Pizzaria"
              className="max-h-20 w-auto"
            />
          </div>

          <nav className="space-y-2 px-4 py-6">
            <a href="/" className={linkBase}>
              Dashboard
            </a>

            <a href="/pdv" className={linkPdv}>
              Acessar PDV
            </a>

            <a href="/entradas" className={linkBase}>
              Entradas
            </a>

            <a href="/saidas" className={linkBase}>
              Saídas
            </a>

            <a href="/contas-a-pagar" className={linkBase}>
              Contas a pagar
            </a>

            <a href="/contas-a-receber" className={linkBase}>
              Contas a receber
            </a>

            <a href="/folha-de-pagamento" className={linkBase}>
              Folha de pagamento
            </a>

            <a href="/colaboradores" className={linkAtivo}>
              Colaboradores
            </a>

            <a href="/investimentos" className={linkBase}>
              Investimentos
            </a>

            <a href="/relatorios" className={linkBase}>
              Relatórios
            </a>

            <a href="/configuracoes" className={linkBase}>
              Configurações
            </a>
          </nav>
        </aside>

        <section className="flex-1 px-8 py-8">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Cadastros
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Colaboradores</h1>
            <p className="mt-2 text-sm text-slate-600">
              Cadastre vendedores/atendentes e o percentual de comissão para o dashboard calcular o valor a pagar no fim do mês.
            </p>
          </div>

          {erroSincronizacao && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {erroSincronizacao}
            </div>
          )}

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Ativos</p>
              <strong className="mt-2 block text-2xl text-emerald-700">{resumo.ativos}</strong>
              <p className="mt-2 text-xs text-slate-500">Aparecem na finalização da venda.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Inativos</p>
              <strong className="mt-2 block text-2xl text-red-600">{resumo.inativos}</strong>
              <p className="mt-2 text-xs text-slate-500">Não aparecem no PDV.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Comissão média</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumo.mediaComissao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                {carregando ? "Carregando Supabase..." : "Referência geral do cadastro."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_1fr]">
            <form onSubmit={salvarColaborador} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-bold text-slate-950">
                {editandoId ? "Editar colaborador" : "Novo colaborador"}
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700">Nome</label>
                  <input
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Ex: Matheus"
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700">Percentual de comissão</label>
                  <input
                    value={percentualComissao}
                    onChange={(event) => setPercentualComissao(event.target.value)}
                    placeholder="Ex: 5"
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-orange-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Exemplo: se vender {formatarMoeda(600)} e a comissão for 5%, o dashboard mostrará {formatarMoeda(30)} a pagar.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700">Telefone opcional</label>
                  <input
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder="Ex: (00) 00000-0000"
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700">Observações</label>
                  <textarea
                    value={observacoes}
                    onChange={(event) => setObservacoes(event.target.value)}
                    placeholder="Observações internas"
                    className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? "Salvando..." : editandoId ? "Salvar edição" : "Cadastrar"}
                </button>

                {editandoId && (
                  <button
                    type="button"
                    onClick={limparFormulario}
                    className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-bold text-slate-950">Lista de colaboradores</h2>

              {colaboradores.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  {carregando ? "Carregando colaboradores..." : "Nenhum colaborador cadastrado ainda."}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {colaboradores.map((colaborador) => (
                    <div key={colaborador.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-950">{colaborador.nome}</h3>
                          <p className="text-sm text-slate-500">
                            Comissão: {numeroSeguro(colaborador.percentualComissao).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                            {colaborador.telefone ? ` · ${colaborador.telefone}` : ""}
                          </p>
                          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${colaborador.ativo === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {colaborador.ativo === false ? "Inativo" : "Ativo"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editarColaborador(colaborador)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarStatus(colaborador.id)}
                            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            {colaborador.ativo === false ? "Ativar" : "Desativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removerColaborador(colaborador.id)}
                            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Remover
                          </button>
                        </div>
                      </div>

                      {colaborador.observacoes && (
                        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {colaborador.observacoes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
