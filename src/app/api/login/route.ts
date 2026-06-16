import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { criarTokenSessao, getSessaoCookieName } from "@/lib/sessionCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsuarioLogin = {
  id: string;
  nome: string;
  email: string;
  perfil: "ADM" | "CAIXA";
  restaurante_id: string;
};

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const body = await request.json().catch(() => null);

    const email = String(body?.email || body?.login || "")
      .trim()
      .toLowerCase();

    const senha = String(body?.senha || "");

    const lembrar =
      body?.lembrar !== false &&
      body?.manterConectado !== false &&
      body?.remember !== false;

    if (!email || !senha) {
      return NextResponse.json(
        { erro: "Informe login e senha." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc("validar_login_sistema", {
      p_email: email,
      p_senha: senha,
    });

    if (error) {
      return NextResponse.json(
        { erro: "Erro ao validar login.", detalhe: error.message },
        { status: 500 }
      );
    }

    const usuario = Array.isArray(data)
      ? (data[0] as UsuarioLogin | undefined)
      : null;

    if (!usuario) {
      return NextResponse.json(
        { erro: "Login ou senha inválidos." },
        { status: 401 }
      );
    }

    if (usuario.perfil !== "ADM" && usuario.perfil !== "CAIXA") {
      return NextResponse.json(
        { erro: "Perfil de usuário inválido." },
        { status: 403 }
      );
    }

    const diasSessao = lembrar ? 30 : 1;

    const token = await criarTokenSessao(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        restaurante_id: usuario.restaurante_id,
      },
      diasSessao
    );

    const destino = usuario.perfil === "CAIXA" ? "/pdv" : "/";

    const response = NextResponse.json({
      ok: true,
      usuario: {
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
      destino,
      redirectTo: destino,
    });

    response.cookies.set({
      name: getSessaoCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: diasSessao * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        erro: "Erro interno no login.",
        detalhe: error?.message || "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}