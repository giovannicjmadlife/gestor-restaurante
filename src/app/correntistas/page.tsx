"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type StatusCorrentista = "Ativo" | "Inativo";

type Correntista = {
  id: string;
  nome: string;
  telefone: string;
  documento: string;
  limiteCredito: number;
  saldoAberto: number;
  status: StatusCorrentista;
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
};

const STORAGE_KEY = "gestor-restaurante-correntistas";

const menuItems = [
  { label: "Dashboard", href: "/" },
  { label: "Acessar PDV", href: "/pdv", destaque: true },
  { label: "Entradas", href: "/entradas" },
  { label: "Saídas", href: "/saidas" },
  { label: "Contas a pagar", href: "/contas-a-pagar" },
  { label: "Contas a receber", href: "/contas-a-receber" },
  { label: "Folha de pagamento", href: "/folha-de-pagamento" },
  { label: "Investimentos", href: "/investimentos" },
  { label: "Relatórios", href: "/relatorios" },
  { label: "Configurações", href: "/configuracoes" },
];

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(dataISO: string) {
  if (!dataISO) {
    return "-";
  }

  return new Date(dataISO).toLocaleString("pt-BR");
}

function converterValor(valor: string) {
  const normalizado = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(normalizado);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function lerCorrentistasStorage(): Correntista[] {
  if (typeof window === "undefined") {
    return [];
  }

  const dados = localStorage.getItem(STORAGE_KEY);

  if (!dados) {
    return [];
  }

  try {
    const correntistas = JSON.parse(dados) as Partial<Correntista>[];

    if (!Array.isArray(correntistas)) {
      return [];
    }

    return correntistas.map((item) => {
      const statusCorrigido: StatusCorrentista =
        item.status === "Inativo" ? "Inativo" : "Ativo";

      return {
        id: item.id || criarId(),
        nome: item.nome || "",
        telefone: item.telefone || "",
        documento: item.documento || "",
        limiteCredito: Number(item.limiteCredito || 0),
        saldoAberto: Number(item.saldoAberto || 0),
        status: statusCorrigido,
        observacoes: item.observacoes || "",
        criadoEm: item.criadoEm || new Date().toISOString(),
        atualizadoEm: item.atualizadoEm || new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

export default function CorrentistasPage() {
  const [correntistas, setCorrentistas] = useState<Correntista[]>([]);
  const [carregouStorage, setCarregouStorage] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [documento, setDocumento] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");
  const [saldoAberto, setSaldoAberto] = useState("");
  const [status, setStatus] = useState<StatusCorrentista>("Ativo");
  const [observacoes, setObservacoes] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<
    StatusCorrentista | "Todos"
  >("Todos");

  useEffect(() => {
    const dadosSalvos = lerCorrentistasStorage();
    setCorrentistas(dadosSalvos);
    setCarregouStorage(true);
  }, []);

  useEffect(() => {
    if (!carregouStorage) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(correntistas));
  }, [correntistas, carregouStorage]);

  const correntistasFiltrados = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();

    return correntistas.filter((item) => {
      const passaStatus =
        filtroStatus === "Todos" || item.status === filtroStatus;

      const passaBusca =
        textoBusca.length === 0 ||
        item.nome.toLowerCase().includes(textoBusca) ||
        item.telefone.toLowerCase().includes(textoBusca) ||
        item.documento.toLowerCase().includes(textoBusca);

      return passaStatus && passaBusca;
    });
  }, [correntistas, busca, filtroStatus]);

  const resumo = useMemo(() => {
    const total = correntistas.length;
    const ativos = correntistas.filter((item) => item.status === "Ativo")
      .length;
    const inativos = correntistas.filter((item) => item.status === "Inativo")
      .length;

    const limiteTotal = correntistas.reduce(
      (soma, item) => soma + item.limiteCredito,
      0
    );

    const saldoAbertoTotal = correntistas.reduce(
      (soma, item) => soma + item.saldoAberto,
      0
    );

    return {
      total,
      ativos,
      inativos,
      limiteTotal,
      saldoAbertoTotal,
    };
  }, [correntistas]);

  function limparFormulario() {
    setNome("");
    setTelefone("");
    setDocumento("");
    setLimiteCredito("");
    setSaldoAberto("");
    setStatus("Ativo");
    setObservacoes("");
    setEditandoId(null);
  }

  function salvarCorrentista(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nome.trim()) {
      alert("Informe o nome do correntista.");
      return;
    }

    const agora = new Date().toISOString();
    const limiteNumerico = converterValor(limiteCredito);
    const saldoNumerico = converterValor(saldoAberto);

    if (editandoId) {
      const listaAtualizada: Correntista[] = correntistas.map((item) => {
        if (item.id !== editandoId) {
          return item;
        }

        return {
          ...item,
          nome: nome.trim(),
          telefone: telefone.trim(),
          documento: documento.trim(),
          limiteCredito: limiteNumerico,
          saldoAberto: saldoNumerico,
          status,
          observacoes: observacoes.trim(),
          atualizadoEm: agora,
        };
      });

      setCorrentistas(listaAtualizada);
      limparFormulario();
      return;
    }

    const novoCorrentista: Correntista = {
      id: criarId(),
      nome: nome.trim(),
      telefone: telefone.trim(),
      documento: documento.trim(),
      limiteCredito: limiteNumerico,
      saldoAberto: saldoNumerico,
      status,
      observacoes: observacoes.trim(),
      criadoEm: agora,
      atualizadoEm: agora,
    };

    setCorrentistas((listaAtual) => [novoCorrentista, ...listaAtual]);
    limparFormulario();
  }

  function editarCorrentista(correntista: Correntista) {
    setEditandoId(correntista.id);
    setNome(correntista.nome);
    setTelefone(correntista.telefone);
    setDocumento(correntista.documento);
    setLimiteCredito(String(correntista.limiteCredito).replace(".", ","));
    setSaldoAberto(String(correntista.saldoAberto).replace(".", ","));
    setStatus(correntista.status);
    setObservacoes(correntista.observacoes);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluirCorrentista(id: string) {
    const confirmar = confirm("Deseja realmente excluir este correntista?");

    if (!confirmar) {
      return;
    }

    setCorrentistas((listaAtual) =>
      listaAtual.filter((item) => item.id !== id)
    );

    if (editandoId === id) {
      limparFormulario();
    }
  }

  function alternarStatusCorrentista(id: string) {
    const agora = new Date().toISOString();

    const listaAtualizada: Correntista[] = correntistas.map((item) => {
      if (item.id !== id) {
        return item;
      }

      const novoStatus: StatusCorrentista =
        item.status === "Ativo" ? "Inativo" : "Ativo";

      return {
        ...item,
        status: novoStatus,
        atualizadoEm: agora,
      };
    });

    setCorrentistas(listaAtualizada);
  }

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
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-4 py-3 text-sm ${
                  item.destaque
                    ? "bg-orange-600 font-semibold text-white hover:bg-orange-700"
                    : "font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Cadastro operacional
            </p>

            <h1 className="text-3xl font-bold text-slate-950">
              Correntistas
            </h1>

            <p className="text-sm text-slate-600">
              Cadastre clientes que compram por conta, fiado ou no crédito para
              controle futuro no PDV e contas a receber.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumo.total}
              </strong>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700">Ativos</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {resumo.ativos}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Inativos</p>
              <strong className="mt-2 block text-2xl text-slate-700">
                {resumo.inativos}
              </strong>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm text-blue-700">Limite total</p>
              <strong className="mt-2 block text-2xl text-blue-700">
                {formatarMoeda(resumo.limiteTotal)}
              </strong>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm text-red-700">Saldo em aberto</p>
              <strong className="mt-2 block text-2xl text-red-700">
                {formatarMoeda(resumo.saldoAbertoTotal)}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-5 text-xl font-bold text-slate-950">
                {editandoId ? "Editar correntista" : "Novo correntista"}
              </h2>

              <form onSubmit={salvarCorrentista} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder="Ex: (00) 00000-0000"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    value={documento}
                    onChange={(event) => setDocumento(event.target.value)}
                    placeholder="Documento do cliente"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Limite de crédito
                  </label>
                  <input
                    type="text"
                    value={limiteCredito}
                    onChange={(event) => setLimiteCredito(event.target.value)}
                    placeholder="Ex: 500,00"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Saldo em aberto
                  </label>
                  <input
                    type="text"
                    value={saldoAberto}
                    onChange={(event) => setSaldoAberto(event.target.value)}
                    placeholder="Ex: 120,00"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as StatusCorrentista)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Observações
                  </label>
                  <textarea
                    value={observacoes}
                    onChange={(event) => setObservacoes(event.target.value)}
                    placeholder="Observações internas sobre o cliente"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                  >
                    {editandoId ? "Salvar edição" : "Cadastrar correntista"}
                  </button>

                  {editandoId && (
                    <button
                      type="button"
                      onClick={limparFormulario}
                      className="w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300"
                    >
                      Cancelar edição
                    </button>
                  )}

                  <a
                    href="/configuracoes"
                    className="block w-full rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Voltar para configurações
                  </a>
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-950">
                  Correntistas cadastrados
                </h2>

                <p className="text-sm text-slate-500">
                  Controle clientes por conta, fiado ou crédito interno.
                </p>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Buscar
                  </label>
                  <input
                    type="text"
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar por nome, telefone ou documento..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(event) =>
                      setFiltroStatus(
                        event.target.value as StatusCorrentista | "Todos"
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Ativo">Ativos</option>
                    <option value="Inativo">Inativos</option>
                  </select>
                </div>
              </div>

              {correntistasFiltrados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="font-medium text-slate-700">
                    Nenhum correntista encontrado.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cadastre um correntista ou ajuste os filtros.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-3">Nome</th>
                        <th className="px-3 py-3">Telefone</th>
                        <th className="px-3 py-3">Documento</th>
                        <th className="px-3 py-3 text-right">Limite</th>
                        <th className="px-3 py-3 text-right">Saldo</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Atualizado</th>
                        <th className="px-3 py-3 text-right">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {correntistasFiltrados.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 text-sm"
                        >
                          <td className="px-3 py-4 font-bold text-slate-950">
                            {item.nome}
                            {item.observacoes && (
                              <p className="mt-1 text-xs font-normal text-slate-500">
                                {item.observacoes}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-4 text-slate-700">
                            {item.telefone || "-"}
                          </td>

                          <td className="px-3 py-4 text-slate-700">
                            {item.documento || "-"}
                          </td>

                          <td className="px-3 py-4 text-right font-bold text-blue-700">
                            {formatarMoeda(item.limiteCredito)}
                          </td>

                          <td className="px-3 py-4 text-right font-bold text-red-700">
                            {formatarMoeda(item.saldoAberto)}
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                item.status === "Ativo"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {formatarData(item.atualizadoEm)}
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editarCorrentista(item)}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  alternarStatusCorrentista(item.id)
                                }
                                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                              >
                                {item.status === "Ativo"
                                  ? "Desativar"
                                  : "Ativar"}
                              </button>

                              <button
                                type="button"
                                onClick={() => excluirCorrentista(item.id)}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
