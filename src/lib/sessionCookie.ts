export type PerfilUsuario = "ADM" | "CAIXA";

export type SessaoSistema = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  restaurante_id: string;
  exp: number;
};

const COOKIE_NAME = "gestor_sessao";

function getSecret() {
  const secret = process.env.SESSION_SECRET || "";

  if (!secret) {
    throw new Error("SESSION_SECRET não configurada.");
  }

  return secret;
}

function base64UrlEncode(text: string) {
  const encoded = btoa(unescape(encodeURIComponent(text)));

  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(text: string) {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");

  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  return decodeURIComponent(escape(atob(padded)));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function assinar(payloadBase64: string) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const assinatura = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadBase64)
  );

  return bytesToBase64Url(new Uint8Array(assinatura));
}

function compararSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;

  let resultado = 0;

  for (let i = 0; i < a.length; i++) {
    resultado |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return resultado === 0;
}

export function getSessaoCookieName() {
  return COOKIE_NAME;
}

export async function criarTokenSessao(
  usuario: Omit<SessaoSistema, "exp">,
  dias = 30
) {
  const payload: SessaoSistema = {
    ...usuario,
    exp: Date.now() + dias * 24 * 60 * 60 * 1000,
  };

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const assinatura = await assinar(payloadBase64);

  return `${payloadBase64}.${assinatura}`;
}

export async function lerSessaoDoToken(
  token?: string | null
): Promise<SessaoSistema | null> {
  try {
    if (!token || !token.includes(".")) {
      return null;
    }

    const [payloadBase64, assinaturaRecebida] = token.split(".");

    if (!payloadBase64 || !assinaturaRecebida) {
      return null;
    }

    const assinaturaCorreta = await assinar(payloadBase64);

    if (!compararSeguro(assinaturaCorreta, assinaturaRecebida)) {
      return null;
    }

    const sessao = JSON.parse(base64UrlDecode(payloadBase64)) as SessaoSistema;

    if (!sessao?.id || !sessao?.email || !sessao?.perfil || !sessao?.exp) {
      return null;
    }

    if (Date.now() > sessao.exp) {
      return null;
    }

    if (sessao.perfil !== "ADM" && sessao.perfil !== "CAIXA") {
      return null;
    }

    return sessao;
  } catch {
    return null;
  }
}