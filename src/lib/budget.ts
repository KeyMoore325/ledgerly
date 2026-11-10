import type { BudgetData, Debt, DebtStrategy, Goal, Suggestion } from "./types";

/** APR at or above this is treated as "high-interest" debt worth attacking first. */
export const HIGH_APR = 8;
const MAX_MONTHS = 600; // 50-year safety cap for simulations

const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
const round = (n: number) => Math.round(n * 100) / 100;

export function monthsUntil(dateIso: string, from = new Date()): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const months = (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth());
  return Math.max(1, months);
}

export function addMonths(months: number, from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return d;
}

// ---------------------------------------------------------------------------
// Debt payoff simulation
// ---------------------------------------------------------------------------

export interface PayoffResult {
  months: number | null; // null = never pays off (payments don't cover interest)
  totalInterest: number;
  order: { id: string; name: string; paidOffMonth: number }[];
}

export function orderDebts(debts: Debt[], strategy: DebtStrategy): Debt[] {
  const copy = [...debts];
  copy.sort((a, b) =>
    strategy === "avalanche" ? b.apr - a.apr || a.balance - b.balance : a.balance - b.balance || b.apr - a.apr,
  );
  return copy;
}

export function simulatePayoff(debts: Debt[], extra: number, strategy: DebtStrategy): PayoffResult {
  const active = orderDebts(
    debts.filter((d) => d.balance > 0),
    strategy,
  ).map((d) => ({ ...d }));
  if (active.length === 0) return { months: 0, totalInterest: 0, order: [] };

  const budget = sum(active.map((d) => d.minPayment)) + Math.max(0, extra);
  let totalInterest = 0;
  const order: PayoffResult["order"] = [];

  for (let month = 1; month <= MAX_MONTHS; month++) {
    // accrue interest
    for (const d of active) {
      if (d.balance <= 0) continue;
      const interest = (d.balance * (d.apr / 100)) / 12;
      d.balance += interest;
      totalInterest += interest;
    }
    // pay minimums, then roll everything left into the priority debt
    let remaining = budget;
    for (const d of active) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minPayment, d.balance, remaining);
      d.balance -= pay;
      remaining -= pay;
    }
    for (const d of active) {
      if (remaining <= 0) break;
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, remaining);
      d.balance -= pay;
      remaining -= pay;
    }
    for (const d of active) {
      if (d.balance <= 0.005 && !order.find((o) => o.id === d.id)) {
        d.balance = 0;
        order.push({ id: d.id, name: d.name, paidOffMonth: month });
      }
    }
    if (active.every((d) => d.balance <= 0)) {
      return { months: month, totalInterest: round(totalInterest), order };
    }
  }
  return { months: null, totalInterest: round(totalInterest), order };
}

// ---------------------------------------------------------------------------
// Full budget analysis
// ---------------------------------------------------------------------------

export interface GoalPlan {
  goal: Goal;
  remaining: number;
  requiredMonthly: number | null; // to hit the target date; null if no date
  allocatedMonthly: number;
  projectedMonths: number | null;
  onTrack: boolean;
  progress: number; // 0..1
}

export interface Analysis {
  income: number;
  needs: number;
  wants: number;
  debtMinimums: number;
  totalDebt: number;
  available: number; // income - expenses - debt minimums
  ratios: { needs: number; wants: number; savings: number }; // 50/30/20 view, 0..1
  allocation: { goals: number; debtExtra: number; unassigned: number };
  goals: GoalPlan[];
  payoff: PayoffResult;
  payoffMinimumOnly: PayoffResult;
  payoffAlt: PayoffResult; // the other strategy, same extra
  healthScore: number; // 0..100
  suggestions: Suggestion[];
}

