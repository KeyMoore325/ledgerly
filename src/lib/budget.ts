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
  const monthYear = (months: number) =>
    addMonths(months).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  if (a.income <= 0) {
    out.push({
      id: "income",
      severity: "info",
      title: "Let's start with what you bring home",
      detail: "Pop in your monthly take-home pay (after taxes) and we'll take it from there. Everything else builds on this one number.",
    });
    return out;
  }

  // ---- Wins: always lead with what's going well -------------------------
  const wins: Suggestion[] = [];
  const reached = a.goals.filter((g) => g.goal.target > 0 && g.remaining === 0);
  if (reached.length) {
    wins.push({
      id: "win-reached",
      severity: "win",
      title: `You hit your ${reached[0].goal.name || "savings"} goal 🎉`,
      detail: "That's a real milestone. Take a moment to enjoy it before picking your next target.",
    });
  }
  const started = a.goals
    .filter((g) => g.goal.saved > 0 && g.remaining > 0)
    .sort((x, y) => y.goal.saved - x.goal.saved)[0];
  if (started) {
    wins.push({
      id: "win-saved",
      severity: "win",
      title: `You've already saved ${fmt(started.goal.saved)} toward ${started.goal.name || "your goal"} 🎉`,
      detail: `That's ${Math.round(started.progress * 100)}% of the way there. The hardest part is starting, and you've done it.`,
    });
  }
  if (a.available > 0) {
    wins.push({
      id: "win-surplus",
      severity: "win",
      title: `You have ${fmt(a.available)} left over each month`,
      detail: "That breathing room is what moves your goals and debts forward. Nice work.",
    });
  }
  if (b.debts.length === 0 || a.totalDebt === 0) {
    wins.push({
      id: "win-nodebt",
      severity: "win",
      title: "No debt holding you back",
      detail: "Every extra dollar can go straight to your goals. That's a big advantage.",
    });
  } else if (a.payoff.months) {
    wins.push({
      id: "win-debtfree",
      severity: "win",
      title: `You're on track to be debt-free by ${monthYear(a.payoff.months)}`,
      detail: "Stick with the plan and every payment gets you closer.",
    });
  }
  out.push(...wins.slice(0, 2));

  // ---- Things to work on -----------------------------------------------
  if (a.available < 0) {
    const gap = -a.available;
    out.push({
      id: "deficit",
      severity: "warning",
      title: `Spending is running about ${fmt(gap)} ahead of income`,
      detail:
        a.wants >= gap
          ? `Good news: trimming your flexible spending by ${fmt(gap)} would balance things out. Start with the biggest "want" and see how far that gets you.`
          : `Flexible spending alone won't quite close this gap, and that's okay. Your biggest bills (rent, car, insurance) are worth a second look, and so are ways to bring in a bit more.`,
      monthlyImpact: gap,
    });
  }

  // When spending already exceeds income, the deficit note covers big bills, so skip this one.
  if (a.ratios.needs > 0.5 && a.available >= 0) {
    out.push({
      id: "needs-high",
      severity: a.ratios.needs > 0.65 ? "warning" : "tip",
      title: `Essentials are taking up ${Math.round(a.ratios.needs * 100)}% of your paycheck`,
      detail: `Many people aim for around half. This is really common in high-cost areas. If you get a chance, shopping around for insurance or your phone plan can free up money without changing your day-to-day.`,
      monthlyImpact: (a.ratios.needs - 0.5) * a.income,
    });
  }

  const cut = (a.ratios.wants - 0.3) * a.income;
  if (a.ratios.wants > 0.3 && cut >= 25) {
    const biggest = [...b.expenses].filter((e) => e.category === "wants").sort((x, y) => y.amount - x.amount)[0];
    out.push({
      id: "wants-high",
      severity: "tip",
      title: `Finding ${fmt(cut)} a month in fun money would speed things up`,
      detail: `${biggest ? `Your biggest one is ${biggest.name} at ${fmt(biggest.amount)}/month. ` : ""}No need to cut it all. Even trimming a little gives your goals a real boost.`,
      monthlyImpact: cut,
    });
  }

  if (a.available >= 0 && a.ratios.savings < 0.2) {
    out.push({
      id: "savings-low",
      severity: "tip",
      title: `Freeing up another ${fmt(0.2 * a.income - a.available)} a month would give you more cushion`,
      detail: `Right now about ${Math.round(a.ratios.savings * 100)}% of your income goes to future you. Working toward 20% over time makes surprises a lot less stressful.`,
    });
  }

  const hasEmergency = b.goals.some((g) => /emergency|rainy|buffer/i.test(g.name));
  if (!hasEmergency) {
    const target = (a.needs + a.debtMinimums) * 3;
    out.push({
      id: "emergency",
      severity: "info",
      title: "Consider adding a safety-net fund 🛟",
      detail: `About ${fmt(target)} would cover three months of essentials. It's what keeps a surprise car repair from turning into new debt.`,
    });
  }

  const high = b.debts.filter((d) => d.balance > 0 && d.apr >= HIGH_APR).sort((x, y) => y.apr - x.apr);
  if (high.length) {
    out.push({
      id: "high-apr",
      severity: "warning",
      title: `Tackle ${high[0].name || "your highest-interest debt"} first (${high[0].apr}% interest)`,
      detail: `High-interest debt grows faster than most savings can keep up with. ${
        a.allocation.debtExtra > 0
          ? `The plan already sends an extra ${fmt(a.allocation.debtExtra)}/month here.`
          : "Once you have a little left over, this is the best place for it."
      } It's also worth calling your lender to ask about a lower rate. It often works!`,
    });
  }

  if (b.debts.length && a.payoffMinimumOnly.months === null) {
    out.push({
      id: "debt-trap",
      severity: "warning",
      title: "One of your balances needs a bigger payment",
      detail: "At the current minimum, the interest is outpacing the payment. Bumping it up a bit, or asking the lender about a hardship plan, gets it moving the right way.",
    });
  }

  if (a.payoff.months && a.payoffMinimumOnly.months && a.allocation.debtExtra > 0) {
    const saved = a.payoffMinimumOnly.totalInterest - a.payoff.totalInterest;
    if (saved > 1) {
      out.push({
        id: "extra-payments",
        severity: "info",
        title: `Your extra payments save you about ${fmt(saved)} 💪`,
        detail: `You'll be debt-free ${a.payoffMinimumOnly.months - a.payoff.months} months sooner than paying only the minimums.`,
      });
    }
  }

  const diff = a.payoff.totalInterest - a.payoffAlt.totalInterest;
  if (b.debts.length > 1 && diff > 25) {
    const other = b.strategy === "avalanche" ? "Highest interest first" : "Smallest balance first";
    out.push({
      id: "strategy",
      severity: "tip",
      title: `Switching to "${other}" would save you about ${fmt(diff)}`,
      detail:
        b.strategy === "snowball"
          ? "Paying the highest-interest debt first costs the least overall. Either way you're making progress."
          : "For your balances, clearing the smallest ones first happens to cost less too.",
    });
  }

  for (const gp of a.goals) {
    if (gp.onTrack || gp.remaining === 0) continue;
    const req = gp.requiredMonthly ?? 0;
    const months = gp.projectedMonths;
    const name = gp.goal.name || "This goal";
    out.push({
      id: `goal-${gp.goal.id}`,
      severity: "tip",
      title: `${name} could use a boost`,
      detail:
        months !== null
          ? `To hit your date it needs ${fmt(req)}/month, and right now the plan can put in ${fmt(
              gp.allocatedMonthly,
            )}. At this pace you'll get there around ${monthYear(months)}. Moving the date back is totally fine, and so is finding a little extra.`
          : `There isn't room for it in this month's plan yet, and that's okay. Once a debt is paid off or some spending frees up, it'll start growing.`,
    });
  }

  if (!out.some((s) => s.severity === "warning" || s.severity === "tip")) {
    out.push({
      id: "on-track",
      severity: "info",
      title: "You're in great shape ✨",
      detail: "Setting up automatic transfers on payday keeps this going without thinking about it. Check back whenever life changes.",
    });
  }

  const rank = { win: 0, warning: 1, tip: 2, info: 3 } as const;
  const sorted = out.sort((x, y) => rank[x.severity] - rank[y.severity]);
  // Only one "Start here" at a time, so the list never feels like a pile of alarms.
  let seenWarning = false;
  return sorted.map((s) => {
    if (s.severity !== "warning") return s;
    if (!seenWarning) {
      seenWarning = true;
      return s;
    }
    return { ...s, severity: "tip" as const };
  });
}

/** Friendly framing for the 0-100 health score. */
export function scoreMood(score: number, hasIncome: boolean) {
  if (!hasIncome) return { label: "Let's get started", line: "Add your income to see how things look.", tone: "neutral" as const };
  if (score >= 80) return { label: "Looking strong", line: "Your money is working for you. Keep it up!", tone: "good" as const };
  if (score >= 60) return { label: "Building momentum", line: "You're on solid ground, with a few easy wins below.", tone: "good" as const };
  if (score >= 35) return { label: "Finding your footing", line: "A few small changes will make a real difference.", tone: "caution" as const };
  return { label: "Getting started", line: "Everyone starts somewhere. Let's take it one step at a time.", tone: "caution" as const };
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
