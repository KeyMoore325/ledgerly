export const site = {
  name: "Ledgerly",
  tagline: "Budget planning that tells you what to do next",
  description:
    "Ledgerly is a free budget planner. Enter your income, expenses, debts and goals, and get clear, realistic adjustments to reach them faster.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
};

export const nav = [
  { href: "/planner", label: "Planner" },
  { href: "/insights", label: "Insights" },
  { href: "/profile", label: "Profiles" },
  { href: "/contact", label: "Contact" },
];
