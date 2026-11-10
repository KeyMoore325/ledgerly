"use client";

import { useMemo } from "react";
import Link from "next/link";
import { actions, emptyBudget, uid, useStore } from "@/lib/store";
import { addMonths, analyze, formatDuration, formatMoney } from "@/lib/budget";
import type { BudgetData, Debt, Expense, Goal } from "@/lib/types";
import { Icon } from "./Icon";
import { NumberInput } from "./NumberInput";
import { AiAdvice } from "./AiAdvice";

type ListKey = "expenses" | "debts" | "goals";

function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? "$"
    );
  } catch {
    return "$";
  }
}

export function Planner() {
  const { active, profiles, ready } = useStore();
  const budget = active?.budget;
  const analysis = useMemo(() => (budget ? analyze(budget, active?.currency) : null), [budget, active?.currency]);

  if (!ready || !active || !budget || !analysis) {
    return (
      <div className="card" aria-busy="true">
        <p className="muted" style={{ margin: 0 }}>Loading your plan…</p>
      </div>
    );
  }

  const cur = active.currency;
  const sym = currencySymbol(cur);
  const money = (n: number) => formatMoney(n, cur);

  const set = (fn: (b: BudgetData) => BudgetData) => actions.updateBudget(fn);
  function patchItem<K extends ListKey>(key: K, id: string, patch: Partial<BudgetData[K][number]>) {
    set((b) => ({ ...b, [key]: (b[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  const removeItem = (key: ListKey, id: string) =>
    set((b) => ({ ...b, [key]: (b[key] as { id: string }[]).filter((x) => x.id !== id) }));
  const addExpense = () =>
    set((b) => ({ ...b, expenses: [...b.expenses, { id: uid(), name: "", amount: 0, category: "needs" } as Expense] }));
  const addDebt = () =>
    set((b) => ({ ...b, debts: [...b.debts, { id: uid(), name: "", balance: 0, apr: 0, minPayment: 0 } as Debt] }));
  const addGoal = () =>
    set((b) => ({ ...b, goals: [...b.goals, { id: uid(), name: "", target: 0, saved: 0, targetDate: "" } as Goal] }));

  const a = analysis;
  const scoreColor = a.healthScore >= 75 ? "var(--success)" : a.healthScore >= 50 ? "var(--warning)" : "var(--danger)";
  const scoreLabel = a.healthScore >= 75 ? "Healthy" : a.healthScore >= 50 ? "Needs attention" : "At risk";

  const split = [
    { label: "Needs + debt minimums", value: a.ratios.needs, target: "≈50%", color: "var(--primary)" },
    { label: "Wants", value: a.ratios.wants, target: "≈30%", color: "var(--accent)" },
    { label: "Savings & extra payments", value: a.ratios.savings, target: "≥20%", color: "var(--success)" },
  ];
  const overspent = Math.max(0, -a.available / (a.income || 1));

  return (
    <div className="planner">
      {/* ------------------------------------------------------------- inputs */}
      <div className="stack">
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="avatar" style={{ background: active.color }} aria-hidden="true">
            {active.name.slice(0, 1).toUpperCase()}
          </span>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 600 }}>{active.name}</div>
            <div className="small muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="live-dot" aria-hidden="true" /> Saved automatically · syncs across tabs
            </div>
          </div>
          {profiles.length > 1 && (
            <label className="sr-only" htmlFor="profile-switch">Switch profile</label>
          )}
          {profiles.length > 1 && (
            <select
              id="profile-switch"
              className="select"
              style={{ width: "auto" }}
              value={active.id}
              onChange={(e) => actions.switchProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <Link href="/profile" className="btn btn-secondary btn-sm">Manage profiles</Link>
          <a href="#results" className="btn btn-primary btn-sm mobile-only">See results</a>
        </div>

        <section className="card" aria-labelledby="income-h">
          <div className="card-head">
            <h2 id="income-h" className="h3" style={{ fontSize: "1.15rem" }}>Monthly income</h2>
          </div>
          <div className="field">
            <label htmlFor="income">Take-home pay, after taxes</label>
            <NumberInput
              id="income"
              prefix={sym}
              value={budget.monthlyIncome}
              onChange={(n) => set((b) => ({ ...b, monthlyIncome: n }))}
              describedBy="income-hint"
            />
            <span id="income-hint" className="hint">Include every regular source: salary, side work, benefits.</span>
          </div>
        </section>

        <section className="card" aria-labelledby="exp-h">
          <div className="card-head">
            <h2 id="exp-h" style={{ fontSize: "1.15rem" }}>Expenses</h2>
            <span className="muted small">{money(a.needs + a.wants)}/mo</span>
          </div>
          <div className="rows">
            {budget.expenses.length === 0 && <p className="empty">No expenses yet. Add rent, groceries, subscriptions…</p>}
            {budget.expenses.map((e, i) => (
              <div className="row-item expense" key={e.id}>
                <div className="field span-2">
                  <label htmlFor={`e-name-${e.id}`}>Name</label>
                  <input id={`e-name-${e.id}`} className="input" value={e.name} placeholder={`Expense ${i + 1}`}
                    onChange={(ev) => patchItem("expenses", e.id, { name: ev.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`e-amt-${e.id}`}>Monthly</label>
                  <NumberInput id={`e-amt-${e.id}`} prefix={sym} value={e.amount}
                    onChange={(n) => patchItem("expenses", e.id, { amount: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`e-cat-${e.id}`}>Type</label>
                  <select id={`e-cat-${e.id}`} className="select" value={e.category}
                    onChange={(ev) => patchItem("expenses", e.id, { category: ev.target.value as Expense["category"] })}>
                    <option value="needs">Need</option>
                    <option value="wants">Want</option>
                  </select>
                </div>
                <button type="button" className="btn btn-ghost icon-btn remove span-2" style={{ minHeight: 40 }}
                  aria-label={`Remove ${e.name || `expense ${i + 1}`}`} onClick={() => removeItem("expenses", e.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={addExpense}>
            <Icon name="plus" size={16} /> Add expense
          </button>
        </section>

        <section className="card" aria-labelledby="debt-h">
          <div className="card-head">
            <h2 id="debt-h" style={{ fontSize: "1.15rem" }}>Debts</h2>
            <div className="segmented" role="group" aria-label="Payoff strategy">
              {(["avalanche", "snowball"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={budget.strategy === s}
                  onClick={() => set((b) => ({ ...b, strategy: s }))}>
                  {s === "avalanche" ? "Avalanche" : "Snowball"}
                </button>
              ))}
            </div>
          </div>
          <p className="hint" style={{ marginTop: -6 }}>
            {budget.strategy === "avalanche"
              ? "Avalanche: extra money goes to the highest interest rate first."
              : "Snowball: extra money goes to the smallest balance first."}
          </p>
          <div className="rows">
            {budget.debts.length === 0 && <p className="empty">No debts. Nice! Add credit cards, loans or financing here.</p>}
            {budget.debts.map((d, i) => (
              <div className="row-item debt" key={d.id}>
                <div className="field span-2">
                  <label htmlFor={`d-name-${d.id}`}>Name</label>
                  <input id={`d-name-${d.id}`} className="input" value={d.name} placeholder={`Debt ${i + 1}`}
                    onChange={(ev) => patchItem("debts", d.id, { name: ev.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`d-bal-${d.id}`}>Balance</label>
                  <NumberInput id={`d-bal-${d.id}`} prefix={sym} value={d.balance}
                    onChange={(n) => patchItem("debts", d.id, { balance: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`d-apr-${d.id}`}>APR</label>
                  <NumberInput id={`d-apr-${d.id}`} suffix="%" value={d.apr}
                    onChange={(n) => patchItem("debts", d.id, { apr: Math.min(n, 100) })} />
                </div>
                <div className="field">
                  <label htmlFor={`d-min-${d.id}`}>Min / mo</label>
                  <NumberInput id={`d-min-${d.id}`} prefix={sym} value={d.minPayment}
                    onChange={(n) => patchItem("debts", d.id, { minPayment: n })} />
                </div>
                <button type="button" className="btn btn-ghost icon-btn remove" style={{ minHeight: 40 }}
                  aria-label={`Remove ${d.name || `debt ${i + 1}`}`} onClick={() => removeItem("debts", d.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={addDebt}>
            <Icon name="plus" size={16} /> Add debt
          </button>
        </section>

        <section className="card" aria-labelledby="goal-h">
          <div className="card-head">
            <h2 id="goal-h" style={{ fontSize: "1.15rem" }}>Goals</h2>
          </div>
          <div className="rows">
            {budget.goals.length === 0 && <p className="empty">Add a goal: an emergency fund, a trip, a down payment…</p>}
            {budget.goals.map((g, i) => (
              <div className="row-item goal" key={g.id}>
                <div className="field span-2">
                  <label htmlFor={`g-name-${g.id}`}>Goal</label>
                  <input id={`g-name-${g.id}`} className="input" value={g.name} placeholder={`Goal ${i + 1}`}
                    onChange={(ev) => patchItem("goals", g.id, { name: ev.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`g-t-${g.id}`}>Target</label>
                  <NumberInput id={`g-t-${g.id}`} prefix={sym} value={g.target}
                    onChange={(n) => patchItem("goals", g.id, { target: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`g-s-${g.id}`}>Saved so far</label>
                  <NumberInput id={`g-s-${g.id}`} prefix={sym} value={g.saved}
                    onChange={(n) => patchItem("goals", g.id, { saved: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`g-d-${g.id}`}>By date (optional)</label>
                  <input id={`g-d-${g.id}`} className="input" type="date" value={g.targetDate}
                    onChange={(ev) => patchItem("goals", g.id, { targetDate: ev.target.value })} />
                </div>
                <button type="button" className="btn btn-ghost icon-btn remove" style={{ minHeight: 40 }}
                  aria-label={`Remove ${g.name || `goal ${i + 1}`}`} onClick={() => removeItem("goals", g.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={addGoal}>
            <Icon name="plus" size={16} /> Add goal
          </button>
        </section>

        <div className="btn-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.resetToSample()}>
            Load example budget
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (confirm("Clear every income, expense, debt and goal in this profile?")) set(() => emptyBudget());
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- results */}
      <div className="stack planner-side" id="results" style={{ scrollMarginTop: 80 }}>
        <div className="stats" role="list" aria-label="Summary">
          <div className="stat" role="listitem"><div className="stat-label">Income</div><div className="stat-value">{money(a.income)}</div></div>
          <div className="stat" role="listitem"><div className="stat-label">Spending</div><div className="stat-value">{money(a.needs + a.wants)}</div></div>
          <div className="stat" role="listitem"><div className="stat-label">Debt minimums</div><div className="stat-value">{money(a.debtMinimums)}</div></div>
          <div className="stat" role="listitem">
            <div className="stat-label">Left over</div>
            <div className={`stat-value ${a.available >= 0 ? "pos" : "neg"}`} aria-live="polite">{money(a.available)}</div>
          </div>
        </div>

        <section className="card" aria-labelledby="health-h">
          <div className="score">
            <div className="score-ring" style={{ ["--val" as string]: a.healthScore, ["--score-color" as string]: scoreColor }}
              role="img" aria-label={`Budget health score ${a.healthScore} out of 100`}>
              <span>{a.healthScore}</span>
            </div>
            <div>
              <h2 id="health-h" style={{ fontSize: "1.1rem", margin: 0 }}>Budget health</h2>
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                {scoreLabel}. Based on cash flow, the 50/30/20 split, debt load and goal progress.
              </p>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", marginTop: 20 }}>Where your income goes</h3>
          <div className="split-bar" aria-hidden="true">
            {split.map((s) => <span key={s.label} style={{ flexGrow: s.value, background: s.color }} />)}
            {overspent > 0 && <span style={{ flexGrow: overspent, background: "var(--danger)" }} />}
          </div>
          <div className="legend">
            {split.map((s) => (
              <div className="legend-item" key={s.label}>
                <span className="legend-swatch" style={{ background: s.color }} />
                <span>{s.label}</span>
                <strong>{Math.round(s.value * 100)}%</strong>
                <span className="legend-target">{s.target}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="sugg-h">
          <div className="card-head">
            <h2 id="sugg-h" style={{ fontSize: "1.1rem" }}>Suggested adjustments</h2>
            <span className="badge primary">{a.suggestions.length}</span>
          </div>
          <ul className="suggestions">
            {a.suggestions.map((s) => (
              <li key={s.id} className={`suggestion ${s.severity}`}>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <AiAdvice budget={budget} analysis={a} currency={cur} />

        <section className="card" aria-labelledby="plan-h">
          <h2 id="plan-h" style={{ fontSize: "1.1rem" }}>Monthly plan for your surplus</h2>
          <dl className="kv">
            <dt>Toward goals</dt><dd>{money(a.allocation.goals)}</dd>
            <dt>Extra debt payments</dt><dd>{money(a.allocation.debtExtra)}</dd>
            {a.allocation.unassigned > 0 && (<><dt>Unassigned</dt><dd>{money(a.allocation.unassigned)}</dd></>)}
          </dl>
        </section>

        {budget.debts.length > 0 && (
          <section className="card" aria-labelledby="payoff-h">
            <div className="card-head">
              <h2 id="payoff-h" style={{ fontSize: "1.1rem" }}>Debt payoff</h2>
              <span className="badge">{budget.strategy}</span>
            </div>
            <dl className="kv">
              <dt>Total owed</dt><dd>{money(a.totalDebt)}</dd>
              <dt>Debt-free in</dt><dd>{formatDuration(a.payoff.months)}</dd>
              {a.payoff.months ? (<><dt>Debt-free by</dt><dd>{addMonths(a.payoff.months).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</dd></>) : null}
              <dt>Interest you&apos;ll pay</dt><dd>{money(a.payoff.totalInterest)}</dd>
              <dt>Minimums only</dt><dd>{formatDuration(a.payoffMinimumOnly.months)} · {money(a.payoffMinimumOnly.totalInterest)}</dd>
            </dl>
            {a.payoff.order.length > 0 && (
              <ol className="small muted" style={{ margin: "14px 0 0", paddingLeft: "1.2em" }}>
                {a.payoff.order.map((o) => (
                  <li key={o.id}>{o.name || "Unnamed debt"} paid off in month {o.paidOffMonth}</li>
                ))}
              </ol>
            )}
          </section>
        )}

        {a.goals.length > 0 && (
          <section className="card" aria-labelledby="goals-h">
            <h2 id="goals-h" style={{ fontSize: "1.1rem" }}>Goal progress</h2>
            {a.goals.map((gp) => (
              <div className="goal-line" key={gp.goal.id}>
                <div className="top">
                  <strong>{gp.goal.name || "Unnamed goal"}</strong>
                  <span className={`badge ${gp.remaining === 0 ? "success" : gp.onTrack ? "primary" : "warning"}`}>
                    {gp.remaining === 0 ? "Reached" : gp.onTrack ? "On track" : "Behind"}
                  </span>
                </div>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.round(gp.progress * 100)} aria-label={`${gp.goal.name || "Goal"} progress`}>
                  <span style={{ width: `${gp.progress * 100}%` }} />
                </div>
                <div className="small muted">
                  {money(gp.goal.saved)} of {money(gp.goal.target)}
                  {gp.remaining > 0 && (
                    <>
                      {" · "}{money(gp.allocatedMonthly)}/mo
                      {gp.projectedMonths !== null
                        ? ` → ${addMonths(gp.projectedMonths).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                        : " → not funded yet"}
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
