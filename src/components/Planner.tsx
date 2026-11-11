"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { actions, emptyBudget, profileInitial, uid, useStore } from "@/lib/store";
import { addMonths, analyze, formatDuration, formatMoney, scoreMood } from "@/lib/budget";
import type { BudgetData, Debt, Expense, Goal, SuggestionSeverity } from "@/lib/types";
import { Icon } from "./Icon";
import { NumberInput } from "./NumberInput";
import { AiAdvice } from "./AiAdvice";
import { InfoTip } from "./InfoTip";
import { AccountBanners, SaveStatus } from "./AccountNotices";

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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const GOAL_EMOJI: [RegExp, string][] = [
  [/emergency|rainy|buffer|safety/i, "🛟"],
  [/vacation|trip|travel|holiday/i, "✈️"],
  [/house|home|down ?payment|apartment/i, "🏡"],
  [/car|vehicle/i, "🚗"],
  [/wedding/i, "💍"],
  [/school|college|tuition|education/i, "🎓"],
  [/baby|kid|child/i, "🍼"],
  [/retire/i, "🌴"],
  [/gift|holiday|christmas|birthday/i, "🎁"],
];
const goalEmoji = (name: string) => GOAL_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🎯";

const SEVERITY_LABEL: Record<SuggestionSeverity, string> = {
  win: "Going well",
  warning: "Start here",
  tip: "Worth a look",
  info: "Nice to know",
};

const MOOD_EMOJI = { good: "🌟", caution: "🌱", neutral: "👋" } as const;
const MOOD_COLOR = { good: "var(--success)", caution: "var(--warning)", neutral: "var(--primary)" } as const;

