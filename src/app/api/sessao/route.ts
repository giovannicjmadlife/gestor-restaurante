import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessaoCookieName, lerSessaoDoToken } from "@/lib/sessionCookie";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessaoCookieName())?.value;
  const sessao = await lerSessaoDoToken(token);

  if (!sessao) {
    return NextResponse.json({ logado: false }, { status: 401 });
  }

  return NextResponse.json({
    logado: true,
    usuario: {
      nome: sessao.nome,
      email: sessao.email,
      perfil: sessao.perfil,
    },
  });
}
