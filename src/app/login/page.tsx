import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a free account to keep your budgets safe and pick up on any device.",
  alternates: { canonical: "/login" },
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : sp.mode === "forgot" ? "forgot" : "signin";
  const error = sp.error?.slice(0, 200);

  return (
    <div className="container page" style={{ maxWidth: 480 }}>
      <header className="page-head" style={{ textAlign: "center" }}>
        <p className="eyebrow">Your account</p>
        <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)" }}>{mode === "signup" ? "Let's get you set up" : "Welcome back 👋"}</h1>
        <p style={{ margin: "0 auto" }}>
          {mode === "signup"
            ? "A free account keeps your budgets safe and lets you track your progress over time."
            : "Sign in to pick up right where you left off."}
        </p>
      </header>
      <AuthForm initialMode={mode} next={safeNext(sp.next)} initialError={error} />
    </div>
  );
}