export function analyze(b: BudgetData, currency = "USD"): Analysis {
  const income = Math.max(0, b.monthlyIncome || 0);
  const needs = sum(b.expenses.filter((e) => e.category === "needs").map((e) => e.amount));
  const wants = sum(b.expenses.filter((e) => e.category === "wants").map((e) => e.amount));
  const liveDebts = b.debts.filter((d) => d.balance > 0);
  const debtMinimums = sum(liveDebts.map((d) => Math.min(d.minPayment, d.balance)));
  const totalDebt = sum(liveDebts.map((d) => d.balance));
  const available = income - needs - wants - debtMinimums;
  const surplus = Math.max(0, available);

  const pct = (n: number) => (income > 0 ? n / income : 0);
  const ratios = {
    needs: pct(needs + debtMinimums),
    wants: pct(wants),
    savings: pct(surplus),
  };

  // --- Goal requirements
  const openGoals = b.goals.filter((g) => g.target > g.saved);
  const required = openGoals.map((g) => {
    const m = monthsUntil(g.targetDate);
    return m ? (g.target - g.saved) / m : null;
  });
  const requiredTotal = sum(required.map((r) => r ?? 0));
  const hasHighInterest = liveDebts.some((d) => d.apr >= HIGH_APR);

  // --- Allocate the monthly surplus
  let goalsAlloc = 0;
  let debtExtra = 0;
  if (surplus > 0) {
    if (surplus <= requiredTotal) {
      goalsAlloc = surplus;
    } else {
      goalsAlloc = requiredTotal;
      const rest = surplus - requiredTotal;
      if (hasHighInterest) debtExtra = rest;
      else if (liveDebts.length) {
        debtExtra = rest / 2;
        goalsAlloc += rest / 2;
      } else goalsAlloc += rest;
    }
  }
  // Undated goals share whatever goal money is left after dated goals are funded
  const datedShare = requiredTotal > 0 ? Math.min(1, goalsAlloc / requiredTotal) : 0;
  const leftoverForUndated = Math.max(0, goalsAlloc - requiredTotal);
  const undatedCount = required.filter((r) => r === null).length;
  const datedLeftoverSplit = undatedCount === 0 && openGoals.length ? leftoverForUndated / openGoals.length : 0;

  const goals: GoalPlan[] = b.goals.map((g) => {
    const remaining = Math.max(0, g.target - g.saved);
    const idx = openGoals.indexOf(g);
    const req = idx >= 0 ? required[idx] : null;
    let allocatedMonthly = 0;
    if (remaining > 0) {
      allocatedMonthly =
        req !== null ? req * datedShare + datedLeftoverSplit : undatedCount ? leftoverForUndated / undatedCount : 0;
    }
    const projectedMonths = remaining === 0 ? 0 : allocatedMonthly > 0 ? Math.ceil(remaining / allocatedMonthly) : null;
    const target = monthsUntil(g.targetDate);
    const onTrack = remaining === 0 || (projectedMonths !== null && (target === null || projectedMonths <= target));
    return {
      goal: g,
      remaining,
      requiredMonthly: req,
      allocatedMonthly: round(allocatedMonthly),
      projectedMonths,
      onTrack,
      progress: g.target > 0 ? Math.min(1, g.saved / g.target) : 0,
    };
  });

  const altStrategy: DebtStrategy = b.strategy === "avalanche" ? "snowball" : "avalanche";
  const payoff = simulatePayoff(liveDebts, debtExtra, b.strategy);
  const payoffMinimumOnly = simulatePayoff(liveDebts, 0, b.strategy);
  const payoffAlt = simulatePayoff(liveDebts, debtExtra, altStrategy);

  const allocation = {
    goals: round(goalsAlloc),
    debtExtra: round(debtExtra),
    unassigned: round(Math.max(0, surplus - goalsAlloc - debtExtra)),
  };

  const partial = {
    income, needs, wants, debtMinimums, totalDebt, available, ratios, allocation, goals,
    payoff, payoffMinimumOnly, payoffAlt,
  };
  return {
    ...partial,
    healthScore: healthScore(partial, b),
    suggestions: buildSuggestions(partial, b, currency),
  };
}

type Partial = Omit<Analysis, "healthScore" | "suggestions">;

