"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { actions, useStore } from "@/lib/store";
import { analyze, formatMoney } from "@/lib/budget";
import { Icon } from "./Icon";

const COLORS = ["#2563EB", "#0EA5E9", "#7C3AED", "#059669", "#D97706", "#DB2777"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "MXN", "ZAR", "NGN"];

export function Profiles() {
  const { profiles, active, ready } = useStore();
  const [newName, setNewName] = useState("");
  const [withSample, setWithSample] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready || !active) return <div className="card"><p className="muted" style={{ margin: 0 }}>Loading…</p></div>;

  const exportProfile = () => {
    const blob = new Blob([actions.exportActive()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${active.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "profile"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = async (file: File) => {
    try {
      actions.importProfile(await file.text());
      setMsg({ kind: "success", text: `Imported "${file.name}" as a new profile.` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Import failed." });
    }
  };

  return (
    <div className="planner">
      <div className="stack">
        <section className="card" aria-labelledby="edit-h">
          <div className="card-head">
            <h2 id="edit-h" style={{ fontSize: "1.15rem" }}>Active profile</h2>
            <Link href="/planner" className="btn btn-primary btn-sm">Open planner <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="stack">
            <div className="field">
              <label htmlFor="p-name">Display name</label>
              <input id="p-name" className="input" value={active.name} maxLength={60}
                onChange={(e) => actions.updateProfile(active.id, { name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="p-email">Email (optional)</label>
              <input id="p-email" className="input" type="email" autoComplete="email" value={active.email}
                aria-describedby="p-email-hint" onChange={(e) => actions.updateProfile(active.id, { email: e.target.value })} />
              <span id="p-email-hint" className="hint">Used only to pre-fill the contact form. It never leaves this device otherwise.</span>
            </div>
            <div className="field">
              <label htmlFor="p-cur">Currency</label>
              <select id="p-cur" className="select" value={active.currency}
                onChange={(e) => actions.updateProfile(active.id, { currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 8 }}>Color</legend>
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
          <h2 id="data-h" style={{ fontSize: "1.15rem" }}>Backup &amp; transfer</h2>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportProfile}>
              <Icon name="download" size={16} /> Export active profile
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Import profile
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importProfile(f); e.target.value = ""; }} />
          </div>
          {msg && <p className={`notice ${msg.kind}`} role="status" style={{ marginTop: 12, marginBottom: 0 }}>{msg.text}</p>}
        </section>
      </div>

      <div className="stack">
        <section className="card" aria-labelledby="all-h">
          <h2 id="all-h" style={{ fontSize: "1.15rem" }}>All profiles</h2>
          <ul className="profile-list">
            {profiles.map((p) => {
              const a = analyze(p.budget, p.currency);
              const isActive = p.id === active.id;
              return (
                <li key={p.id} className={`profile-item ${isActive ? "active" : ""}`}>
                  <span className="avatar" style={{ background: p.color }} aria-hidden="true">{p.name.slice(0, 1).toUpperCase() || "?"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "Untitled"}</div>
                    <div className="small muted">
                      Health {a.healthScore} · {formatMoney(a.available, p.currency)}/mo left
                    </div>
                  </div>
                  {isActive ? (
                    <span className="badge primary">Active</span>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.switchProfile(p.id)}>
                      Switch<span className="sr-only"> to {p.name}</span>
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost icon-btn" aria-label={`Delete ${p.name}`}
                    onClick={() => { if (confirm(`Delete the profile "${p.name}"? This can't be undone.`)) actions.deleteProfile(p.id); }}>
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card" aria-labelledby="new-h">
          <h2 id="new-h" style={{ fontSize: "1.15rem" }}>New profile</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); actions.createProfile(newName.trim(), withSample); setNewName(""); }}>
            <div className="field">
              <label htmlFor="new-name">Name</label>
              <input id="new-name" className="input" value={newName} maxLength={60} placeholder="e.g. Household, or What if I move"
                onChange={(e) => setNewName(e.target.value)} />
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: "0.92rem" }}>
              <input type="checkbox" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} style={{ width: 18, height: 18 }} />
              Start with the example budget
            </label>
            <div><button type="submit" className="btn btn-primary"><Icon name="plus" size={18} /> Create profile</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}
