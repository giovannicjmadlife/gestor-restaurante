import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessaoCookieName, lerSessaoDoToken } from "@/lib/sessionCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessaoCookieName())?.value;
    const sessao = await lerSessaoDoToken(token);

    if (!sessao) {
      return NextResponse.json({
        logado: false,
        usuario: null,
      });
    }

    return NextResponse.json({
      logado: true,
      usuario: {
        id: sessao.id,
        nome: sessao.nome,
        email: sessao.email,
        perfil: sessao.perfil,
        restaurante_id: sessao.restaurante_id,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        logado: false,
        usuario: null,
        erro: error?.message || "Erro ao ler sessão.",
      },
      { status: 500 }
    );
  }
}