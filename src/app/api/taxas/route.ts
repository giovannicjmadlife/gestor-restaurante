import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTAURANTE_ID = process.env.RESTAURANTE_ID || "samambaia";

type Registro = Record<string, any>;

type CategoriaTaxa = "maquininha" | "delivery" | "entrega";

function numeroSeguro(valor: any): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  let texto = String(valor ?? 0)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizarTaxa(taxa: Registro, categoriaPadrao: CategoriaTaxa) {
  const id = String(taxa.id || uid());
  const categoria = String(taxa.categoria || taxa.tipoCadastro || categoriaPadrao).toLowerCase() as CategoriaTaxa;

  return {
    id,
    restaurante_id: RESTAURANTE_ID,
    categoria,
    nome: String(taxa.nome || taxa.descricao || categoria).trim(),
    tipo: String(taxa.tipo || (categoria === "entrega" ? "Valor fixo" : "Percentual")),
    valor: numeroSeguro(taxa.valor || taxa.percentual || taxa.taxa || taxa.porcentagem),
    ativo: taxa.ativo !== false,
    dados: { ...taxa, id, categoria, tipoCadastro: categoria },
    atualizado_em: new Date().toISOString(),
  };
}

function mapTaxa(row: Registro) {
  return {
    ...(row.dados || {}),
    id: row.id,
    categoria: row.categoria,
    nome: row.nome,
    tipo: row.tipo,
    valor: numeroSeguro(row.valor),
    percentual: row.tipo === "Percentual" ? numeroSeguro(row.valor) : undefined,
    ativo: row.ativo !== false,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("financeiro_taxas")
      .select("*")
      .eq("restaurante_id", RESTAURANTE_ID)
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: "Erro ao buscar taxas.", detalhe: error.message }, { status: 500 });
    }

    const taxas = (data || []).map(mapTaxa);

    return NextResponse.json({
      maquininhas: taxas.filter((taxa: Registro) => taxa.categoria === "maquininha"),
      delivery: taxas.filter((taxa: Registro) => taxa.categoria === "delivery"),
      entrega: taxas.find((taxa: Registro) => taxa.categoria === "entrega") || null,
      todas: taxas,
    });
  } catch (error: any) {
    return NextResponse.json({ erro: "Erro interno ao buscar taxas.", detalhe: error?.message || "Erro desconhecido." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const maquininhas = Array.isArray(body.maquininhas) ? body.maquininhas.map((taxa: Registro) => normalizarTaxa(taxa, "maquininha")) : [];
    const delivery = Array.isArray(body.delivery) ? body.delivery.map((taxa: Registro) => normalizarTaxa(taxa, "delivery")) : [];
    const entrega = body.entrega ? [normalizarTaxa({ ...body.entrega, id: body.entrega.id || "taxa-entrega-padrao", nome: body.entrega.nome || "Taxa de entrega", tipo: "Valor fixo" }, "entrega")] : [];
    const avulsas = Array.isArray(body.taxas) ? body.taxas.map((taxa: Registro) => normalizarTaxa(taxa, taxa.categoria || "maquininha")) : [];

    const linhas = [...maquininhas, ...delivery, ...entrega, ...avulsas];

    if (linhas.length === 0) {
      return NextResponse.json({ erro: "Nenhuma taxa recebida." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("financeiro_taxas")
      .upsert(linhas, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ erro: "Erro ao salvar taxas.", detalhe: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, total: linhas.length });
  } catch (error: any) {
    return NextResponse.json({ erro: "Erro interno ao salvar taxas.", detalhe: error?.message || "Erro desconhecido." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = String(body?.id || "");

    if (!id) {
      return NextResponse.json({ erro: "ID da taxa não informado." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("financeiro_taxas")
      .delete()
      .eq("id", id)
      .eq("restaurante_id", RESTAURANTE_ID);

    if (error) {
      return NextResponse.json({ erro: "Erro ao remover taxa.", detalhe: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ erro: "Erro interno ao remover taxa.", detalhe: error?.message || "Erro desconhecido." }, { status: 500 });
  }
}
