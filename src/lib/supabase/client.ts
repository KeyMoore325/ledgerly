"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when Supabase isn't configured (guest-only mode). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === "undefined") return null;
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
