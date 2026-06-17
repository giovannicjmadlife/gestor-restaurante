import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTAURANTE_ID = process.env.RESTAURANTE_ID || "samambaia";

type Registro = Record<string, any>;

function numeroSeguro(valor: any): number {
  const numero = Number(String(valor ?? 0).replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizarColaborador(colaborador: Registro) {
  const id = String(colaborador.id || uid());

  return {
    id,
    restaurante_id: RESTAURANTE_ID,
    nome: String(colaborador.nome || "Sem nome").trim(),
    percentual_comissao: numeroSeguro(colaborador.percentualComissao || colaborador.percentual_comissao),
    telefone: String(colaborador.telefone || ""),
    observacoes: String(colaborador.observacoes || ""),
    ativo: colaborador.ativo !== false,
    dados: { ...colaborador, id },
    atualizado_em: new Date().toISOString(),
  };
}

function mapColaborador(row: Registro) {
  return {
    ...(row.dados || {}),
    id: row.id,
    nome: row.nome,
    percentualComissao: numeroSeguro(row.percentual_comissao),
    telefone: row.telefone || "",
    observacoes: row.observacoes || "",
    ativo: row.ativo !== false,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("financeiro_colaboradores")
      .select("*")
      .eq("restaurante_id", RESTAURANTE_ID)
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json({ erro: "Erro ao buscar colaboradores.", detalhe: error.message }, { status: 500 });
    }

    return NextResponse.json((data || []).map(mapColaborador));
  } catch (error: any) {
    return NextResponse.json({ erro: "Erro interno ao buscar colaboradores.", detalhe: error?.message || "Erro desconhecido." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const colaboradores = Array.isArray(body) ? body : Array.isArray(body.colaboradores) ? body.colaboradores : [body.colaborador || body];

    const linhas = colaboradores.filter(Boolean).map(normalizarColaborador);

    if (linhas.length === 0) {
      return NextResponse.json({ erro: "Nenhum colaborador recebido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("financeiro_colaboradores")
      .upsert(linhas, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ erro: "Erro ao salvar colaboradores.", detalhe: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, total: linhas.length });
  } catch (error: any) {
    return NextResponse.json({ erro: "Erro interno ao salvar colaboradores.", detalhe: error?.message || "Erro desconhecido." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = String(body?.id || "");

    if (!id) {
      return NextResponse.json({ erro: "ID do colaborador não informado." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("financeiro_colaboradores")
      .delete()
      .eq("id", id)
      .eq("restaurante_id", RESTAURANTE_ID);

    if (error) {
      return NextResponse.json({ erro: "Erro ao remover colaborador.", detalhe: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ erro: "Erro interno ao remover colaborador.", detalhe: error?.message || "Erro desconhecido." }, { status: 500 });
  }
}
