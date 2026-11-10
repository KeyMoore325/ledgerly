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
        <p className="eyebrow">Your planner</p>
        <h1>Let&apos;s map out your money</h1>
        <p>Fill in what you know and skip what you don&apos;t. Your plan takes shape as you type, and you can change anything anytime.</p>
      </header>
      <Planner />
    </div>
  );
}
