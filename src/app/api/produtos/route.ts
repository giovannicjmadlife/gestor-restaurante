import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const RESTAURANTE_ID = process.env.RESTAURANTE_ID || "samambaia";

type ProdutoLocal = Record<string, any>;

function numeroSeguro(valor: any): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarProduto(produto: ProdutoLocal) {
  const id = String(produto.id || crypto.randomUUID());

  const nome = String(produto.nome || "SEM NOME")
    .trim()
    .toUpperCase();

  const dados = {
    ...produto,
    id,
    nome,
  };

  return {
    id,
    restaurante_id: RESTAURANTE_ID,
    nome,
    categoria_principal:
      produto.categoriaPrincipal ||
      produto.categoria_principal ||
      produto.categoria ||
      null,
    grupo: produto.grupo || produto.tipo || null,
    subgrupo: produto.subgrupo || produto.subcategoria || null,
    opcao: produto.opcao || null,
    valor: numeroSeguro(produto.valor ?? produto.preco ?? produto.precoVenda),
    ativo: produto.ativo !== false,
    dados,
    atualizado_em: new Date().toISOString(),
  };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("produtos")
    .select("dados")
    .eq("restaurante_id", RESTAURANTE_ID)
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json(
      { erro: "Erro ao buscar produtos.", detalhe: error.message },
      { status: 500 }
    );
  }

  const produtos = (data || []).map((item) => item.dados);

  return NextResponse.json(produtos);
}

export async function POST(request: Request) {
  const body = await request.json();

  const produtos = Array.isArray(body) ? body : [body];

  if (!produtos.length) {
    return NextResponse.json(
      { erro: "Nenhum produto recebido." },
      { status: 400 }
    );
  }

  const linhas = produtos.map(normalizarProduto);

  const { error } = await supabaseAdmin
    .from("produtos")
    .upsert(linhas, { onConflict: "id" });

  if (error) {
    return NextResponse.json(
      { erro: "Erro ao salvar produtos.", detalhe: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    total: linhas.length,
  });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const id = body?.id;

  if (!id) {
    return NextResponse.json(
      { erro: "ID do produto não informado." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("produtos")
    .delete()
    .eq("id", String(id))
    .eq("restaurante_id", RESTAURANTE_ID);

  if (error) {
    return NextResponse.json(
      { erro: "Erro ao excluir produto.", detalhe: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}