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
    pathname === "/api/sessao" ||
    pathname === "/api/logout"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ehArquivoPublico(pathname) || rotasPublicas.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getSessaoCookieName())?.value;
  const sessao = await lerSessaoDoToken(token);

  if (!sessao) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(sessao.perfil === "CAIXA" ? "/pdv" : "/", request.url));
  }

  if (sessao.perfil === "CAIXA" && !rotaPermitidaParaCaixa(pathname)) {
    return NextResponse.redirect(new URL("/pdv", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
