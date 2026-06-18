"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { useEffect, useMemo, useState } from "react";

type ConfiguracoesRestaurante = {
  nomeRestaurante: string;
  responsavel: string;
  telefone: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  estado: string;
  observacoes: string;
};

type ItemCupom = {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

type CupomEmitido = {
  id: string;
  data: string;
  hora: string;
  clienteEmpresa: string;
  nomePessoa: string;
  documento: string;
  formaPagamento: string;
  observacao: string;
  itens: ItemCupom[];
  total: number;
};

const CONFIG_STORAGE_KEY = "gestor-restaurante-configuracoes";
const CUPONS_STORAGE_KEY = "gestor-restaurante-cupons-refeicao";

const configuracoesPadrao: ConfiguracoesRestaurante = {
  nomeRestaurante: "Samambaia Restaurante e Pizzaria",
  responsavel: "",
  telefone: "",
  whatsapp: "",
  endereco: "",
  cidade: "",
  estado: "",
  observacoes: "",
};

const formasPagamento = [
  "Dinheiro",
  "Pix",
  "Cartão débito",
  "Cartão crédito",
  "Voucher",
  "Faturado para empresa",
  "Outros",
];

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarData(data: string) {
  if (!data) {
    return "-";
  }

  return data.split("-").reverse().join("/");
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function lerListaStorage<T>(chave: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const dados = localStorage.getItem(chave);

  if (!dados) {
    return [];
  }

  try {
    return JSON.parse(dados) as T[];
  } catch {
    return [];
  }
}

function lerConfiguracoes() {
  if (typeof window === "undefined") {
    return configuracoesPadrao;
  }

  const dados = localStorage.getItem(CONFIG_STORAGE_KEY);

  if (!dados) {
    return configuracoesPadrao;
  }

  try {
    const dadosConvertidos = JSON.parse(dados) as ConfiguracoesRestaurante;

    return {
      ...configuracoesPadrao,
      ...dadosConvertidos,
    };
  } catch {
    return configuracoesPadrao;
  }
}

export default function CupomPage() {
  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracoesRestaurante>(configuracoesPadrao);

  const [cuponsEmitidos, setCuponsEmitidos] = useState<CupomEmitido[]>([]);

  const [data, setData] = useState(hojeISO());
  const [hora, setHora] = useState(horaAtual());
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [nomePessoa, setNomePessoa] = useState("");
  const [documento, setDocumento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Faturado para empresa");
  const [observacao, setObservacao] = useState("");

  const [descricaoItem, setDescricaoItem] = useState("");
  const [quantidadeItem, setQuantidadeItem] = useState("1");
  const [valorUnitarioItem, setValorUnitarioItem] = useState("");

  const [itens, setItens] = useState<ItemCupom[]>([]);
  const [cupomGerado, setCupomGerado] = useState<CupomEmitido | null>(null);

  useEffect(() => {
    setConfiguracoes(lerConfiguracoes());
    setCuponsEmitidos(lerListaStorage<CupomEmitido>(CUPONS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    localStorage.setItem(CUPONS_STORAGE_KEY, JSON.stringify(cuponsEmitidos));
  }, [cuponsEmitidos]);

  const totalCupom = useMemo(() => {
    return itens.reduce(
      (acc, item) => acc + item.quantidade * item.valorUnitario,
      0
    );
  }, [itens]);

  function limparItem() {
    setDescricaoItem("");
    setQuantidadeItem("1");
    setValorUnitarioItem("");
  }

  function adicionarItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const quantidade = Number(quantidadeItem.replace(",", "."));
    const valorUnitario = Number(valorUnitarioItem.replace(",", "."));

    if (!descricaoItem.trim() || quantidade <= 0 || valorUnitario <= 0) {
      alert("Preencha descrição, quantidade e valor do item corretamente.");
      return;
    }

    const novoItem: ItemCupom = {
      id: criarId(),
      descricao: descricaoItem.trim(),
      quantidade,
      valorUnitario,
    };

    setItens((listaAtual) => [...listaAtual, novoItem]);
    limparItem();
  }

  function removerItem(id: string) {
    setItens((listaAtual) => listaAtual.filter((item) => item.id !== id));
  }

  function limparFormularioCompleto() {
    setData(hojeISO());
    setHora(horaAtual());
    setClienteEmpresa("");
    setNomePessoa("");
    setDocumento("");
    setFormaPagamento("Faturado para empresa");
    setObservacao("");
    setItens([]);
    setCupomGerado(null);
    limparItem();
  }

  function gerarCupom() {
    if (itens.length === 0) {
      alert("Adicione pelo menos um item ao comprovante.");
      return;
    }

    const novoCupom: CupomEmitido = {
      id: criarId(),
      data,
      hora,
      clienteEmpresa: clienteEmpresa.trim(),
      nomePessoa: nomePessoa.trim(),
      documento: documento.trim(),
      formaPagamento,
      observacao: observacao.trim(),
      itens,
      total: totalCupom,
    };

    setCupomGerado(novoCupom);
    setCuponsEmitidos((listaAtual) => [novoCupom, ...listaAtual]);
  }

  function imprimirCupom() {
    if (!cupomGerado) {
      alert("Gere o comprovante antes de imprimir.");
      return;
    }

    setTimeout(() => {
      window.print();
    }, 100);
  }

  function excluirCupomHistorico(id: string) {
    const confirmar = confirm("Deseja excluir este comprovante do histórico?");

    if (!confirmar) {
      return;
    }

    setCuponsEmitidos((listaAtual) =>
      listaAtual.filter((cupom) => cupom.id !== id)
    );

    if (cupomGerado?.id === id) {
      setCupomGerado(null);
    }
  }

  function carregarCupomHistorico(cupom: CupomEmitido) {
    setCupomGerado(cupom);
    setData(cupom.data);
    setHora(cupom.hora);
    setClienteEmpresa(cupom.clienteEmpresa);
    setNomePessoa(cupom.nomePessoa);
    setDocumento(cupom.documento);
    setFormaPagamento(cupom.formaPagamento);
    setObservacao(cupom.observacao);
    setItens(cupom.itens);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #area-impressao,
          #area-impressao * {
            visibility: visible;
          }

          #area-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 0;
            margin: 0;
            background: white;
            color: black;
          }

          .no-print {
            display: none !important;
          }

          @page {
            size: 80mm auto;
            margin: 4mm;
          }
        }
      `}</style>

      <div className="flex min-h-screen">
        <AdminSidebar active="configuracoes" printHidden />

        <section className="flex-1 px-8 py-8">
          <div className="no-print mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Comprovante interno
            </p>

            <h1 className="text-3xl font-bold text-slate-950">
              Cupom/recibo de refeição
            </h1>

            <p className="text-sm text-slate-600">
              Emita um comprovante simples de refeição para empresas, clientes e
              controle interno. Não substitui documento fiscal oficial.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[440px_1fr_360px]">
            <div className="no-print space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Dados do comprovante
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Data
                    </label>
                    <input
                      type="date"
                      value={data}
                      onChange={(event) => setData(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Hora
                    </label>
                    <input
                      type="time"
                      value={hora}
                      onChange={(event) => setHora(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Empresa ou cliente
                    </label>
                    <input
                      type="text"
                      value={clienteEmpresa}
                      onChange={(event) => setClienteEmpresa(event.target.value)}
                      placeholder="Ex: Empresa ABC"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Nome da pessoa
                    </label>
                    <input
                      type="text"
                      value={nomePessoa}
                      onChange={(event) => setNomePessoa(event.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Documento ou matrícula
                    </label>
                    <input
                      type="text"
                      value={documento}
                      onChange={(event) => setDocumento(event.target.value)}
                      placeholder="Ex: CPF, matrícula ou código interno"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Forma de pagamento
                    </label>
                    <select
                      value={formaPagamento}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      {formasPagamento.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Observação
                    </label>
                    <textarea
                      value={observacao}
                      onChange={(event) => setObservacao(event.target.value)}
                      placeholder="Ex: Refeição referente ao almoço do colaborador."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Adicionar item
                </h2>

                <form onSubmit={adicionarItem} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Descrição do item
                    </label>
                    <input
                      type="text"
                      value={descricaoItem}
                      onChange={(event) => setDescricaoItem(event.target.value)}
                      placeholder="Ex: Marmitex, almoço, refeição, bebida..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantidadeItem}
                        onChange={(event) =>
                          setQuantidadeItem(event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Valor unitário
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valorUnitarioItem}
                        onChange={(event) =>
                          setValorUnitarioItem(event.target.value)
                        }
                        placeholder="Ex: 25"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
                  >
                    Adicionar item
                  </button>
                </form>
              </div>
            </div>

            <div className="no-print space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Itens do comprovante
                    </h2>
                    <p className="text-sm text-slate-500">
                      Confira os itens antes de gerar o recibo.
                    </p>
                  </div>

                  <strong className="text-xl text-emerald-700">
                    {formatarMoeda(totalCupom)}
                  </strong>
                </div>

                {itens.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="font-medium text-slate-700">
                      Nenhum item adicionado.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Adicione uma refeição ou produto para gerar o comprovante.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3">Item</th>
                          <th className="px-3 py-3 text-right">Qtd.</th>
                          <th className="px-3 py-3 text-right">Unit.</th>
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {itens.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 text-sm"
                          >
                            <td className="px-3 py-4 font-semibold text-slate-950">
                              {item.descricao}
                            </td>

                            <td className="px-3 py-4 text-right text-slate-700">
                              {item.quantidade}
                            </td>

                            <td className="px-3 py-4 text-right text-slate-700">
                              {formatarMoeda(item.valorUnitario)}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-slate-950">
                              {formatarMoeda(
                                item.quantidade * item.valorUnitario
                              )}
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removerItem(item.id)}
                                  className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300"
                                >
                                  Remover
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 md:flex-row">
                  <button
                    type="button"
                    onClick={gerarCupom}
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 md:w-56"
                  >
                    Gerar comprovante
                  </button>

                  <button
                    type="button"
                    onClick={imprimirCupom}
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 md:w-56"
                  >
                    Imprimir
                  </button>

                  <button
                    type="button"
                    onClick={limparFormularioCompleto}
                    className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300 md:w-56"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-5 text-xl font-bold text-slate-950">
                  Histórico de comprovantes
                </h2>

                {cuponsEmitidos.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum comprovante emitido ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cuponsEmitidos.slice(0, 8).map((cupom) => (
                      <div
                        key={cupom.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                          <div>
                            <p className="font-bold text-slate-950">
                              {cupom.clienteEmpresa ||
                                cupom.nomePessoa ||
                                "Comprovante sem nome"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatarData(cupom.data)} às {cupom.hora} •{" "}
                              {formatarMoeda(cupom.total)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => carregarCupomHistorico(cupom)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              Abrir
                            </button>

                            <button
                              type="button"
                              onClick={() => excluirCupomHistorico(cupom.id)}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="no-print mb-5">
                <h2 className="text-xl font-bold text-slate-950">
                  Prévia para impressão
                </h2>
                <p className="text-sm text-slate-500">
                  Este é o modelo que será enviado para a impressora.
                </p>
              </div>

              <div
                id="area-impressao"
                className="mx-auto w-[300px] bg-white p-4 font-mono text-xs text-black"
              >
                <div className="text-center">
                  <img
                    src="/logo-01.png"
                    alt="Logo do restaurante"
                    className="mx-auto mb-2 h-16 w-auto object-contain"
                  />

                  <p className="text-sm font-bold uppercase">
                    {configuracoes.nomeRestaurante ||
                      "Samambaia Restaurante e Pizzaria"}
                  </p>

                  {configuracoes.endereco && (
                    <p className="mt-1">{configuracoes.endereco}</p>
                  )}

                  {(configuracoes.cidade || configuracoes.estado) && (
                    <p>
                      {configuracoes.cidade}
                      {configuracoes.estado ? ` - ${configuracoes.estado}` : ""}
                    </p>
                  )}

                  {(configuracoes.telefone || configuracoes.whatsapp) && (
                    <p>{configuracoes.telefone || configuracoes.whatsapp}</p>
                  )}

                  <p className="mt-3 font-bold">COMPROVANTE DE REFEIÇÃO</p>

                  <p className="mt-1">NÃO É DOCUMENTO FISCAL</p>
                </div>

                <div className="my-3 border-t border-dashed border-black" />

                <div>
                  <p>
                    <strong>Data:</strong>{" "}
                    {cupomGerado
                      ? formatarData(cupomGerado.data)
                      : formatarData(data)}
                  </p>
                  <p>
                    <strong>Hora:</strong>{" "}
                    {cupomGerado ? cupomGerado.hora : hora}
                  </p>

                  {(cupomGerado?.clienteEmpresa || clienteEmpresa) && (
                    <p>
                      <strong>Empresa:</strong>{" "}
                      {cupomGerado?.clienteEmpresa || clienteEmpresa}
                    </p>
                  )}

                  {(cupomGerado?.nomePessoa || nomePessoa) && (
                    <p>
                      <strong>Pessoa:</strong>{" "}
                      {cupomGerado?.nomePessoa || nomePessoa}
                    </p>
                  )}

                  {(cupomGerado?.documento || documento) && (
                    <p>
                      <strong>Doc.:</strong>{" "}
                      {cupomGerado?.documento || documento}
                    </p>
                  )}

                  <p>
                    <strong>Pagamento:</strong>{" "}
                    {cupomGerado?.formaPagamento || formaPagamento}
                  </p>
                </div>

                <div className="my-3 border-t border-dashed border-black" />

                <div>
                  <div className="grid grid-cols-[1fr_40px_60px] gap-1 font-bold">
                    <span>Item</span>
                    <span className="text-right">Qtd</span>
                    <span className="text-right">Total</span>
                  </div>

                  {(cupomGerado?.itens || itens).length === 0 ? (
                    <p className="mt-2 text-center">Nenhum item lançado</p>
                  ) : (
                    (cupomGerado?.itens || itens).map((item) => (
                      <div key={item.id} className="mt-2">
                        <div className="grid grid-cols-[1fr_40px_60px] gap-1">
                          <span>{item.descricao}</span>
                          <span className="text-right">{item.quantidade}</span>
                          <span className="text-right">
                            {formatarMoeda(
                              item.quantidade * item.valorUnitario
                            ).replace("R$", "")}
                          </span>
                        </div>
                        <p className="text-[10px]">
                          Unit.:{" "}
                          {formatarMoeda(item.valorUnitario).replace("R$", "")}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="my-3 border-t border-dashed border-black" />

                <div className="flex justify-between text-sm font-bold">
                  <span>TOTAL</span>
                  <span>{formatarMoeda(cupomGerado?.total ?? totalCupom)}</span>
                </div>

                {(cupomGerado?.observacao || observacao) && (
                  <>
                    <div className="my-3 border-t border-dashed border-black" />
                    <p>
                      <strong>Obs.:</strong>{" "}
                      {cupomGerado?.observacao || observacao}
                    </p>
                  </>
                )}

                <div className="my-3 border-t border-dashed border-black" />

                <div className="text-center">
                  <p>Assinatura:</p>
                  <div className="mt-6 border-t border-black" />
                  <p className="mt-2">Obrigado pela preferência.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}