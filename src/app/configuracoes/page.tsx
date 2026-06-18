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

type TipoTaxa = "Percentual" | "Valor fixo";

type TaxaCadastro = {
  id: string;
  nome: string;
  tipo: TipoTaxa;
  valor: number;
  ativo: boolean;
};

type TaxaEntrega = {
  valor: number;
  ativo: boolean;
};

const CONFIG_STORAGE_KEY = "gestor-restaurante-configuracoes";
const TAXAS_MAQUININHA_KEY = "gestor-restaurante-taxas-maquininhas";
const TAXAS_DELIVERY_KEY = "gestor-restaurante-taxas-delivery";
const TAXA_ENTREGA_KEY = "gestor-restaurante-taxa-entrega";

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

const taxaEntregaPadrao: TaxaEntrega = {
  valor: 3,
  ativo: true,
};

function criarId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarTaxa(taxa: TaxaCadastro) {
  if (taxa.tipo === "Percentual") {
    return `${taxa.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }

  return formatarMoeda(taxa.valor);
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

function lerTaxaEntregaStorage() {
  if (typeof window === "undefined") {
    return taxaEntregaPadrao;
  }

  const dados = localStorage.getItem(TAXA_ENTREGA_KEY);

  if (!dados) {
    return taxaEntregaPadrao;
  }

  try {
    const dadosConvertidos = JSON.parse(dados) as TaxaEntrega;

    return {
      ...taxaEntregaPadrao,
      ...dadosConvertidos,
    };
  } catch {
    return taxaEntregaPadrao;
  }
}

export default function ConfiguracoesPage() {
  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracoesRestaurante>(configuracoesPadrao);

  const [taxasMaquininhas, setTaxasMaquininhas] = useState<TaxaCadastro[]>([]);
  const [taxasDelivery, setTaxasDelivery] = useState<TaxaCadastro[]>([]);
  const [taxaEntrega, setTaxaEntrega] =
    useState<TaxaEntrega>(taxaEntregaPadrao);

  const [valorTaxaEntrega, setValorTaxaEntrega] = useState("3");

  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [taxaEntregaSalva, setTaxaEntregaSalva] = useState(false);
  const [taxasCarregadas, setTaxasCarregadas] = useState(false);

  const [nomeTaxaMaquininha, setNomeTaxaMaquininha] = useState("");
  const [tipoTaxaMaquininha, setTipoTaxaMaquininha] =
    useState<TipoTaxa>("Percentual");
  const [valorTaxaMaquininha, setValorTaxaMaquininha] = useState("");
  const [editandoMaquininhaId, setEditandoMaquininhaId] = useState<
    string | null
  >(null);

  const [nomeTaxaDelivery, setNomeTaxaDelivery] = useState("");
  const [tipoTaxaDelivery, setTipoTaxaDelivery] =
    useState<TipoTaxa>("Percentual");
  const [valorTaxaDelivery, setValorTaxaDelivery] = useState("");
  const [editandoDeliveryId, setEditandoDeliveryId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const dadosSalvos = localStorage.getItem(CONFIG_STORAGE_KEY);

    if (dadosSalvos) {
      try {
        const dadosConvertidos = JSON.parse(
          dadosSalvos
        ) as ConfiguracoesRestaurante;

        setConfiguracoes({
          ...configuracoesPadrao,
          ...dadosConvertidos,
        });
      } catch {
        setConfiguracoes(configuracoesPadrao);
      }
    }

    const entregaLocal = lerTaxaEntregaStorage();
    const maquininhasLocais = lerListaStorage<TaxaCadastro>(TAXAS_MAQUININHA_KEY);
    const deliveryLocal = lerListaStorage<TaxaCadastro>(TAXAS_DELIVERY_KEY);

    setTaxaEntrega(entregaLocal);
    setValorTaxaEntrega(String(entregaLocal.valor));
    setTaxasMaquininhas(maquininhasLocais);
    setTaxasDelivery(deliveryLocal);

    let cancelado = false;

    async function carregarTaxas() {
      try {
        const resposta = await fetch("/api/taxas", { cache: "no-store" });
        const dados = resposta.ok ? await resposta.json() : null;

        if (cancelado || !dados) return;

        const maquininhasSupabase = Array.isArray(dados.maquininhas)
          ? dados.maquininhas
          : [];
        const deliverySupabase = Array.isArray(dados.delivery) ? dados.delivery : [];

        if (maquininhasSupabase.length > 0) {
          setTaxasMaquininhas(maquininhasSupabase);
          localStorage.setItem(TAXAS_MAQUININHA_KEY, JSON.stringify(maquininhasSupabase));
        } else if (maquininhasLocais.length > 0) {
          await salvarTaxasNoSupabase(maquininhasLocais, deliveryLocal, entregaLocal);
        }

        if (deliverySupabase.length > 0) {
          setTaxasDelivery(deliverySupabase);
          localStorage.setItem(TAXAS_DELIVERY_KEY, JSON.stringify(deliverySupabase));
        }

        if (dados.entrega) {
          const entregaSupabase = {
            ...taxaEntregaPadrao,
            ...dados.entrega,
            valor: Number(dados.entrega.valor || 0),
            ativo: dados.entrega.ativo !== false,
          };

          setTaxaEntrega(entregaSupabase);
          setValorTaxaEntrega(String(entregaSupabase.valor || 0));
          localStorage.setItem(TAXA_ENTREGA_KEY, JSON.stringify(entregaSupabase));
        } else if (entregaLocal) {
          await salvarTaxasNoSupabase(maquininhasLocais, deliveryLocal, entregaLocal);
        }
      } catch (error) {
        console.error("Não foi possível carregar taxas do Supabase.", error);
      } finally {
        if (!cancelado) setTaxasCarregadas(true);
      }
    }

    carregarTaxas();

    return () => {
      cancelado = true;
    };
  }, []);

  async function salvarTaxasNoSupabase(
    maquininhas = taxasMaquininhas,
    delivery = taxasDelivery,
    entrega = taxaEntrega
  ) {
    try {
      const resposta = await fetch("/api/taxas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maquininhas, delivery, entrega }),
      });

      if (!resposta.ok) {
        throw new Error(await resposta.text());
      }
    } catch (error) {
      console.error("Não foi possível salvar taxas no Supabase.", error);
    }
  }


  async function removerTaxaNoSupabase(id: string) {
    try {
      const resposta = await fetch("/api/taxas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!resposta.ok) {
        throw new Error(await resposta.text());
      }
    } catch (error) {
      console.error("Não foi possível remover a taxa do Supabase.", error);
      alert("Removi no navegador, mas não consegui remover do Supabase agora.");
    }
  }

  useEffect(() => {
    localStorage.setItem(
      TAXAS_MAQUININHA_KEY,
      JSON.stringify(taxasMaquininhas)
    );

    if (taxasCarregadas) {
      salvarTaxasNoSupabase(taxasMaquininhas, taxasDelivery, taxaEntrega);
    }
  }, [taxasMaquininhas]);

  useEffect(() => {
    localStorage.setItem(TAXAS_DELIVERY_KEY, JSON.stringify(taxasDelivery));

    if (taxasCarregadas) {
      salvarTaxasNoSupabase(taxasMaquininhas, taxasDelivery, taxaEntrega);
    }
  }, [taxasDelivery]);

  useEffect(() => {
    localStorage.setItem(TAXA_ENTREGA_KEY, JSON.stringify(taxaEntrega));

    if (taxasCarregadas) {
      salvarTaxasNoSupabase(taxasMaquininhas, taxasDelivery, taxaEntrega);
    }
  }, [taxaEntrega]);

  const resumoTaxas = useMemo(() => {
    return {
      totalMaquininhas: taxasMaquininhas.length,
      maquininhasAtivas: taxasMaquininhas.filter((taxa) => taxa.ativo).length,
      totalDelivery: taxasDelivery.length,
      deliveryAtivas: taxasDelivery.filter((taxa) => taxa.ativo).length,
    };
  }, [taxasMaquininhas, taxasDelivery]);

  function atualizarCampo(
    campo: keyof ConfiguracoesRestaurante,
    valor: string
  ) {
    setConfiguracoes((dadosAtuais) => ({
      ...dadosAtuais,
      [campo]: valor,
    }));

    setSalvoComSucesso(false);
  }

  function salvarConfiguracoes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configuracoes));

    setSalvoComSucesso(true);

    setTimeout(() => {
      setSalvoComSucesso(false);
    }, 3000);
  }

  function restaurarPadrao() {
    const confirmar = confirm(
      "Deseja realmente limpar os dados cadastrais e restaurar o padrão?"
    );

    if (!confirmar) {
      return;
    }

    setConfiguracoes(configuracoesPadrao);
    localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify(configuracoesPadrao)
    );
    setSalvoComSucesso(true);

    setTimeout(() => {
      setSalvoComSucesso(false);
    }, 3000);
  }

  function salvarTaxaEntrega(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valorTaxaEntrega.replace(",", "."));

    if (!valorTaxaEntrega || valorNumerico < 0) {
      alert("Informe o valor da taxa de entrega corretamente.");
      return;
    }

    setTaxaEntrega({
      valor: valorNumerico,
      ativo: taxaEntrega.ativo,
    });

    setTaxaEntregaSalva(true);

    setTimeout(() => {
      setTaxaEntregaSalva(false);
    }, 3000);
  }

  function alternarTaxaEntrega() {
    setTaxaEntrega((dadosAtuais) => ({
      ...dadosAtuais,
      ativo: !dadosAtuais.ativo,
    }));
  }

  function limparFormularioMaquininha() {
    setNomeTaxaMaquininha("");
    setTipoTaxaMaquininha("Percentual");
    setValorTaxaMaquininha("");
    setEditandoMaquininhaId(null);
  }

  function limparFormularioDelivery() {
    setNomeTaxaDelivery("");
    setTipoTaxaDelivery("Percentual");
    setValorTaxaDelivery("");
    setEditandoDeliveryId(null);
  }

  function salvarTaxaMaquininha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valorTaxaMaquininha.replace(",", "."));

    if (
      !nomeTaxaMaquininha.trim() ||
      !valorTaxaMaquininha ||
      valorNumerico < 0
    ) {
      alert("Preencha o nome da taxa e o valor corretamente.");
      return;
    }

    if (editandoMaquininhaId) {
      setTaxasMaquininhas((listaAtual) =>
        listaAtual.map((taxa) =>
          taxa.id === editandoMaquininhaId
            ? {
                ...taxa,
                nome: nomeTaxaMaquininha.trim(),
                tipo: tipoTaxaMaquininha,
                valor: valorNumerico,
              }
            : taxa
        )
      );

      limparFormularioMaquininha();
      return;
    }

    const novaTaxa: TaxaCadastro = {
      id: criarId(),
      nome: nomeTaxaMaquininha.trim(),
      tipo: tipoTaxaMaquininha,
      valor: valorNumerico,
      ativo: true,
    };

    setTaxasMaquininhas((listaAtual) => [novaTaxa, ...listaAtual]);
    limparFormularioMaquininha();
  }

  function salvarTaxaDelivery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const valorNumerico = Number(valorTaxaDelivery.replace(",", "."));

    if (!nomeTaxaDelivery.trim() || !valorTaxaDelivery || valorNumerico < 0) {
      alert("Preencha o nome da taxa e o valor corretamente.");
      return;
    }

    if (editandoDeliveryId) {
      setTaxasDelivery((listaAtual) =>
        listaAtual.map((taxa) =>
          taxa.id === editandoDeliveryId
            ? {
                ...taxa,
                nome: nomeTaxaDelivery.trim(),
                tipo: tipoTaxaDelivery,
                valor: valorNumerico,
              }
            : taxa
        )
      );

      limparFormularioDelivery();
      return;
    }

    const novaTaxa: TaxaCadastro = {
      id: criarId(),
      nome: nomeTaxaDelivery.trim(),
      tipo: tipoTaxaDelivery,
      valor: valorNumerico,
      ativo: true,
    };

    setTaxasDelivery((listaAtual) => [novaTaxa, ...listaAtual]);
    limparFormularioDelivery();
  }

  function editarTaxaMaquininha(taxa: TaxaCadastro) {
    setEditandoMaquininhaId(taxa.id);
    setNomeTaxaMaquininha(taxa.nome);
    setTipoTaxaMaquininha(taxa.tipo);
    setValorTaxaMaquininha(String(taxa.valor));
  }

  function editarTaxaDelivery(taxa: TaxaCadastro) {
    setEditandoDeliveryId(taxa.id);
    setNomeTaxaDelivery(taxa.nome);
    setTipoTaxaDelivery(taxa.tipo);
    setValorTaxaDelivery(String(taxa.valor));
  }

  function removerTaxaMaquininha(id: string) {
    const confirmar = confirm("Deseja remover esta taxa de maquininha?");

    if (!confirmar) {
      return;
    }

    setTaxasMaquininhas((listaAtual) =>
      listaAtual.filter((taxa) => taxa.id !== id)
    );
    removerTaxaNoSupabase(id);

    if (editandoMaquininhaId === id) {
      limparFormularioMaquininha();
    }
  }

  function removerTaxaDelivery(id: string) {
    const confirmar = confirm("Deseja remover esta taxa de delivery?");

    if (!confirmar) {
      return;
    }

    setTaxasDelivery((listaAtual) =>
      listaAtual.filter((taxa) => taxa.id !== id)
    );
    removerTaxaNoSupabase(id);

    if (editandoDeliveryId === id) {
      limparFormularioDelivery();
    }
  }

  function alternarStatusMaquininha(id: string) {
    setTaxasMaquininhas((listaAtual) =>
      listaAtual.map((taxa) =>
        taxa.id === id ? { ...taxa, ativo: !taxa.ativo } : taxa
      )
    );
  }

  function alternarStatusDelivery(id: string) {
    setTaxasDelivery((listaAtual) =>
      listaAtual.map((taxa) =>
        taxa.id === id ? { ...taxa, ativo: !taxa.ativo } : taxa
      )
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar active="configuracoes" />

        <section className="flex-1 px-8 py-8">
          <div className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
              Preferências do sistema
            </p>

            <h1 className="text-3xl font-bold text-slate-950">
              Configurações
            </h1>

            <p className="text-sm text-slate-600">
              Cadastre os dados do restaurante, taxas de maquininha, taxas de
              delivery, taxa de entrega e cadastros operacionais.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Taxas de maquininha</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumoTaxas.totalMaquininhas}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                {resumoTaxas.maquininhasAtivas} ativa(s)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Taxas de delivery</p>
              <strong className="mt-2 block text-2xl text-slate-950">
                {resumoTaxas.totalDelivery}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                {resumoTaxas.deliveryAtivas} ativa(s)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Taxa de entrega</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                {formatarMoeda(taxaEntrega.valor)}
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                {taxaEntrega.ativo ? "Ativa" : "Inativa"}
              </p>
            </div>

            <a
              href="/produtos"
              className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-orange-300 hover:bg-orange-50"
            >
              <p className="text-sm text-slate-500">Produtos/itens</p>
              <strong className="mt-2 block text-2xl text-orange-600">
                Abrir
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Almoço, janta, bebidas e estoque.
              </p>
            </a>

            <a
              href="/correntistas"
              className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-300 hover:bg-emerald-50"
            >
              <p className="text-sm text-slate-500">Correntistas</p>
              <strong className="mt-2 block text-2xl text-emerald-700">
                Abrir
              </strong>
              <p className="mt-2 text-xs text-slate-500">
                Clientes por conta ou fiado.
              </p>
            </a>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Dados do restaurante
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Essas informações são usadas no cupom/recibo e futuramente em
                  relatórios e impressões.
                </p>
              </div>

              <form onSubmit={salvarConfiguracoes} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Nome do restaurante
                    </label>
                    <input
                      type="text"
                      value={configuracoes.nomeRestaurante}
                      onChange={(event) =>
                        atualizarCampo("nomeRestaurante", event.target.value)
                      }
                      placeholder="Ex: Samambaia Restaurante e Pizzaria"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Responsável
                    </label>
                    <input
                      type="text"
                      value={configuracoes.responsavel}
                      onChange={(event) =>
                        atualizarCampo("responsavel", event.target.value)
                      }
                      placeholder="Ex: Nome do proprietário ou gerente"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={configuracoes.telefone}
                      onChange={(event) =>
                        atualizarCampo("telefone", event.target.value)
                      }
                      placeholder="Ex: (00) 0000-0000"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      WhatsApp
                    </label>
                    <input
                      type="text"
                      value={configuracoes.whatsapp}
                      onChange={(event) =>
                        atualizarCampo("whatsapp", event.target.value)
                      }
                      placeholder="Ex: (00) 00000-0000"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={configuracoes.endereco}
                    onChange={(event) =>
                      atualizarCampo("endereco", event.target.value)
                    }
                    placeholder="Ex: Rua, número, bairro"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={configuracoes.cidade}
                      onChange={(event) =>
                        atualizarCampo("cidade", event.target.value)
                      }
                      placeholder="Ex: Goiânia"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Estado
                    </label>
                    <input
                      type="text"
                      value={configuracoes.estado}
                      onChange={(event) =>
                        atualizarCampo("estado", event.target.value)
                      }
                      placeholder="Ex: GO"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Observações
                  </label>
                  <textarea
                    value={configuracoes.observacoes}
                    onChange={(event) =>
                      atualizarCampo("observacoes", event.target.value)
                    }
                    placeholder="Ex: Informações internas, horários, observações administrativas..."
                    rows={5}
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                {salvoComSucesso && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    Configurações salvas com sucesso.
                  </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="submit"
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 md:w-56"
                  >
                    Salvar configurações
                  </button>

                  <button
                    type="button"
                    onClick={restaurarPadrao}
                    className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300 md:w-56"
                  >
                    Restaurar padrão
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <h2 className="text-xl font-bold text-emerald-900">
                  Taxa de entrega
                </h2>

                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  Essa taxa será usada na venda rápida quando o pedido for
                  marmitex com entrega.
                </p>

                <form onSubmit={salvarTaxaEntrega} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-emerald-900">
                      Valor da entrega
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valorTaxaEntrega}
                      onChange={(event) =>
                        setValorTaxaEntrega(event.target.value)
                      }
                      placeholder="Ex: 3"
                      className="w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="rounded-xl bg-white px-4 py-3">
                    <p className="text-sm text-slate-600">Taxa atual</p>
                    <strong className="mt-1 block text-2xl text-emerald-700">
                      {formatarMoeda(taxaEntrega.valor)}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      Status: {taxaEntrega.ativo ? "Ativa" : "Inativa"}
                    </p>
                  </div>

                  {taxaEntregaSalva && (
                    <div className="rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-medium text-emerald-700">
                      Taxa de entrega salva com sucesso.
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      Salvar taxa de entrega
                    </button>

                    <button
                      type="button"
                      onClick={alternarTaxaEntrega}
                      className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      {taxaEntrega.ativo
                        ? "Desativar taxa de entrega"
                        : "Ativar taxa de entrega"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Cadastros do sistema
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Use os atalhos abaixo para cadastrar os itens que serão usados
                  no PDV, nas mesas, comandas, vendas rápidas e contas a
                  receber.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <a
                    href="/produtos"
                    className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm font-bold text-orange-800 hover:bg-orange-100"
                  >
                    Abrir cadastro de produtos →
                  </a>

                  <a
                    href="/correntistas"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    Abrir cadastro de correntistas →
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold text-slate-950">
                  PDV em breve
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  A próxima página será a venda rápida. Ela vai puxar os
                  produtos cadastrados, separar almoço e janta, controlar
                  estoque das bebidas e lançar o valor em Entradas.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-6">
              <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
                Cadastros operacionais
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Produtos e correntistas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Acesse os cadastros usados no PDV, nas vendas, nas comandas, nas
                mesas e nas contas a receber.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <a
                href="/produtos"
                className="block rounded-2xl border border-orange-200 bg-orange-50 p-6 hover:border-orange-400 hover:bg-orange-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-orange-700">
                      Cadastro de produtos
                    </p>

                    <h3 className="mt-2 text-2xl font-bold text-orange-900">
                      Produtos/itens
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-orange-800">
                      Cadastre almoço, janta, bebidas, marmitex, pizza, porções,
                      produtos por quilo, estoque e valores de venda.
                    </p>
                  </div>

                  <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
                    Abrir
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-orange-700">
                  Abrir cadastro de produtos →
                </div>
              </a>

              <a
                href="/correntistas"
                className="block rounded-2xl border border-emerald-200 bg-emerald-50 p-6 hover:border-emerald-400 hover:bg-emerald-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      Cadastro de clientes por conta
                    </p>

                    <h3 className="mt-2 text-2xl font-bold text-emerald-900">
                      Correntistas
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-emerald-800">
                      Cadastre clientes que compram fiado, por conta ou no
                      crédito para usar futuramente no PDV e nas contas a
                      receber.
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                    Abrir
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-700">
                  Abrir cadastro de correntistas →
                </div>
              </a>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Taxas de maquininha
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre taxas de cartão, débito, crédito, voucher ou outras
                  cobranças da maquininha.
                </p>
              </div>

              <form onSubmit={salvarTaxaMaquininha} className="space-y-4">
                <input
                  type="text"
                  value={nomeTaxaMaquininha}
                  onChange={(event) =>
                    setNomeTaxaMaquininha(event.target.value)
                  }
                  placeholder="Ex: Crédito 3%, Débito 1,5%, Voucher..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <select
                    value={tipoTaxaMaquininha}
                    onChange={(event) =>
                      setTipoTaxaMaquininha(event.target.value as TipoTaxa)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    <option value="Percentual">Percentual</option>
                    <option value="Valor fixo">Valor fixo</option>
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorTaxaMaquininha}
                    onChange={(event) =>
                      setValorTaxaMaquininha(event.target.value)
                    }
                    placeholder="Ex: 3.5"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="submit"
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 md:w-56"
                  >
                    {editandoMaquininhaId ? "Salvar edição" : "Cadastrar taxa"}
                  </button>

                  {editandoMaquininhaId && (
                    <button
                      type="button"
                      onClick={limparFormularioMaquininha}
                      className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300 md:w-56"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {taxasMaquininhas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Nenhuma taxa de maquininha cadastrada.
                    </p>
                  </div>
                ) : (
                  taxasMaquininhas.map((taxa) => (
                    <div
                      key={taxa.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <p className="font-bold text-slate-950">
                            {taxa.nome}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {taxa.tipo}: {formatarTaxa(taxa)}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              taxa.ativo
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {taxa.ativo ? "Ativa" : "Inativa"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editarTaxaMaquininha(taxa)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => alternarStatusMaquininha(taxa.id)}
                            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            {taxa.ativo ? "Desativar" : "Ativar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => removerTaxaMaquininha(taxa.id)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Taxas de delivery
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre taxas dos aplicativos parceiros, como iFood, Aiqfome
                  ou outros canais.
                </p>
              </div>

              <form onSubmit={salvarTaxaDelivery} className="space-y-4">
                <input
                  type="text"
                  value={nomeTaxaDelivery}
                  onChange={(event) => setNomeTaxaDelivery(event.target.value)}
                  placeholder="Ex: iFood 12%, Aiqfome 10%..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <select
                    value={tipoTaxaDelivery}
                    onChange={(event) =>
                      setTipoTaxaDelivery(event.target.value as TipoTaxa)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  >
                    <option value="Percentual">Percentual</option>
                    <option value="Valor fixo">Valor fixo</option>
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorTaxaDelivery}
                    onChange={(event) =>
                      setValorTaxaDelivery(event.target.value)
                    }
                    placeholder="Ex: 12"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="submit"
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 md:w-56"
                  >
                    {editandoDeliveryId ? "Salvar edição" : "Cadastrar taxa"}
                  </button>

                  {editandoDeliveryId && (
                    <button
                      type="button"
                      onClick={limparFormularioDelivery}
                      className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-300 md:w-56"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {taxasDelivery.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Nenhuma taxa de delivery cadastrada.
                    </p>
                  </div>
                ) : (
                  taxasDelivery.map((taxa) => (
                    <div
                      key={taxa.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <p className="font-bold text-slate-950">
                            {taxa.nome}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {taxa.tipo}: {formatarTaxa(taxa)}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              taxa.ativo
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {taxa.ativo ? "Ativa" : "Inativa"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editarTaxaDelivery(taxa)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => alternarStatusDelivery(taxa.id)}
                            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            {taxa.ativo ? "Desativar" : "Ativar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => removerTaxaDelivery(taxa.id)}
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-950">
              Status do MVP
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                "Dashboard",
                "Entradas",
                "Saídas",
                "Contas a pagar",
                "Contas a receber",
                "Folha de pagamento",
                "Investimentos",
                "Relatórios",
                "Configurações",
                "Taxas",
                "Produtos/itens",
                "Correntistas",
                "Cupom/recibo",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-emerald-800">
                    {item}
                  </span>
                  <strong className="text-xs text-emerald-700">Ativo</strong>
                </div>
              ))}

              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <span className="text-sm font-medium text-blue-800">PDV</span>
                <strong className="text-xs text-blue-700">Em breve</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}