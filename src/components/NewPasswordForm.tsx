"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MIN_PASSWORD, updatePassword } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { PasswordInput } from "./PasswordInput";

/** Set a new password. Used after a reset link, and from the profile page. */
export function NewPasswordForm({ redirectTo, compact = false }: { redirectTo?: string; compact?: boolean }) {
  const router = useRouter();
  const { user, mode } = useStore();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  if (mode === "loading") return <p className="muted small" style={{ margin: 0 }}>One moment…</p>;
  if (!user) {
    return (
      <p style={{ margin: 0 }}>
        This reset link has expired or was already used. <Link href="/login?mode=forgot">Send a new one</Link>.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setStatus({ kind: "error", text: `Use at least ${MIN_PASSWORD} characters.` });
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setStatus({ kind: "error", text: error });
      return;
    }
    setPassword("");
    setStatus({ kind: "success", text: "Your new password is all set. ✅" });
    if (redirectTo) setTimeout(() => router.push(redirectTo), 1200);
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="new-password">{compact ? "New password" : "Choose a new password"}</label>
        <PasswordInput id="new-password" autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} aria-describedby="new-password-hint" />
        <span id="new-password-hint" className="hint">At least {MIN_PASSWORD} characters.</span>
      </div>
      <div>
        <button type="submit" className={`btn ${compact ? "btn-secondary btn-sm" : "btn-primary"}`} disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
      </div>
      <div aria-live="polite">
        {status && <p className={`notice ${status.kind}`} style={{ margin: 0 }}>{status.text}</p>}
      </div>
    </form>
  );
}
