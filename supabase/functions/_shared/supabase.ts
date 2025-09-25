// Shared helpers for Supabase Edge Functions (Deno runtime)
// Chooses local vs cloud configuration safely at runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// deno-lint-ignore no-explicit-any
declare const Deno: any;

export function env(name: string, fallback = ""): string {
  const v = Deno?.env?.get?.(name);
  return (typeof v === "string" && v.length > 0) ? v : fallback;
}

export function getSupabaseAdmin() {
  const url = env("SUPABASE_URL_LOCAL") || env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY_LOCAL") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin env vars. Set SUPABASE_URL[_LOCAL] and SUPABASE_SERVICE_ROLE_KEY[_LOCAL].");
  }
  return createClient(url, serviceKey);
}

