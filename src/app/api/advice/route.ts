import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { analyze, formatDuration } from "@/lib/budget";
import type { Advice } from "@/lib/types";

export const runtime = "nodejs";

const money = z.number().finite().min(0).max(1e9);
const BudgetSchema = z.object({
  monthlyIncome: money,
  strategy: z.enum(["avalanche", "snowball"]),
  expenses: z.array(z.object({ id: z.string(), name: z.string().max(80), amount: money, category: z.enum(["needs", "wants"]) })).max(100),
  debts: z.array(z.object({ id: z.string(), name: z.string().max(80), balance: money, apr: z.number().min(0).max(100), minPayment: money })).max(50),
  goals: z.array(z.object({ id: z.string(), name: z.string().max(80), target: money, saved: money, targetDate: z.string().max(10) })).max(50),
});
const RequestSchema = z.object({ budget: BudgetSchema, currency: z.string().regex(/^[A-Z]{3}$/) });

// Shape Claude must return (enforced server-side by structured outputs)
const adviceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "actions", "watch_out"],
  properties: {
    summary: { type: "string", description: "Two or three sentences on where this budget stands." },
    actions: {
      type: "array",
      description: "3 to 5 specific, prioritized adjustments.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "monthly_impact"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          monthly_impact: { type: "number", description: "Estimated monthly money freed or redirected; 0 if not applicable." },
        },
      },
    },
    watch_out: { type: "string", description: "One risk or caveat worth keeping in mind." },
  },
} as const;


const SYSTEM = `You are a calm, practical budgeting coach inside a budget planning web app.
The user gives you their monthly budget plus the app's own computed analysis.
Recommend specific, realistic adjustments that help them reach their goals: name the line items, give amounts in their currency, and keep each suggestion achievable within a month or two.
Rank the actions by impact. Prefer the app's numbers over your own arithmetic.
This is general budgeting guidance, not personalized investment, tax or legal advice, so don't recommend specific securities or financial products.
Be warm and plain-spoken. Avoid jargon and don't moralize about spending.`;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export async function POST(req: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid budget data." }, { status: 400 });
  }

  const { budget, currency } = body;
  const a = analyze(budget, currency);
  const snapshot = {
    currency,
    monthly_income: budget.monthlyIncome,
    expenses: budget.expenses.map(({ name, amount, category }) => ({ name, amount, category })),
    debts: budget.debts.map(({ name, balance, apr, minPayment }) => ({ name, balance, apr, min_payment: minPayment })),
    goals: budget.goals.map(({ name, target, saved, targetDate }) => ({ name, target, saved, target_date: targetDate || null })),
    debt_strategy: budget.strategy,
    analysis: {
      left_over_each_month: Math.round(a.available),
      split_percent: {
        needs_and_debt_minimums: Math.round(a.ratios.needs * 100),
        wants: Math.round(a.ratios.wants * 100),
        savings: Math.round(a.ratios.savings * 100),
      },
      surplus_plan: a.allocation,
      debt_free_in: formatDuration(a.payoff.months),
      projected_interest: a.payoff.totalInterest,
      goals: a.goals.map((g) => ({
        name: g.goal.name,
        on_track: g.onTrack,
        required_monthly: g.requiredMonthly && Math.round(g.requiredMonthly),
        funded_monthly: Math.round(g.allocatedMonthly),
      })),
      health_score: a.healthScore,
      today: new Date().toISOString().slice(0, 10),
    },
  };

  try {
    const response = await getClient().beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: adviceSchema } },
      messages: [
        {
          role: "user",
          content: `Here is my budget as JSON. What should I adjust to reach my goals?\n\n${JSON.stringify(snapshot)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Claude couldn't help with this request. Try adjusting your inputs." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens") {
      return Response.json({ error: "The response was cut off. Please try again." }, { status: 502 });
    }
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const advice = JSON.parse(text) as Advice;
    return Response.json({ advice });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "AI advice isn't configured: the Anthropic API key is invalid." }, { status: 503 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many requests right now. Please wait a moment and retry." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return Response.json({ error: "The AI service had a problem. Please try again shortly." }, { status: 502 });
    }
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Received an unexpected response. Please try again." }, { status: 502 });
    }
    // Most commonly: no credentials found (ANTHROPIC_API_KEY unset)
    console.error("Advice route error", err);
    return Response.json(
      { error: "AI advice isn't set up on this server. Add ANTHROPIC_API_KEY to .env.local to enable it." },
      { status: 503 },
    );
  }
}
