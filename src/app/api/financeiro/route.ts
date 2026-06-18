import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTAURANTE_ID = process.env.RESTAURANTE_ID || "samambaia";

type Registro = Record<string, any>;

function numeroSeguro(valor: any): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  if (typeof valor === "string") {
    let texto = valor.replace("R$", "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
    if (texto.includes(",") && texto.includes(".")) texto = texto.replace(/\./g, "").replace(",", ".");
    else if (texto.includes(",")) texto = texto.replace(",", ".");
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
  }

  return 0;
}

function arredondar2(valor: number) {
  return Number((valor || 0).toFixed(2));
}

function normalizarTexto(valor: any) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formaPagamentoNormalizada(forma: any) {
  const texto = normalizarTexto(forma);
  if (texto.includes("dinheiro")) return "Dinheiro";
  if (texto.includes("pix")) return "PIX";
  if (texto.includes("debito")) return "Débito";
  if (texto.includes("credito")) return "Crédito";
  if (texto.includes("correntista") || texto.includes("fiado") || texto.includes("conta")) return "Correntista";
  if (texto.includes("dividido") || texto.includes("misto")) return "Dividido";
  return String(forma || "Não informado");
}

type TaxasCalculo = {
  maquininhas: Registro[];
  delivery: Registro[];
};

function valorDaTaxaCadastro(taxa: Registro | null | undefined) {
  if (!taxa || taxa.ativo === false) return 0;
  return numeroSeguro(taxa.valor) || numeroSeguro(taxa.percentual) || numeroSeguro(taxa.taxa) || numeroSeguro(taxa.porcentagem);
}

function calcularValorTaxaCadastro(valorBase: number, taxa: Registro | null | undefined) {
  const valorTaxa = valorDaTaxaCadastro(taxa);
  if (!taxa || valorBase <= 0 || valorTaxa <= 0) return 0;
  const tipo = normalizarTexto(taxa.tipo || taxa.tipoTaxa || "Percentual");
  if (tipo.includes("fixo") || tipo.includes("valor")) return arredondar2(valorTaxa);
  return arredondar2((valorBase * valorTaxa) / 100);
}

function buscarTaxaMaquininhaPorForma(forma: any, taxasMaquininhas: Registro[] = []) {
  const formaNormalizada = formaPagamentoNormalizada(forma);
  if (formaNormalizada === "Dinheiro" || formaNormalizada === "Correntista" || formaNormalizada === "Dividido") return null;

  const alvo =
    formaNormalizada === "Crédito"
      ? ["credito", "crédito"]
      : formaNormalizada === "Débito"
        ? ["debito", "débito"]
        : ["pix"];

  return taxasMaquininhas.find((taxa) => {
    if (!taxa || taxa.ativo === false) return false;
    const texto = normalizarTexto([taxa.nome, taxa.categoria, taxa.tipo, taxa.valor, taxa.percentual, taxa.taxa, taxa.porcentagem].join(" "));
    return alvo.some((item) => texto.includes(normalizarTexto(item)));
  }) || null;
}

function registroEhDelivery(registro: Registro) {
  const texto = normalizarTexto([
    registro.atendimentoTipo,
    registro.atendimento_tipo,
    registro.tipoVenda,
    registro.tipo_venda,
    registro.categoria,
    registro.origem,
    registro.descricao,
    registro.canal,
  ].join(" "));

  return texto.includes("delivery") || texto.includes("ifood") || texto.includes("aiqfome");
}

async function buscarTaxasCalculo(): Promise<TaxasCalculo> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("financeiro_taxas")
    .select("id,categoria,nome,tipo,valor,ativo,dados")
    .eq("restaurante_id", RESTAURANTE_ID);

  if (error) return { maquininhas: [], delivery: [] };

  const taxas = (data || []).map((row: Registro) => ({ ...(row.dados || {}), ...row }));

  return {
    maquininhas: taxas.filter((taxa: Registro) => String(taxa.categoria) === "maquininha" && taxa.ativo !== false),
    delivery: taxas.filter((taxa: Registro) => String(taxa.categoria) === "delivery" && taxa.ativo !== false),
  };
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataDoRegistro(registro: Registro) {
  const data = String(registro?.data || "");
  if (data.length >= 10) return data.slice(0, 10);

  const dataHora = String(registro?.dataHora || registro?.criadoEm || registro?.createdAt || registro?.created_at || "");
  if (dataHora.length >= 10) return dataHora.slice(0, 10);

  return hojeISO();
}