function healthScore(a: Partial, b: BudgetData): number {
  if (a.income <= 0) return 0;
  let score = 100;
  if (a.available < 0) score -= 40;
  score -= Math.max(0, a.ratios.needs - 0.5) * 100; // each point over 50% costs a point
  score -= Math.max(0, a.ratios.wants - 0.3) * 80;
  score -= Math.max(0, 0.2 - a.ratios.savings) * 100;
  const dti = a.debtMinimums / a.income;
  score -= Math.max(0, dti - 0.15) * 100;
  if (a.payoffMinimumOnly.months === null && b.debts.length) score -= 15;
  const behind = a.goals.filter((g) => !g.onTrack).length;
  score -= behind * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildSuggestions(a: Partial, b: BudgetData, currency: string): Suggestion[] {
  const out: Suggestion[] = [];
  const fmt = (n: number) => formatMoney(n, currency);

  if (a.income <= 0) {
    out.push({
      id: "income",
      severity: "info",
      title: "Start with your take-home income",
      detail: "Enter your monthly income after taxes so the planner can size your spending, debt payments and goals.",
    });
    return out;
  }

  if (a.available < 0) {
    const gap = -a.available;
    out.push({
      id: "deficit",
      severity: "warning",
      title: `You're spending ${fmt(gap)} more than you earn each month`,
      detail:
        a.wants >= gap
          ? `Trimming flexible "wants" by ${fmt(gap)} would balance the budget. Start with the largest discretionary items.`
          : `Cutting all wants won't fully close the gap. Look at the biggest needs (housing, transport, insurance) for renegotiation, or consider ways to raise income.`,
      monthlyImpact: gap,
    });
  }

  if (a.ratios.needs > 0.5) {
    out.push({
      id: "needs-high",
      severity: a.ratios.needs > 0.65 ? "warning" : "tip",
      title: `Essentials take ${Math.round(a.ratios.needs * 100)}% of income`,
      detail: `A common guideline is about 50% for needs (including minimum debt payments). Shopping insurance, refinancing, or reducing housing or transport costs gives the most leverage.`,
      monthlyImpact: (a.ratios.needs - 0.5) * a.income,
    });
  }

  if (a.ratios.wants > 0.3) {
    const cut = (a.ratios.wants - 0.3) * a.income;
    const biggest = [...b.expenses].filter((e) => e.category === "wants").sort((x, y) => y.amount - x.amount)[0];
    out.push({
      id: "wants-high",
      severity: "tip",
      title: `Trim discretionary spending by about ${fmt(cut)}/month`,
      detail: `Wants are ${Math.round(a.ratios.wants * 100)}% of income versus a 30% guideline.${
        biggest ? ` Your largest is "${biggest.name}" at ${fmt(biggest.amount)}/month.` : ""
      } Redirecting this would speed up your goals.`,
      monthlyImpact: cut,
    });
  }

  if (a.available >= 0 && a.ratios.savings < 0.2) {
    out.push({
      id: "savings-low",
      severity: "tip",
      title: `Aim to free up ${fmt(0.2 * a.income - a.available)} more per month`,
      detail: `You have ${Math.round(a.ratios.savings * 100)}% of income left for savings and extra debt payments. Targeting 20% builds resilience over time.`,
    });
  }

  const hasEmergency = b.goals.some((g) => /emergency|rainy|buffer/i.test(g.name));
  if (!hasEmergency) {
    const target = (a.needs + a.debtMinimums) * 3;
    out.push({
      id: "emergency",
      severity: "info",
      title: "Add an emergency fund goal",
      detail: `Three months of essential costs is about ${fmt(target)}. Having it keeps surprises from turning into new debt.`,
    });
  }

  const high = b.debts.filter((d) => d.balance > 0 && d.apr >= HIGH_APR).sort((x, y) => y.apr - x.apr);
  if (high.length) {
    out.push({
      id: "high-apr",
      severity: "warning",
      title: `Prioritize "${high[0].name}" at ${high[0].apr}% APR`,
      detail: `High-interest debt usually costs more than savings earn. ${
        a.allocation.debtExtra > 0
          ? `The plan sends ${fmt(a.allocation.debtExtra)}/month extra here, after your dated goals.`
          : "Once you have money left over after your goals, send it here first."
      } Ask the lender about a lower rate, or look at a 0% balance transfer.`,
    });
  }

  if (b.debts.length && a.payoffMinimumOnly.months === null) {
    out.push({
      id: "debt-trap",
      severity: "warning",
      title: "Minimum payments won't clear your debt",
      detail: "At least one balance grows faster than its minimum payment. Raise that payment or contact the lender about a hardship or lower-rate plan.",
    });
  }

  if (a.payoff.months && a.payoffMinimumOnly.months && a.allocation.debtExtra > 0) {
    const saved = a.payoffMinimumOnly.totalInterest - a.payoff.totalInterest;
    if (saved > 1) {
      out.push({
        id: "extra-payments",
        severity: "info",
        title: `Extra payments save about ${fmt(saved)} in interest`,
        detail: `You'd be debt-free in ${a.payoff.months} months instead of ${a.payoffMinimumOnly.months}.`,
      });
    }
  }

  const diff = a.payoff.totalInterest - a.payoffAlt.totalInterest;
  if (b.debts.length > 1 && diff > 25) {
    const other = b.strategy === "avalanche" ? "snowball" : "avalanche";
    out.push({
      id: "strategy",
      severity: "tip",
      title: `Switching to ${other} saves about ${fmt(diff)}`,
      detail:
        other === "avalanche"
          ? "Avalanche pays the highest-APR debt first, which minimizes total interest."
          : "Snowball clears the smallest balances first. Here it also happens to cost less.",
    });
  }

  for (const gp of a.goals) {
    if (gp.onTrack || gp.remaining === 0) continue;
    const req = gp.requiredMonthly ?? 0;
    const months = gp.projectedMonths;
    out.push({
      id: `goal-${gp.goal.id}`,
      severity: "tip",
      title: `"${gp.goal.name}" is behind schedule`,
      detail:
        months !== null
          ? `Reaching it by the target date needs ${fmt(req)}/month, but the plan can fund ${fmt(
              gp.allocatedMonthly,
            )}. At this pace you'd finish around ${addMonths(months).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}. You can push back the date or free up more cash.`
          : `There's no surplus to put toward this goal yet. Free up money elsewhere, or pause it until your debts are paid down.`,
    });
  }

  if (out.length === 0 || (out.every((s) => s.severity === "info") && a.available > 0)) {
    out.push({
      id: "on-track",
      severity: "info",
      title: "Your plan looks healthy",
      detail: "Keep automating transfers on payday and review this plan when your income or expenses change.",
    });
  }

  const rank = { warning: 0, tip: 1, info: 2 } as const;
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

export function formatMoney(n: number, currency = "USD", compact = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      notation: compact ? "compact" : "standard",
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

export function formatDuration(months: number | null): string {
  if (months === null) return "Never at current payments";
  if (months === 0) return "Done";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ");
}
