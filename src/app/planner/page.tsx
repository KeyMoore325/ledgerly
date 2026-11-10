import type { Metadata } from "next";
import { Planner } from "@/components/Planner";

export const metadata: Metadata = {
  title: "Budget planner",
  description:
    "Enter your income, expenses, debts and savings goals. See your budget health, debt-free date and specific adjustments to reach your goals.",
  alternates: { canonical: "/planner" },
};

export default function PlannerPage() {
  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Planner</p>
        <h1>Your budget plan</h1>
        <p>Results update as you type. Everything is saved in this browser, so there&apos;s nothing to submit.</p>
      </header>
      <Planner />
    </div>
  );
}
