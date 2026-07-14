import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "Supabase не настроен: заполни VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env (см. README)"
  );
}

export const supabase = url && key ? createClient(url, key) : null;
