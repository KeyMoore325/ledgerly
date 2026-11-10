export type ExpenseCategory = "needs" | "wants";

export interface Expense {
  id: string;
  name: string;
  amount: number; // monthly
  category: ExpenseCategory;
}

export interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number; // annual percentage rate, e.g. 19.99
  minPayment: number; // monthly
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  targetDate: string; // ISO yyyy-mm-dd, may be ""
}

export type DebtStrategy = "avalanche" | "snowball";

export interface BudgetData {
  monthlyIncome: number; // take-home pay
  expenses: Expense[];
  debts: Debt[];
  goals: Goal[];
  strategy: DebtStrategy;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  currency: string; // ISO 4217, e.g. USD
  color: string;
  createdAt: string;
  updatedAt: string;
  budget: BudgetData;
}

export type SuggestionSeverity = "info" | "tip" | "warning";

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  severity: SuggestionSeverity;
  monthlyImpact?: number;
}

/** Structured advice returned by Claude via /api/advice */
export interface Advice {
  summary: string;
  actions: { title: string; detail: string; monthly_impact: number }[];
  watch_out: string;
}
