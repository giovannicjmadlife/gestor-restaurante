const CHAVE_LOCAL = "gestor-restaurante-produtos";

export type Produto = Record<string, any>;

export function buscarProdutosLocais(): Produto[] {
  if (typeof window === "undefined") return [];

  try {
    const salvos = localStorage.getItem(CHAVE_LOCAL);
    return salvos ? JSON.parse(salvos) : [];
  } catch {
    return [];
  }
}

export function salvarProdutosLocais(produtos: Produto[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(CHAVE_LOCAL, JSON.stringify(produtos));
}

export async function buscarProdutos(): Promise<Produto[]> {
  try {
    const resposta = await fetch("/api/produtos", {
      cache: "no-store",
    });

    if (!resposta.ok) {
      throw new Error("Falha ao buscar produtos no Supabase.");
    }

    const produtos = await resposta.json();

    if (Array.isArray(produtos)) {
      salvarProdutosLocais(produtos);
      return produtos;
    }

    return buscarProdutosLocais();
  } catch {
    return buscarProdutosLocais();
  }
}

export async function salvarProdutos(produtos: Produto[]) {
  salvarProdutosLocais(produtos);

  const resposta = await fetch("/api/produtos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(produtos),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.detalhe || "Erro ao salvar produtos no Supabase.");
  }

  return resposta.json();
}

export async function salvarProduto(produto: Produto) {
  const resposta = await fetch("/api/produtos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(produto),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.detalhe || "Erro ao salvar produto no Supabase.");
  }

  return resposta.json();
}

export async function excluirProdutoBanco(id: string) {
  const resposta = await fetch("/api/produtos", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.detalhe || "Erro ao excluir produto no Supabase.");
  }

  return resposta.json();
}