function dataHoraDoRegistro(registro: Registro) {
  const dataHora = String(registro?.dataHora || registro?.criadoEm || registro?.createdAt || registro?.created_at || "");
  if (dataHora) return dataHora;
  return new Date().toISOString();
}

function idRegistro(registro: Registro, prefixo: string) {
  return String(registro?.id || `${prefixo}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function valorBruto(registro: Registro) {
  return arredondar2(
    numeroSeguro(registro.valorBruto) ||
      numeroSeguro(registro.valorCobrado) ||
      numeroSeguro(registro.valorOriginal) ||
      numeroSeguro(registro.subtotalItens) ||
      numeroSeguro(registro.valor)
  );
}

function desconto(registro: Registro) {
  return arredondar2(numeroSeguro(registro.descontoValor) || numeroSeguro(registro.desconto));
}

function pagamentosDoRegistro(registro: Registro, taxasCalculo: TaxasCalculo = { maquininhas: [], delivery: [] }) {
  const pagamentosOriginais = Array.isArray(registro?.pagamentos)
    ? registro.pagamentos
    : Array.isArray(registro?.formasPagamento)
      ? registro.formasPagamento
      : [];

  if (pagamentosOriginais.length > 0) {
    return pagamentosOriginais
      .map((pagamento: Registro, index: number) => {
        const valorPago = arredondar2(
          numeroSeguro(pagamento.valorPago) || numeroSeguro(pagamento.valor) || numeroSeguro(pagamento.valorBruto)
        );
        const forma = formaPagamentoNormalizada(pagamento.forma || pagamento.formaPagamento || "Não informado");
        const taxaCadastro = buscarTaxaMaquininhaPorForma(forma, taxasCalculo.maquininhas);
        const valorTaxaSalva = arredondar2(numeroSeguro(pagamento.valorTaxa) || numeroSeguro(pagamento.taxaDescontada));
        const valorTaxa = valorTaxaSalva > 0 ? valorTaxaSalva : calcularValorTaxaCadastro(valorPago, taxaCadastro);
        const valorLiquidoSalvo = numeroSeguro(pagamento.valorLiquido);
        const valorLiquido =
          valorLiquidoSalvo > 0 && valorTaxaSalva > 0
            ? arredondar2(valorLiquidoSalvo)
            : arredondar2(valorPago - valorTaxa);

        return {
          id: String(pagamento.id || `${idRegistro(registro, "venda")}-pag-${index}`),
          forma,
          valorPago,
          taxaPercentual: numeroSeguro(pagamento.taxaPercentual) || valorDaTaxaCadastro(taxaCadastro),
          valorTaxa,
          taxaDescontada: valorTaxa,
          valorLiquido,
        };
      })
      .filter((pagamento: Registro) => numeroSeguro(pagamento.valorPago) > 0);
  }

  const bruto = valorBruto(registro);
  const forma = formaPagamentoNormalizada(registro.formaPagamento || registro.formaRecebimento || registro.forma || "Não informado");
  const taxaCadastro = buscarTaxaMaquininhaPorForma(forma, taxasCalculo.maquininhas);
  const taxaSalva = arredondar2(numeroSeguro(registro.taxaMaquininhaDescontada) || numeroSeguro(registro.taxaDescontada));
  const taxa = taxaSalva > 0 ? taxaSalva : calcularValorTaxaCadastro(bruto, taxaCadastro);
  const liquido = numeroSeguro(registro.valorLiquido) > 0 && taxaSalva > 0 ? arredondar2(numeroSeguro(registro.valorLiquido)) : arredondar2(bruto - taxa);

  return [
    {
      id: `${idRegistro(registro, "venda")}-pag-0`,
      forma,
      valorPago: bruto,
      taxaPercentual: numeroSeguro(registro.taxaPercentual) || valorDaTaxaCadastro(taxaCadastro),
      valorTaxa: taxa,
      taxaDescontada: taxa,
      valorLiquido: liquido,
    },
  ].filter((pagamento) => pagamento.valorPago > 0);
}

function itensDoRegistro(registro: Registro) {
  const itens = Array.isArray(registro?.itens) ? registro.itens : [];

  return itens.map((item: Registro, index: number) => ({
    id: String(item.id || `${idRegistro(registro, "venda")}-item-${index}`),
    produtoId: String(item.produtoId || item.produto_id || item.id || ""),
    nome: String(item.nome || item.descricao || "Produto sem nome"),
    quantidade: numeroSeguro(item.quantidade) || 1,
    precoUnitario: numeroSeguro(item.precoUnitario) || numeroSeguro(item.preco_unitario) || numeroSeguro(item.preco) || 0,
    total: arredondar2(numeroSeguro(item.total) || (numeroSeguro(item.quantidade) || 1) * (numeroSeguro(item.precoUnitario) || numeroSeguro(item.preco) || 0)),
    dados: item,
  }));
}

function totaisDaVenda(registro: Registro, taxasCalculo: TaxasCalculo = { maquininhas: [], delivery: [] }) {
  const pagamentos = pagamentosDoRegistro(registro, taxasCalculo);
  const taxaMaquininha = arredondar2(pagamentos.reduce((total, pagamento) => total + numeroSeguro(pagamento.valorTaxa), 0));
  const bruto = valorBruto(registro);
  const taxaDeliverySalva = numeroSeguro(registro.taxaDeliveryDescontada);
  const taxaDelivery = taxaDeliverySalva > 0
    ? arredondar2(taxaDeliverySalva)
    : registroEhDelivery(registro)
      ? calcularValorTaxaCadastro(bruto, taxasCalculo.delivery.find((taxa) => taxa.ativo !== false) || null)
      : 0;
  const valorTaxas = arredondar2(taxaMaquininha + taxaDelivery);
  const liquidoInformado = numeroSeguro(registro.valorLiquido);
  const liquido = liquidoInformado > 0 && (numeroSeguro(registro.taxaDescontada) > 0 || numeroSeguro(registro.valorTaxas) > 0)
    ? arredondar2(liquidoInformado)
    : arredondar2(bruto - valorTaxas);

  return { pagamentos, valorTaxas, bruto, liquido, taxaDelivery };
}

function linhaLancamento(tipo: string, registro: Registro) {
  const id = idRegistro(registro, tipo);

  return {
    id,
    restaurante_id: RESTAURANTE_ID,
    tipo,
    data: dataDoRegistro(registro),
    data_hora: dataHoraDoRegistro(registro),
    valor: numeroSeguro(registro.valor) || valorBruto(registro),
    dados: { ...registro, id },
    atualizado_em: new Date().toISOString(),
  };
}

async function upsertLancamentos(tipo: string, registros: Registro[]) {
  const lista = registros.filter(Boolean).map((registro) => linhaLancamento(tipo, registro));
  if (lista.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("financeiro_lancamentos")
    .upsert(lista, { onConflict: "id,restaurante_id,tipo" });

  if (error) throw error;
}

async function upsertVendas(vendas: Registro[]) {
  const lista = vendas.filter(Boolean);
  if (lista.length === 0) return;

  const supabase = getSupabaseAdmin();
  const taxasCalculo = await buscarTaxasCalculo();

  const linhasVendas = lista.map((venda) => {
    const id = idRegistro(venda, "venda");
    const { pagamentos, valorTaxas, bruto, liquido, taxaDelivery } = totaisDaVenda(venda, taxasCalculo);

    return {
      id,
      restaurante_id: RESTAURANTE_ID,
      caixa_id: String(venda.caixaId || venda.caixa_id || ""),
      atendimento_tipo: String(venda.atendimentoTipo || venda.atendimento_tipo || ""),
      tipo_venda: String(venda.tipoVenda || venda.tipo_venda || venda.atendimentoTipo || ""),
      status: String(venda.status || "Finalizado"),
      data: dataDoRegistro(venda),
      data_hora: dataHoraDoRegistro(venda),
      operador: String(venda.operador || ""),
      consumidor: String(venda.consumidor || venda.cliente || ""),
      forma_pagamento: String(venda.formaPagamento || venda.formaRecebimento || venda.forma || (pagamentos.length > 1 ? "Dividido" : pagamentos[0]?.forma || "")),
      total_itens: numeroSeguro(venda.totalItens),
      valor_original: numeroSeguro(venda.valorOriginal) || bruto,
      subtotal_itens: numeroSeguro(venda.subtotalItens) || bruto,
      desconto_valor: desconto(venda),
      valor_bruto: bruto,
      valor_cobrado: numeroSeguro(venda.valorCobrado) || bruto,
      valor_taxas: valorTaxas,
      valor_liquido: liquido,
      colaborador_id: String(venda.colaboradorId || venda.colaborador_id || ""),
      colaborador_nome: String(venda.colaboradorNome || venda.colaborador_nome || ""),
      colaborador_percentual: numeroSeguro(venda.colaboradorPercentual || venda.colaborador_percentual),
      dados: { ...venda, id, pagamentos, taxaDeliveryDescontada: taxaDelivery, taxaDescontada: valorTaxas, valorLiquido: liquido },
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error: vendaError } = await supabase
    .from("financeiro_vendas")
    .upsert(linhasVendas, { onConflict: "id" });

  if (vendaError) throw vendaError;

  for (const venda of lista) {
    const vendaId = idRegistro(venda, "venda");
    const pagamentos = pagamentosDoRegistro(venda, taxasCalculo).map((pagamento) => ({
      id: pagamento.id,
      venda_id: vendaId,
      restaurante_id: RESTAURANTE_ID,
      forma: pagamento.forma,
      valor_pago: pagamento.valorPago,
      taxa_percentual: pagamento.taxaPercentual,
      valor_taxa: pagamento.valorTaxa,
      valor_liquido: pagamento.valorLiquido,
      dados: pagamento,
      atualizado_em: new Date().toISOString(),
    }));

    const itens = itensDoRegistro(venda).map((item) => ({
      id: item.id,
      venda_id: vendaId,
      restaurante_id: RESTAURANTE_ID,
      produto_id: item.produtoId,
      nome: item.nome,
      quantidade: item.quantidade,
      preco_unitario: item.precoUnitario,
      total: item.total,
      dados: item.dados,
      atualizado_em: new Date().toISOString(),
    }));

    if (pagamentos.length > 0) {
      const { error } = await supabase
        .from("financeiro_venda_pagamentos")
        .upsert(pagamentos, { onConflict: "id" });
      if (error) throw error;
    }

    if (itens.length > 0) {
      const { error } = await supabase
        .from("financeiro_venda_itens")
        .upsert(itens, { onConflict: "id" });
      if (error) throw error;
    }
  }
}

async function upsertColaboradores(colaboradores: Registro[]) {
  const lista = colaboradores.filter(Boolean);
  if (lista.length === 0) return;

  const supabase = getSupabaseAdmin();
  const linhas = lista.map((colaborador) => {
    const id = idRegistro(colaborador, "colaborador");

    return {
      id,
      restaurante_id: RESTAURANTE_ID,
      nome: String(colaborador.nome || "Sem nome"),
      percentual_comissao: numeroSeguro(colaborador.percentualComissao || colaborador.percentual_comissao),
      telefone: String(colaborador.telefone || ""),
      observacoes: String(colaborador.observacoes || ""),
      ativo: colaborador.ativo !== false,
      dados: { ...colaborador, id },
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("financeiro_colaboradores")
    .upsert(linhas, { onConflict: "id" });

  if (error) throw error;
}

function mapVenda(row: Registro, pagamentos: Registro[], itens: Registro[]) {
  const dados = row.dados && typeof row.dados === "object" ? row.dados : {};

  return {
    ...dados,
    id: row.id,
    data: row.data,
    dataHora: row.data_hora,
    caixaId: row.caixa_id,
    atendimentoTipo: row.atendimento_tipo,
    tipoVenda: row.tipo_venda,
    status: row.status,
    operador: row.operador,
    consumidor: row.consumidor,
    formaPagamento: row.forma_pagamento,
    valorOriginal: numeroSeguro(row.valor_original),
    subtotalItens: numeroSeguro(row.subtotal_itens),
    descontoValor: numeroSeguro(row.desconto_valor),
    valorBruto: numeroSeguro(row.valor_bruto),
    valorCobrado: numeroSeguro(row.valor_cobrado),
    taxaDescontada: numeroSeguro(row.valor_taxas),
    valorLiquido: numeroSeguro(row.valor_liquido),
    valor: numeroSeguro(row.valor_liquido),
    colaboradorId: row.colaborador_id || "",
    colaboradorNome: row.colaborador_nome || "",
    colaboradorPercentual: numeroSeguro(row.colaborador_percentual),
    pagamentos: pagamentos.map((pagamento) => ({
      ...(pagamento.dados || {}),
      id: pagamento.id,
      forma: pagamento.forma,
      valorPago: numeroSeguro(pagamento.valor_pago),
      taxaPercentual: numeroSeguro(pagamento.taxa_percentual),
      valorTaxa: numeroSeguro(pagamento.valor_taxa),
      taxaDescontada: numeroSeguro(pagamento.valor_taxa),
      valorLiquido: numeroSeguro(pagamento.valor_liquido),
    })),
    itens: itens.map((item) => ({
      ...(item.dados || {}),
      id: item.id,
      produtoId: item.produto_id,
      nome: item.nome,
      quantidade: numeroSeguro(item.quantidade),
      precoUnitario: numeroSeguro(item.preco_unitario),
      total: numeroSeguro(item.total),
    })),
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [vendasResp, pagamentosResp, itensResp, lancamentosResp, colaboradoresResp] = await Promise.all([
      supabase
        .from("financeiro_vendas")
        .select(
          "id,caixa_id,atendimento_tipo,tipo_venda,status,data,data_hora,operador,consumidor,forma_pagamento,total_itens,valor_original,subtotal_itens,desconto_valor,valor_bruto,valor_cobrado,valor_taxas,valor_liquido,colaborador_id,colaborador_nome,colaborador_percentual,dados"
        )
        .eq("restaurante_id", RESTAURANTE_ID)
        .order("data_hora", { ascending: false }),
      supabase
        .from("financeiro_venda_pagamentos")
        .select("id,venda_id,forma,valor_pago,taxa_percentual,valor_taxa,valor_liquido,dados")
        .eq("restaurante_id", RESTAURANTE_ID),
      supabase
        .from("financeiro_venda_itens")
        .select("id,venda_id,produto_id,nome,quantidade,preco_unitario,total,dados")
        .eq("restaurante_id", RESTAURANTE_ID),
      supabase
        .from("financeiro_lancamentos")
        .select("id,tipo,data,data_hora,valor,dados")
        .eq("restaurante_id", RESTAURANTE_ID)
        .order("data_hora", { ascending: false }),
      supabase
        .from("financeiro_colaboradores")
        .select("id,nome,percentual_comissao,telefone,observacoes,ativo,dados")
        .eq("restaurante_id", RESTAURANTE_ID)
        .order("nome", { ascending: true }),
    ]);

    const erro = vendasResp.error || pagamentosResp.error || itensResp.error || lancamentosResp.error || colaboradoresResp.error;
    if (erro) {
      return NextResponse.json({ erro: "Erro ao buscar financeiro no Supabase.", detalhe: erro.message }, { status: 500 });
    }

    const pagamentosPorVenda = new Map<string, Registro[]>();
    (pagamentosResp.data || []).forEach((pagamento: Registro) => {
      const lista = pagamentosPorVenda.get(String(pagamento.venda_id)) || [];
      lista.push(pagamento);
      pagamentosPorVenda.set(String(pagamento.venda_id), lista);
    });

    const itensPorVenda = new Map<string, Registro[]>();
    (itensResp.data || []).forEach((item: Registro) => {
      const lista = itensPorVenda.get(String(item.venda_id)) || [];
      lista.push(item);
      itensPorVenda.set(String(item.venda_id), lista);
    });

    const vendasDetalhadas = (vendasResp.data || []).map((venda: Registro) =>
      mapVenda(venda, pagamentosPorVenda.get(String(venda.id)) || [], itensPorVenda.get(String(venda.id)) || [])
    );

    const lancamentos = lancamentosResp.data || [];

    const porTipo = (tipo: string) =>
      lancamentos
        .filter((item: Registro) => item.tipo === tipo)
        .map((item: Registro) => ({ ...(item.dados || {}), id: item.id, data: item.data, valor: numeroSeguro(item.valor) }));

    return NextResponse.json({
      entradas: porTipo("entrada"),
      vendasDetalhadas,
      saidas: porTipo("saida"),
      contasReceber: porTipo("conta_receber"),
      folhaPagamento: porTipo("folha"),
      investimentos: porTipo("investimento"),
      colaboradores: (colaboradoresResp.data || []).map((colaborador: Registro) => ({
        ...(colaborador.dados || {}),
        id: colaborador.id,
        nome: colaborador.nome,
        percentualComissao: numeroSeguro(colaborador.percentual_comissao),
        telefone: colaborador.telefone || "",
        observacoes: colaborador.observacoes || "",
        ativo: colaborador.ativo !== false,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        erro: "Erro interno ao buscar financeiro.",
        detalhe: error?.message || "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entradas = [
      ...(Array.isArray(body.entradas) ? body.entradas : []),
      ...(body.entrada ? [body.entrada] : []),
    ];

    const vendas = [
      ...(Array.isArray(body.vendasDetalhadas) ? body.vendasDetalhadas : []),
      ...(body.vendaDetalhada ? [body.vendaDetalhada] : []),
      ...(body.venda ? [body.venda] : []),
    ];

    const saidas = [
      ...(Array.isArray(body.saidas) ? body.saidas : []),
      ...(body.saida ? [body.saida] : []),
    ];
    const contasReceber = [
      ...(Array.isArray(body.contasReceber) ? body.contasReceber : []),
      ...(body.contaReceber ? [body.contaReceber] : []),
    ];
    const folha = [
      ...(Array.isArray(body.folhaPagamento) ? body.folhaPagamento : Array.isArray(body.folha) ? body.folha : []),
      ...(body.folhaItem ? [body.folhaItem] : []),
      ...(body.folha && !Array.isArray(body.folha) ? [body.folha] : []),
    ];
    const investimentos = [
      ...(Array.isArray(body.investimentos) ? body.investimentos : []),
      ...(body.investimento ? [body.investimento] : []),
    ];
    const colaboradores = Array.isArray(body.colaboradores) ? body.colaboradores : [];

    await Promise.all([
      upsertLancamentos("entrada", entradas),
      upsertLancamentos("saida", saidas),
      upsertLancamentos("conta_receber", contasReceber),
      upsertLancamentos("folha", folha),
      upsertLancamentos("investimento", investimentos),
      upsertVendas(vendas),
      upsertColaboradores(colaboradores),
    ]);

    return NextResponse.json({
      ok: true,
      total: entradas.length + vendas.length + saidas.length + contasReceber.length + folha.length + investimentos.length + colaboradores.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        erro: "Erro interno ao salvar financeiro no Supabase.",
        detalhe: error?.message || "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}


export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = String(body?.id || "");
    const tipo = String(body?.tipo || "");

    if (!id || !tipo) {
      return NextResponse.json({ erro: "Informe id e tipo do lançamento." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("financeiro_lancamentos")
      .delete()
      .eq("id", id)
      .eq("tipo", tipo)
      .eq("restaurante_id", RESTAURANTE_ID);

    if (error) {
      return NextResponse.json({ erro: "Erro ao remover lançamento.", detalhe: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        erro: "Erro interno ao remover lançamento.",
        detalhe: error?.message || "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}
