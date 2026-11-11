"use client";

import { getSupabase } from "./supabase/client";

export const MIN_PASSWORD = 8;

/** Turn Supabase auth errors into friendly, non-technical messages. */
function friendly(error: { message?: string; code?: string; status?: number } | null): string | null {
  if (!error) return null;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "That email and password don't match. Want to try again?";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "Almost there! Please confirm your email first. Check your inbox for our link.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "There's already an account with that email. Try signing in instead.";
  if (code === "weak_password" || msg.includes("password should")) return `Please choose a stronger password (at least ${MIN_PASSWORD} characters).`;
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429)
    return "Too many tries in a short time. Please wait a minute and try again.";
  if (code === "same_password") return "That's your current password. Pick a new one.";
  if (msg.includes("fetch") || msg.includes("network")) return "We couldn't reach the server. Check your connection and try again.";
  return "Something went wrong on our end. Please try again.";
}

function client() {
  const sb = getSupabase();
  if (!sb) throw new Error("Accounts aren't set up on this site yet.");
  return sb;
}

const callbackUrl = (next: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  return { error: friendly(error) };
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: name.trim() },
      emailRedirectTo: callbackUrl("/planner"),
    },
  });
  // With email confirmation on (Supabase's default), there's no session until they click the link.
  return { error: friendly(error), needsConfirmation: !error && !data.session };
}

export async function sendPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: callbackUrl("/account/reset"),
  });
  return { error: friendly(error) };
}

export async function updatePassword(password: string) {
  const { error } = await client().auth.updateUser({ password });
  return { error: friendly(error) };
}
