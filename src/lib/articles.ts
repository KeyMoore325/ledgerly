export interface Article {
  slug: string;
  title: string;
  summary: string;
  date: string; // ISO
  readMinutes: number;
  body: string[]; // paragraphs; lines starting with "## " render as headings
}

export const articles: Article[] = [
  {
    slug: "avalanche-vs-snowball",
    title: "Avalanche vs. snowball: choosing a debt payoff strategy",
    summary:
      "Both methods get you debt-free. One saves the most money, the other builds momentum. Here's how to pick.",
    date: "2026-10-28",
    readMinutes: 4,
    body: [
      "Both strategies start the same way. You pay the minimum on every debt, then put every extra dollar toward one target debt. When it's gone, its payment rolls into the next one.",
      "## Avalanche: lowest total cost",
      "The avalanche method targets the debt with the highest interest rate first. Because the most expensive balance shrinks first, you pay the least interest overall. It's the mathematically optimal choice.",
      "## Snowball: quickest wins",
      "The snowball method targets the smallest balance first. You close accounts sooner, and that can keep you motivated. The extra cost is often modest when your interest rates are similar.",
      "## How to choose",
      "If your rates vary a lot, for example a 24% credit card next to a 5% car loan, the avalanche usually saves real money. If your rates are close, or you've struggled to stick with a plan before, the snowball's early wins may be worth it. Ledgerly's planner simulates both on your own numbers, so you can see the difference in dollars.",
    ],
  },
  {
    slug: "50-30-20-rule",
    title: "The 50/30/20 rule, and when to bend it",
    summary:
      "A simple split for needs, wants and savings. Treat it as a guideline, especially in high-cost cities.",
    date: "2026-10-14",
    readMinutes: 3,
    body: [
      "The 50/30/20 rule splits take-home pay into three buckets: about 50% for needs, 30% for wants, and 20% for savings and extra debt payments.",
      "## What counts as a need",
      "Housing, groceries, utilities, insurance, transportation to work, and minimum debt payments. If skipping it would cause real harm or a penalty, it's a need.",
      "## When to bend it",
      "In high-rent areas, needs can easily pass 50%. That's fine as long as you take the difference out of wants, not savings. When you're paying off high-interest debt, a temporary 50/20/30 split, with 30% going to savings and debt, can get you out much faster.",
      "Ledgerly shows your actual split in real time and flags the bucket that's furthest from the guideline.",
    ],
  },
  {
    slug: "emergency-fund-first",
    title: "Why an emergency fund comes before investing",
    summary:
      "A cash buffer keeps one bad month from becoming a year of credit card interest.",
    date: "2026-09-30",
    readMinutes: 3,
    body: [
      "An emergency fund is cash you can reach within a day, set aside for job loss, medical bills or urgent repairs. It isn't an investment. It's insurance against taking on new debt.",
      "## How much",
      "Start with a starter buffer of one month of essential costs, then build toward three to six months. Freelancers and single-income households should aim for the higher end.",
      "## Where to keep it",
      "Use a high-yield savings account at a separate bank from your checking. It's easy to reach when you need it, and just inconvenient enough that you won't dip into it on impulse.",
      "If you don't have an emergency goal yet, the planner suggests one sized to your actual essential expenses.",
    ],
  },
];

export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);
