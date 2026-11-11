"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MIN_PASSWORD, sendPasswordReset, signIn, signUp } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PasswordInput } from "./PasswordInput";

type Mode = "signin" | "signup" | "forgot";
type Status = { kind: "error" | "success" | "info"; text: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ initialMode, next, initialError }: { initialMode: Mode; next: string; initialError?: string }) {
  const router = useRouter();
  const { user, mode: storeMode, accountsEnabled } = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(initialError ? { kind: "error", text: initialError } : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status) statusRef.current?.focus();
  }, [status]);

  if (!accountsEnabled) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>
          Accounts aren&apos;t switched on for this site yet. You can still use the{" "}
          <Link href="/planner">planner</Link>, and your budget saves right here in your browser.
        </p>
      </div>
    );
  }

  if (user && storeMode !== "loading") {
    return (
      <div className="card stack">
        <p style={{ margin: 0 }}>
          You&apos;re signed in{user.name ? ` as ${user.name}` : ""} ({user.email}). 👋
        </p>
        <div><Link href={next} className="btn btn-primary">Go to your planner</Link></div>
      </div>
    );
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setStatus(null);
    setErrors({});
  };

  function validate() {
    const e: Record<string, string> = {};
    if (mode === "signup" && !name.trim()) e.name = "What should we call you?";
    if (!EMAIL_RE.test(email.trim())) e.email = "Please enter a valid email address.";
    if (mode !== "forgot" && password.length < (mode === "signup" ? MIN_PASSWORD : 1))
      e.password = mode === "signup" ? `Use at least ${MIN_PASSWORD} characters.` : "Please enter your password.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`auth-${first}`)?.focus();
    return !first;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setStatus(null);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) setStatus({ kind: "error", text: error });
        else router.push(next);
      } else if (mode === "signup") {
        const { error, needsConfirmation } = await signUp(name, email, password);
        if (error) setStatus({ kind: "error", text: error });
        else if (needsConfirmation)
          setStatus({ kind: "success", text: `Welcome aboard, ${name.trim()}! 🎉 We sent a confirmation link to ${email.trim()}. Click it and you're all set.` });
        else router.push(next);
      } else {
        const { error } = await sendPasswordReset(email);
        setStatus(
          error
            ? { kind: "error", text: error }
            : { kind: "success", text: `If there's an account for ${email.trim()}, a reset link is on its way. Check your inbox (and spam folder, just in case).` },
        );
      }
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const field = (key: string) => ({
    id: `auth-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `auth-${key}-err` : undefined,
  });
  const err = (key: string) => errors[key] && <span id={`auth-${key}-err`} className="error-text">{errors[key]}</span>;

  const submitLabel = { signin: "Sign in", signup: "Create my account", forgot: "Send reset link" }[mode];

  return (
    <div className="card stack auth-card">
      {mode !== "forgot" ? (
        <div className="segmented auth-tabs" role="group" aria-label="Sign in or create an account">
          <button type="button" aria-pressed={mode === "signin"} onClick={() => switchMode("signin")}>Sign in</button>
          <button type="button" aria-pressed={mode === "signup"} onClick={() => switchMode("signup")}>Create account</button>
        </div>
      ) : (
        <div>
          <h2 className="section-title">Forgot your password?</h2>
          <p className="hint" style={{ margin: "6px 0 0" }}>No worries, it happens! Enter your email and we&apos;ll send you a link to pick a new one.</p>
        </div>
      )}

      <form className="stack" onSubmit={onSubmit} noValidate>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="auth-name">What should we call you?</label>
            <input className="input" autoComplete="nickname" placeholder="e.g. Sam" maxLength={40}
              value={name} onChange={(e) => setName(e.target.value)} {...field("name")} />
            {err("name")}
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input className="input" type="email" autoComplete="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)} {...field("email")} />
          {err("email")}
        </div>
        {mode !== "forgot" && (
          <div className="field">
            <span className="label-row" style={{ justifyContent: "space-between", display: "flex" }}>
              <label htmlFor="auth-password">Password</label>
              {mode === "signin" && (
                <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>
              )}
            </span>
            <PasswordInput
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              {...field("password")} id="auth-password"
              aria-describedby={[errors.password ? "auth-password-err" : "", mode === "signup" ? "auth-password-hint" : ""].filter(Boolean).join(" ") || undefined}
            />
            {mode === "signup" && <span id="auth-password-hint" className="hint">At least {MIN_PASSWORD} characters. A short phrase is easy to remember and hard to guess.</span>}
            {err("password")}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (<><span className="spinner" aria-hidden="true" /> One moment…</>) : submitLabel}
        </button>
      </form>

      <div ref={statusRef} tabIndex={-1} aria-live="polite">
        {status && <p className={`notice ${status.kind}`} style={{ margin: 0 }}>{status.text}</p>}
      </div>

      {mode === "forgot" ? (
        <p className="small muted" style={{ margin: 0 }}>
          Remembered it? <button type="button" className="link-btn" onClick={() => switchMode("signin")}>Back to sign in</button>
        </p>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {mode === "signup"
            ? "Your budgets will be saved to your account so you can pick up on any device. If you've already built one here, we'll bring it along."
            : "Just browsing? You can keep using the planner without an account."}
        </p>
      )}
    </div>
  );
}
