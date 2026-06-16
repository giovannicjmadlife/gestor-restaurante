import { NextRequest, NextResponse } from "next/server";
import { getSessaoCookieName } from "@/lib/sessionCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function limparCookie(response: NextResponse) {
  response.cookies.set({
    name: getSessaoCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function POST() {
  return limparCookie(NextResponse.json({ ok: true }));
}

export async function GET(request: NextRequest) {
  return limparCookie(NextResponse.redirect(new URL("/login", request.url)));
}