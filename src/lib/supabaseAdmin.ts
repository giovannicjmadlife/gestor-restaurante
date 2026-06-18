import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedUrl = "";
let cachedKey = "";

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL não configurada.");
  }

  if (!supabaseKey) {
    throw new Error("SUPABASE_SECRET_KEY não configurada.");
  }

  if (cachedClient && cachedUrl === supabaseUrl && cachedKey === supabaseKey) {
    return cachedClient;
  }

  cachedUrl = supabaseUrl;
  cachedKey = supabaseKey;
  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "gestor-restaurante-server",
      },
    },
  });

  return cachedClient;
}
