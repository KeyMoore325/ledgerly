/**
 * Supabase settings come from public env vars. When they're missing, the app
 * runs in guest-only mode (budgets saved in the browser) and hides sign-in.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Newer projects issue a "publishable" key; older ones call it the "anon" key. Either works.
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/** Only allow redirects back into this site (prevents open-redirect tricks). */
export function safeNext(next: string | null | undefined, fallback = "/planner") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
