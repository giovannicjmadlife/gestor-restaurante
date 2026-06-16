import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { criarTokenSessao, getSessaoCookieName } from "@/lib/sessionCookie";

export const dynamic = "force-dynamic";

type UsuarioLogin = {
  id: string;
  nome: string;
  email: string;
  perfil: "ADM" | "CAIXA";
  restaurante_id: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email = String(body?.email || "").trim().toLowerCase();
  const senha = String(body?.senha || "");
  const lembrar = body?.lembrar !== false;

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

  const usuario = Array.isArray(data) ? (data[0] as UsuarioLogin | undefined) : null;

  if (!usuario) {
    return NextResponse.json(
      { erro: "Login ou senha inválidos." },
      { status: 401 }
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

  const response = NextResponse.json({
    ok: true,
    usuario: {
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    },
    destino: usuario.perfil === "CAIXA" ? "/pdv" : "/",
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
}
