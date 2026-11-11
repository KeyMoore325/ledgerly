"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actions, profileInitial, useStore } from "@/lib/store";
import { analyze, formatMoney, scoreMood } from "@/lib/budget";
import { Icon } from "./Icon";
import { NewPasswordForm } from "./NewPasswordForm";

const COLORS = ["#2563EB", "#0EA5E9", "#7C3AED", "#059669", "#D97706", "#DB2777"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "MXN", "ZAR", "NGN"];

export function Profiles() {
  const { profiles, active, ready, mode, user, accountsEnabled } = useStore();
  const cloud = mode === "cloud";
  const router = useRouter();
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newName, setNewName] = useState<string | null>(null); // null = follow the active profile's name
  const [withSample, setWithSample] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready || !active) return <div className="card"><p className="muted" style={{ margin: 0 }}>Getting your profiles ready…</p></div>;

  const exportProfile = () => {
    const blob = new Blob([actions.exportActive()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${active.budgetName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "budget"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = async (file: File) => {
    try {
      actions.importProfile(await file.text());
      setMsg({ kind: "success", text: `All set! "${file.name}" was added as a new budget.` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "That file couldn't be imported." });
    }
  };

  const personName = newName ?? active.name;

  return (
    <div className="planner">
      <div className="stack">
        <section className="card" aria-labelledby="edit-h">
          <div className="card-head">
            <h2 id="edit-h" className="section-title"><span aria-hidden="true">👤</span> About you</h2>
            <Link href="/planner" className="btn btn-primary btn-sm">Back to planner <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="stack">
            <div className="field">
              <label htmlFor="p-name">What should we call you?</label>
              <input id="p-name" className="input" value={active.name} maxLength={40} autoComplete="nickname"
                placeholder="e.g. Sam" aria-describedby="p-name-hint"
                onChange={(e) => actions.updateProfile(active.id, { name: e.target.value })} />
              <span id="p-name-hint" className="hint">A first name or nickname works great. We&apos;ll use it to say hi.</span>
            </div>
            <div className="field">
              <label htmlFor="p-budget">Budget name</label>
              <input id="p-budget" className="input" value={active.budgetName} maxLength={60}
                placeholder="e.g. Household budget" aria-describedby="p-budget-hint"
                onChange={(e) => actions.updateProfile(active.id, { budgetName: e.target.value })}
                onBlur={(e) => { if (!e.target.value.trim()) actions.updateProfile(active.id, { budgetName: "My budget" }); }} />
              <span id="p-budget-hint" className="hint">Helps you tell your budgets apart, like &ldquo;Household&rdquo; or &ldquo;If I move to Denver.&rdquo;</span>
            </div>
            {cloud && user ? (
              <div className="field">
                <label htmlFor="p-email">Account email</label>
                <input id="p-email" className="input" type="email" value={user.email} readOnly aria-describedby="p-email-hint" />
                <span id="p-email-hint" className="hint">This is the email you sign in with.</span>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="p-email">Email (optional)</label>
                <input id="p-email" className="input" type="email" autoComplete="email" value={active.email}
                  aria-describedby="p-email-hint" onChange={(e) => actions.updateProfile(active.id, { email: e.target.value })} />
                <span id="p-email-hint" className="hint">Only used to fill in the contact form for you. It stays on this device.</span>
              </div>
            )}
            <div className="field">
              <label htmlFor="p-cur">Currency</label>
              <select id="p-cur" className="select" value={active.currency}
                onChange={(e) => actions.updateProfile(active.id, { currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 8 }}>Pick a color</legend>
              <div className="swatches" role="radiogroup" aria-label="Profile color">
                {COLORS.map((c) => (
                  <button key={c} type="button" className="swatch" role="radio" aria-checked={active.color === c}
                    aria-label={c} style={{ background: c }} onClick={() => actions.updateProfile(active.id, { color: c })} />
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="card" aria-labelledby="data-h">
          <h2 id="data-h" className="section-title"><span aria-hidden="true">📦</span> Back up or move a budget</h2>
          <p className="hint" style={{ marginTop: 8 }}>
            {cloud
              ? "Your budgets are saved to your account. You can still save a copy as a file, or open one you saved earlier."
              : "Your budgets live in this browser. Save a copy to keep it safe, or open it on another device."}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportProfile}>
              <Icon name="download" size={16} /> Save a copy
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Open a saved copy
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importProfile(f); e.target.value = ""; }} />
          </div>
          {msg && <p className={`notice ${msg.kind}`} role="status" style={{ marginTop: 12, marginBottom: 0 }}>{msg.text}</p>}
        </section>

        {cloud && user ? (
          <section className="card" aria-labelledby="acct-h">
            <h2 id="acct-h" className="section-title"><span aria-hidden="true">🔐</span> Your account</h2>
            <p className="hint" style={{ marginTop: 8 }}>Signed in as <strong>{user.email}</strong>.</p>
            <details className="acct-details">
              <summary>Change your password</summary>
              <NewPasswordForm compact />
            </details>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={async () => { await actions.signOut(); router.push("/"); }}>
                Sign out
              </button>
            </div>
          </section>
        ) : accountsEnabled ? (
          <section className="card" aria-labelledby="acct-h">
            <h2 id="acct-h" className="section-title"><span aria-hidden="true">☁️</span> Save your budgets to an account</h2>
            <p className="hint" style={{ marginTop: 8 }}>
              A free account keeps your budgets safe and lets you check your progress from any device.
              We&apos;ll bring the budgets on this device along with you.
            </p>
            <div className="btn-row">
              <Link href="/login?mode=signup&next=/profile" className="btn btn-primary btn-sm">Create an account</Link>
              <Link href="/login?next=/profile" className="btn btn-ghost btn-sm">I already have one</Link>
            </div>
          </section>
        ) : null}
      </div>

      <div className="stack">
        <section className="card" aria-labelledby="all-h">
          <h2 id="all-h" className="section-title" style={{ marginBottom: 14 }}><span aria-hidden="true">🗂️</span> Your budgets</h2>
          <ul className="profile-list">
            {profiles.map((p) => {
              const a = analyze(p.budget, p.currency);
              const mood = scoreMood(a.healthScore, a.income > 0);
              const isActive = p.id === active.id;
              const label = p.budgetName || "My budget";
              return (
                <li key={p.id} className={`profile-item ${isActive ? "active" : ""}`}>
                  <span className="avatar" style={{ background: p.color }} aria-hidden="true">{profileInitial(p)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                    <div className="small muted">
                      {p.name ? `${p.name} · ` : ""}{mood.label}
                      {a.income > 0 && ` · ${formatMoney(Math.abs(a.available), p.currency)} ${a.available >= 0 ? "left over" : "short"}`}
                    </div>
                  </div>
                  {isActive ? (
                    <span className="badge primary">Open now</span>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.switchProfile(p.id)}>
                      Open<span className="sr-only"> {label}</span>
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost icon-btn" aria-label={`Delete ${label}`}
                    onClick={() => { if (confirm(`Delete "${label}"? This can't be undone.`)) actions.deleteProfile(p.id); }}>
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card" aria-labelledby="new-h">
          <h2 id="new-h" className="section-title"><span aria-hidden="true">✨</span> Start another budget</h2>
          <p className="hint" style={{ marginTop: 8 }}>Great for a shared household plan, or to try out a &ldquo;what if&rdquo; without touching your main one.</p>
          <form className="stack" onSubmit={(e) => {
            e.preventDefault();
            actions.createProfile({ budgetName: newBudgetName.trim(), name: personName.trim() }, withSample);
            setNewBudgetName("");
            setNewName(null);
            setMsg(null);
          }}>
            <div className="field">
              <label htmlFor="new-budget">Budget name</label>
              <input id="new-budget" className="input" value={newBudgetName} maxLength={60} placeholder="e.g. Household, or What if I move"
                onChange={(e) => setNewBudgetName(e.target.value)} />
            </div>
            {!cloud && (
              <div className="field">
                <label htmlFor="new-name">What should we call you? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input id="new-name" className="input" value={personName} maxLength={40} placeholder="e.g. Sam" autoComplete="nickname"
                  onChange={(e) => setNewName(e.target.value)} />
              </div>
            )}
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: "0.92rem" }}>
              <input type="checkbox" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} style={{ width: 18, height: 18 }} />
              Start with the example numbers
            </label>
            <div><button type="submit" className="btn btn-primary"><Icon name="plus" size={18} /> Create budget</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}