export function Planner() {
  const { active, profiles, ready, loadError } = useStore();
  const budget = active?.budget;
  const analysis = useMemo(() => (budget ? analyze(budget, active?.currency) : null), [budget, active?.currency]);
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const IDEA_LIMIT = 5;

  if (loadError) {
    return (
      <div className="card" role="alert">
        <p style={{ margin: 0 }}>{loadError}</p>
      </div>
    );
  }
  if (!ready || !active || !budget || !analysis) {
    return (
      <div className="card" aria-busy="true">
        <p className="muted" style={{ margin: 0 }}>Getting your plan ready…</p>
      </div>
    );
  }

  const cur = active.currency;
  const sym = currencySymbol(cur);
  const money = (n: number) => formatMoney(n, cur);
  const monthYear = (months: number) => addMonths(months).toLocaleDateString(undefined, { month: "long", year: "numeric" });

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
  const mood = scoreMood(a.healthScore, a.income > 0);
  const callName = active.name.trim();

  const split = [
    { label: "Essentials", hint: "rent, bills, groceries, minimum debt payments", value: a.ratios.needs, target: "aim ~50%", color: "var(--primary)" },
    { label: "Fun & flexible", hint: "dining out, shopping, hobbies", value: a.ratios.wants, target: "aim ~30%", color: "var(--accent)" },
    { label: "Future you", hint: "savings and extra debt payments", value: a.ratios.savings, target: "aim 20%+", color: "var(--success)" },
  ];
  const overspent = Math.max(0, -a.available / (a.income || 1));
  const strategyName = budget.strategy === "avalanche" ? "Highest interest first" : "Smallest balance first";

  return (
    <div className="planner">
      {/* ------------------------------------------------------------- inputs */}
      <div className="stack">
        <AccountBanners />
        <div className="card welcome">
          <span className="avatar" style={{ background: active.color }} aria-hidden="true">
            {profileInitial(active)}
          </span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p className="welcome-title">
              {greeting()}{callName ? `, ${callName}` : ""} <span aria-hidden="true">👋</span>
            </p>
            <p className="small muted" style={{ margin: "0 0 2px" }}>
              You&apos;re working on <strong className="budget-name">{active.budgetName || "My budget"}</strong>
              {!callName && (
                <>
                  {" · "}
                  <Link href="/profile">Tell us your name</Link>
                </>
              )}
            </p>
            <SaveStatus />
          </div>
          <div className="btn-row">
            {profiles.length > 1 && (
              <>
                <label className="sr-only" htmlFor="profile-switch">Switch budget</label>
                <select id="profile-switch" className="select" style={{ width: "auto", minHeight: 36 }}
                  value={active.id} onChange={(e) => actions.switchProfile(e.target.value)}>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.budgetName || "My budget"}</option>)}
                </select>
              </>
            )}
            <Link href="/profile" className="btn btn-secondary btn-sm">Profile</Link>
            <a href="#results" className="btn btn-primary btn-sm mobile-only">See how you&apos;re doing</a>
          </div>
        </div>

        <section className="card" aria-labelledby="income-h">
          <div className="card-head">
            <h2 id="income-h" className="section-title"><span aria-hidden="true">💵</span> What you bring home</h2>
          </div>
          <div className="field">
            <label htmlFor="income">Monthly take-home pay</label>
            <NumberInput id="income" prefix={sym} value={budget.monthlyIncome}
              onChange={(n) => set((b) => ({ ...b, monthlyIncome: n }))} describedBy="income-hint" />
            <span id="income-hint" className="hint">
              The amount that actually lands in your account after taxes. Include side gigs or benefits too.
            </span>
          </div>
        </section>

        <section className="card" aria-labelledby="exp-h">
          <div className="card-head">
            <h2 id="exp-h" className="section-title"><span aria-hidden="true">🏠</span> Bills &amp; spending</h2>
            <span className="muted small">{money(a.needs + a.wants)} a month</span>
          </div>
          <p className="hint" style={{ marginTop: -6 }}>
            Mark each one as <strong>Essential</strong> (you&apos;d have to pay it no matter what) or{" "}
            <strong>Flexible</strong> (nice to have, easier to adjust).
          </p>
          <div className="rows">
            {budget.expenses.length === 0 && (
              <p className="empty">Let&apos;s add your regular costs. Rent, groceries and streaming services are good places to start.</p>
            )}
            {budget.expenses.map((e, i) => (
              <div className="row-item expense" key={e.id}>
                <div className="field span-2">
                  <label htmlFor={`e-name-${e.id}`}>What is it?</label>
                  <input id={`e-name-${e.id}`} className="input" value={e.name} placeholder={i === 0 ? "e.g. Rent" : "e.g. Groceries"}
                    onChange={(ev) => patchItem("expenses", e.id, { name: ev.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`e-amt-${e.id}`}>Per month</label>
                  <NumberInput id={`e-amt-${e.id}`} prefix={sym} value={e.amount}
                    onChange={(n) => patchItem("expenses", e.id, { amount: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`e-cat-${e.id}`}>Type</label>
                  <select id={`e-cat-${e.id}`} className="select" value={e.category}
                    onChange={(ev) => patchItem("expenses", e.id, { category: ev.target.value as Expense["category"] })}>
                    <option value="needs">Essential</option>
                    <option value="wants">Flexible</option>
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
            <Icon name="plus" size={16} /> Add a cost
          </button>
        </section>

        <section className="card" aria-labelledby="debt-h">
          <div className="card-head">
            <h2 id="debt-h" className="section-title"><span aria-hidden="true">💳</span> What you owe</h2>
          </div>
          <div className="strategy">
            <span className="label">Which debt should get extra money first?</span>
            <div className="segmented" role="group" aria-label="Payoff order">
              {(["avalanche", "snowball"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={budget.strategy === s}
                  onClick={() => set((b) => ({ ...b, strategy: s }))}>
                  {s === "avalanche" ? "Highest interest" : "Smallest balance"}
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {budget.strategy === "avalanche"
                ? "Saves the most money overall. Sometimes called the “avalanche” method."
                : "Gives you quick wins as balances disappear. Sometimes called the “snowball” method."}
            </p>
          </div>
          <div className="rows">
            {budget.debts.length === 0 && (
              <p className="empty">No debts? Love that. 🙌 If you have a card or loan, add it here and we&apos;ll map out the fastest way to clear it.</p>
            )}
            {budget.debts.map((d, i) => (
              <div className="row-item debt" key={d.id}>
                <div className="field span-2">
                  <label htmlFor={`d-name-${d.id}`}>What is it?</label>
                  <input id={`d-name-${d.id}`} className="input" value={d.name} placeholder="e.g. Credit card"
                    onChange={(ev) => patchItem("debts", d.id, { name: ev.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`d-bal-${d.id}`}>Amount owed</label>
                  <NumberInput id={`d-bal-${d.id}`} prefix={sym} value={d.balance}
                    onChange={(n) => patchItem("debts", d.id, { balance: n })} />
                </div>
                <div className="field">
                  <span className="label-row">
                    <label htmlFor={`d-apr-${d.id}`}>Interest rate</label>
                    {i === 0 && (
                      <InfoTip term="interest rate">
                        The yearly interest rate (APR) on your statement. Higher rates make a balance grow faster, so
                        those are usually worth paying off first.
                      </InfoTip>
                    )}
                  </span>
                  <NumberInput id={`d-apr-${d.id}`} suffix="%" value={d.apr}
                    onChange={(n) => patchItem("debts", d.id, { apr: Math.min(n, 100) })} />
                </div>
                <div className="field">
                  <span className="label-row">
                    <label htmlFor={`d-min-${d.id}`}>Min. payment</label>
                    {i === 0 && (
                      <InfoTip term="minimum payment">
                        The smallest amount you have to pay each month to stay in good standing. It&apos;s on your statement.
                      </InfoTip>
                    )}
                  </span>
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
            <Icon name="plus" size={16} /> Add a debt
          </button>
        </section>

        <section className="card" aria-labelledby="goal-h">
          <div className="card-head">
            <h2 id="goal-h" className="section-title"><span aria-hidden="true">🎯</span> What you&apos;re saving for</h2>
          </div>
          <div className="rows">
            {budget.goals.length === 0 && (
              <p className="empty">What would you love to save for? A safety net 🛟, a trip ✈️, a new home 🏡. Big or small, it all counts.</p>
            )}
            {budget.goals.map((g, i) => (
              <div className="row-item goal" key={g.id}>
                <div className="field span-2">
                  <label htmlFor={`g-name-${g.id}`}>Goal</label>
                  <input id={`g-name-${g.id}`} className="input" value={g.name} placeholder={i === 0 ? "e.g. Emergency fund" : "e.g. Vacation"}
                    onChange={(ev) => patchItem("goals", g.id, { name: ev.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`g-t-${g.id}`}>Goal amount</label>
                  <NumberInput id={`g-t-${g.id}`} prefix={sym} value={g.target}
                    onChange={(n) => patchItem("goals", g.id, { target: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`g-s-${g.id}`}>Saved so far</label>
                  <NumberInput id={`g-s-${g.id}`} prefix={sym} value={g.saved}
                    onChange={(n) => patchItem("goals", g.id, { saved: n })} />
                </div>
                <div className="field">
                  <label htmlFor={`g-d-${g.id}`}>Hoping to reach it by</label>
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
            <Icon name="plus" size={16} /> Add a goal
          </button>
        </section>

        <div className="btn-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.resetToSample()}>
            Try the example budget
          </button>
          <button type="button" className="btn btn-danger btn-sm"
            onClick={() => { if (confirm("Start fresh? This clears everything in this profile.")) set(() => emptyBudget()); }}>
            Start fresh
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- results */}
      <div className="stack planner-side" id="results" style={{ scrollMarginTop: 80 }}>
        <div className="stats" role="list" aria-label="Summary">
          <div className="stat" role="listitem"><div className="stat-label">Coming in</div><div className="stat-value">{money(a.income)}</div></div>
          <div className="stat" role="listitem"><div className="stat-label">Bills &amp; spending</div><div className="stat-value">{money(a.needs + a.wants)}</div></div>
          <div className="stat" role="listitem"><div className="stat-label">Debt payments</div><div className="stat-value">{money(a.debtMinimums)}</div></div>
          <div className="stat" role="listitem">
            <div className="stat-label">{a.available >= 0 ? "Left over" : "Short this month"}</div>
            <div className={`stat-value ${a.available >= 0 ? "pos" : "neg"}`} aria-live="polite">{money(Math.abs(a.available))}</div>
          </div>
        </div>

        <section className="card" aria-labelledby="health-h">
          <div className="score">
            <div className="score-ring" role="img" aria-label={`How you're doing: ${mood.label}`}
              style={{ ["--val" as string]: a.income > 0 ? Math.max(a.healthScore, 6) : 0, ["--score-color" as string]: MOOD_COLOR[mood.tone] }}>
              <span aria-hidden="true">{MOOD_EMOJI[mood.tone]}</span>
            </div>
            <div>
              <p className="small muted" style={{ margin: 0 }} id="health-h">How you&apos;re doing</p>
              <p className="mood-label">{mood.label}</p>
              <p className="muted small" style={{ margin: 0 }}>{mood.line}</p>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", marginTop: 22 }}>Where your money goes</h3>
          <div className="split-bar" aria-hidden="true">
            {split.map((s) => <span key={s.label} style={{ flexGrow: s.value, background: s.color }} />)}
            {overspent > 0 && <span style={{ flexGrow: overspent, background: "var(--warning)" }} />}
          </div>
          <div className="legend">
            {split.map((s) => (
              <div className="legend-item" key={s.label}>
                <span className="legend-swatch" style={{ background: s.color }} />
                <span>
                  {s.label}
                  <span className="legend-hint">{s.hint}</span>
                </span>
                <strong>{Math.round(s.value * 100)}%</strong>
                <span className="legend-target">{s.target}</span>
              </div>
            ))}
          </div>
          <p className="hint" style={{ margin: "12px 0 0" }}>
            These are friendly rules of thumb, not strict rules. Every budget looks a little different.
          </p>
        </section>

        <section className="card" aria-labelledby="sugg-h">
          <h2 id="sugg-h" className="section-title" style={{ marginBottom: 14 }}>
            <span aria-hidden="true">💡</span> Ideas for you
          </h2>
          <ul className="suggestions" id="ideas-list">
            {(showAllIdeas ? a.suggestions : a.suggestions.slice(0, IDEA_LIMIT)).map((s) => (
              <li key={s.id} className={`suggestion ${s.severity}`}>
                <div>
                  <span className={`sugg-tag ${s.severity}`}>{SEVERITY_LABEL[s.severity]}</span>
                  <h3>{s.title}</h3>
                  <p>{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {a.suggestions.length > IDEA_LIMIT && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
              aria-expanded={showAllIdeas} aria-controls="ideas-list" onClick={() => setShowAllIdeas((v) => !v)}>
              {showAllIdeas ? "Show fewer" : `Show ${a.suggestions.length - IDEA_LIMIT} more idea${a.suggestions.length - IDEA_LIMIT === 1 ? "" : "s"}`}
            </button>
          )}
        </section>

        <AiAdvice budget={budget} analysis={a} currency={cur} />

        <section className="card" aria-labelledby="plan-h">
          <h2 id="plan-h" className="section-title">Where your extra money goes</h2>
          {a.available > 0 ? (
            <dl className="kv">
              <dt>Toward your goals</dt><dd>{money(a.allocation.goals)}</dd>
              <dt>Paying debt down faster</dt><dd>{money(a.allocation.debtExtra)}</dd>
              {a.allocation.unassigned > 0 && (<><dt>Yours to decide</dt><dd>{money(a.allocation.unassigned)}</dd></>)}
            </dl>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Once there&apos;s a little left over each month, we&apos;ll show you the smartest place to put it.
            </p>
          )}
        </section>

        {budget.debts.length > 0 && (
          <section className="card" aria-labelledby="payoff-h">
            <div className="card-head">
              <h2 id="payoff-h" className="section-title">Your path to debt-free</h2>
              <span className="badge">{strategyName}</span>
            </div>
            {a.payoff.months ? (
              <p className="celebrate">🎉 You&apos;re debt-free by <strong>{monthYear(a.payoff.months)}</strong>!</p>
            ) : null}
            <dl className="kv">
              <dt>Total to pay off</dt><dd>{money(a.totalDebt)}</dd>
              <dt>Time to get there</dt><dd>{formatDuration(a.payoff.months)}</dd>
              <dt>Interest along the way</dt><dd>{money(a.payoff.totalInterest)}</dd>
              <dt>If you paid only the minimums</dt><dd>{formatDuration(a.payoffMinimumOnly.months)} · {money(a.payoffMinimumOnly.totalInterest)}</dd>
            </dl>
            {a.payoff.order.length > 0 && (
              <ol className="milestones">
                {a.payoff.order.map((o) => (
                  <li key={o.id}>
                    <span aria-hidden="true">✅</span> {o.name || "Debt"} gone by {monthYear(o.paidOffMonth)}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {a.goals.length > 0 && (
          <section className="card" aria-labelledby="goals-h">
            <h2 id="goals-h" className="section-title">Your goals</h2>
            {a.goals.map((gp) => (
              <div className="goal-line" key={gp.goal.id}>
                <div className="top">
                  <strong><span aria-hidden="true">{goalEmoji(gp.goal.name)}</span> {gp.goal.name || "Your goal"}</strong>
                  <span className={`badge ${gp.remaining === 0 ? "success" : gp.onTrack ? "primary" : "warning"}`}>
                    {gp.remaining === 0 ? "🎉 Reached!" : gp.onTrack ? "On track" : "Needs a boost"}
                  </span>
                </div>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.round(gp.progress * 100)} aria-label={`${gp.goal.name || "Goal"} progress`}>
                  <span style={{ width: `${gp.progress * 100}%` }} />
                </div>
                <div className="small muted">
                  {money(gp.goal.saved)} of {money(gp.goal.target)} saved
                  {gp.remaining > 0 && (
                    <>
                      {" · "}
                      {gp.projectedMonths !== null
                        ? `${money(gp.allocatedMonthly)}/mo gets you there by ${monthYear(gp.projectedMonths)}`
                        : "it'll start growing once there's room in the budget"}
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
