import { NextRequest, NextResponse } from "next/server";
import { getSessaoCookieName, lerSessaoDoToken } from "@/lib/sessionCookie";

const rotasPublicas = [
  "/login",
  "/api/login",
  "/api/logout",
  "/favicon.ico",
  "/logo-01.png",
];

function ehArquivoPublico(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|css|js)$/)
  );
}

function rotaPermitidaParaCaixa(pathname: string) {
  return (
    pathname === "/pdv" ||
    pathname.startsWith("/pdv/") ||
    pathname === "/api/produtos" ||
    pathname === "/api/financeiro" ||
    pathname === "/api/colaboradores" ||
    pathname === "/api/taxas" ||
    pathname === "/api/sessao" ||
    pathname === "/api/logout"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // arquivos públicos
  if (ehArquivoPublico(pathname) || rotasPublicas.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getSessaoCookieName())?.value;
  const sessao = await lerSessaoDoToken(token);

  // sem login → login
  if (!sessao) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // se já logado e tentar login de novo
  if (pathname === "/login") {
    return NextResponse.redirect(
      new URL(sessao.perfil === "CAIXA" ? "/pdv" : "/", request.url)
    );
  }

  // bloqueio CAIXA
  if (sessao.perfil === "CAIXA" && !rotaPermitidaParaCaixa(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("adm", "1");
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  // ✅ ESSA LINHA ESTAVA FALTANDO
  return NextResponse.next();
}