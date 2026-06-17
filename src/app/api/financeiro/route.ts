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

function pagamentosDoRegistro(registro: Registro) {
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
        const valorTaxa = arredondar2(numeroSeguro(pagamento.valorTaxa) || numeroSeguro(pagamento.taxaDescontada));
        const valorLiquido =
          numeroSeguro(pagamento.valorLiquido) > 0
            ? arredondar2(numeroSeguro(pagamento.valorLiquido))
            : arredondar2(valorPago - valorTaxa);

        return {
          id: String(pagamento.id || `${idRegistro(registro, "venda")}-pag-${index}`),
          forma: String(pagamento.forma || pagamento.formaPagamento || "Não informado"),
          valorPago,
          taxaPercentual: numeroSeguro(pagamento.taxaPercentual),
          valorTaxa,
          taxaDescontada: valorTaxa,
          valorLiquido,
        };
      })
      .filter((pagamento: Registro) => numeroSeguro(pagamento.valorPago) > 0);
  }

  const bruto = valorBruto(registro);
  const taxa = arredondar2(numeroSeguro(registro.taxaDescontada) + numeroSeguro(registro.taxaDeliveryDescontada));
  const liquido = numeroSeguro(registro.valorLiquido) > 0 ? arredondar2(numeroSeguro(registro.valorLiquido)) : arredondar2(bruto - taxa);

  return [
    {
      id: `${idRegistro(registro, "venda")}-pag-0`,
      forma: String(registro.formaPagamento || registro.formaRecebimento || registro.forma || "Não informado"),
      valorPago: bruto,
      taxaPercentual: numeroSeguro(registro.taxaPercentual),
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

function totaisDaVenda(registro: Registro) {
  const pagamentos = pagamentosDoRegistro(registro);
  const valorTaxas = arredondar2(pagamentos.reduce((total, pagamento) => total + numeroSeguro(pagamento.valorTaxa), 0));
  const bruto = valorBruto(registro);
  const liquidoInformado = numeroSeguro(registro.valorLiquido);
  const liquido = liquidoInformado > 0 ? arredondar2(liquidoInformado) : arredondar2(bruto - valorTaxas);

  return { pagamentos, valorTaxas, bruto, liquido };
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

  const linhasVendas = lista.map((venda) => {
    const id = idRegistro(venda, "venda");
    const { pagamentos, valorTaxas, bruto, liquido } = totaisDaVenda(venda);

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
      dados: { ...venda, id, pagamentos },
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error: vendaError } = await supabase
    .from("financeiro_vendas")
    .upsert(linhasVendas, { onConflict: "id" });

  if (vendaError) throw vendaError;

  for (const venda of lista) {
    const vendaId = idRegistro(venda, "venda");
    const pagamentos = pagamentosDoRegistro(venda).map((pagamento) => ({
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
      supabase.from("financeiro_vendas").select("*").eq("restaurante_id", RESTAURANTE_ID).order("data_hora", { ascending: false }),
      supabase.from("financeiro_venda_pagamentos").select("*").eq("restaurante_id", RESTAURANTE_ID),
      supabase.from("financeiro_venda_itens").select("*").eq("restaurante_id", RESTAURANTE_ID),
      supabase.from("financeiro_lancamentos").select("*").eq("restaurante_id", RESTAURANTE_ID).order("data_hora", { ascending: false }),
      supabase.from("financeiro_colaboradores").select("*").eq("restaurante_id", RESTAURANTE_ID).order("nome", { ascending: true }),
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

    const saidas = Array.isArray(body.saidas) ? body.saidas : [];
    const contasReceber = [
      ...(Array.isArray(body.contasReceber) ? body.contasReceber : []),
      ...(body.contaReceber ? [body.contaReceber] : []),
    ];
    const folha = Array.isArray(body.folhaPagamento) ? body.folhaPagamento : Array.isArray(body.folha) ? body.folha : [];
    const colaboradores = Array.isArray(body.colaboradores) ? body.colaboradores : [];

    await Promise.all([
      upsertLancamentos("entrada", entradas),
      upsertLancamentos("saida", saidas),
      upsertLancamentos("conta_receber", contasReceber),
      upsertLancamentos("folha", folha),
      upsertVendas(vendas),
      upsertColaboradores(colaboradores),
    ]);

    return NextResponse.json({
      ok: true,
      total: entradas.length + vendas.length + saidas.length + contasReceber.length + folha.length + colaboradores.length,
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
