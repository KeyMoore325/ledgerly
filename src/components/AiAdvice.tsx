"use client";

import { useState } from "react";
import type { Analysis } from "@/lib/budget";
import { formatMoney } from "@/lib/budget";
import type { Advice, BudgetData } from "@/lib/types";
import { Icon } from "./Icon";

export function AiAdvice({ budget, analysis, currency }: { budget: BudgetData; analysis: Analysis; currency: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState("");

  const current = JSON.stringify(budget);
  const stale = state === "done" && snapshot !== current;

  async function ask() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAdvice(data.advice);
      setSnapshot(current);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  const disabled = state === "loading" || analysis.income <= 0;

  return (
    <section className="card ai-box" aria-labelledby="ai-h" aria-busy={state === "loading"}>
      <div className="card-head">
        <h2 id="ai-h" style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="spark" /> Ask Claude for a plan
        </h2>
      </div>
      <p className="small muted">
        Sends this profile&apos;s numbers (not your name or email) to Claude for a personalized review.
      </p>
      <button type="button" className="btn btn-primary" onClick={ask} disabled={disabled}>
        {state === "loading" ? (<><span className="spinner" aria-hidden="true" /> Thinking…</>) : state === "done" ? "Refresh advice" : "Get AI advice"}
      </button>
      {analysis.income <= 0 && <p className="hint" style={{ marginTop: 8 }}>Enter your income first.</p>}

      <div aria-live="polite">
        {state === "error" && <p className="notice error" style={{ marginTop: 14 }} role="alert">{error}</p>}
        {advice && state !== "error" && (
          <div className="ai-out" style={{ marginTop: 16 }}>
            {stale && <p className="notice info">Your budget changed since this advice. Refresh to update it.</p>}
            <p>{advice.summary}</p>
            <ul>
              {advice.actions.map((x, i) => (
                <li key={i}>
                  <strong>{x.title}</strong>
                  {x.monthly_impact > 0 && <span className="badge success" style={{ marginLeft: 6 }}>+{formatMoney(x.monthly_impact, currency)}/mo</span>}
                  <br />
                  <span className="muted">{x.detail}</span>
                </li>
              ))}
            </ul>
            <p className="small" style={{ marginTop: 10 }}><strong>Watch out:</strong> {advice.watch_out}</p>
          </div>
        )}
      </div>
    </section>
  );
}
