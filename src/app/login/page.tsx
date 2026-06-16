"use client";

import { FormEvent, useEffect, useState } from "react";

type UsuarioSessao = {
  nome: string;
  email: string;
  perfil: "ADM" | "CAIXA";
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [redirectDestino, setRedirectDestino] = useState("");

  useEffect(() => {
    const emailSalvo = localStorage.getItem("gestor-restaurante-login-email");

    if (emailSalvo) {
      setEmail(emailSalvo);
    }

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "";

    setRedirectDestino(redirect);
  }, []);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          senha,
          lembrar,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado?.erro || "Não foi possível entrar.");
      }

      const usuario = resultado.usuario as UsuarioSessao;

      localStorage.setItem("gestor-restaurante-login-email", email);
      localStorage.setItem("gestor-restaurante-usuario", JSON.stringify(usuario));

      if (usuario.perfil === "ADM") {
        window.location.href = redirectDestino || "/";
        return;
      }

      window.location.href = "/pdv";
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao fazer login.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-4 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111111] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <img
            src="/logo-01.png"
            alt="Samambaia Restaurante"
            className="mx-auto mb-4 h-24 w-24 object-contain"
          />

          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#f97316]">
            Gestor Restaurante
          </p>

          <h1 className="mt-3 text-3xl font-black">Entrar no sistema</h1>

          <p className="mt-2 text-sm text-white/60">
            Use o acesso do ADM ou do Caixa.
          </p>

          {redirectDestino && (
            <div className="mt-4 rounded-xl border border-[#f97316]/30 bg-[#f97316]/10 p-3 text-xs font-bold text-[#fed7aa]">
              Para acessar o painel, entre com o login de ADM.
            </div>
          )}
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-white/80">
              Login / e-mail
            </label>
            <input
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@samambaia.local"
              autoComplete="username"
              className="w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#f97316]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-white/80">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#f97316]"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-semibold text-white/80">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(event) => setLembrar(event.target.checked)}
              className="h-4 w-4"
            />
            Manter conectado neste computador
          </label>

          {erro && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-[#f97316] px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-[#ea580c] disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-white/5 p-4 text-xs leading-5 text-white/50">
          <strong className="text-white/70">Acesso Caixa:</strong> entra direto no PDV.
          <br />
          <strong className="text-white/70">Acesso ADM:</strong> entra no painel completo.
        </div>
      </section>
    </main>
  );
}