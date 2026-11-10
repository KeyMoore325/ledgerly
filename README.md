# Ledgerly: Budget Planner

A mobile-first budget planner. Enter your income, expenses, debts and goals to get a live budget health score, a debt payoff plan, goal projections and specific suggested adjustments. You can also get a personalized review from Claude.

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript.** Static pages for SEO, plus API routes for AI advice and the contact form.
- **Plain CSS with design tokens** (`src/app/globals.css`), with light and dark themes and no UI framework.
- **Anthropic SDK** (`@anthropic-ai/sdk`) using `claude-opus-5-5` with structured JSON output.
- **zod** validates input on every API route.

## Run it

```bash
npm install
cp .env.example .env.local   # optionally add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

`npm run build && npm start` runs a production build.

## Features → where they live

| Feature | Implementation |
|---|---|
| Budget engine (50/30/20, health score, avalanche/snowball simulation, goal funding, suggestions) | `src/lib/budget.ts` |
| Real-time updates | Calculations rerun on every keystroke. Profiles sync across open tabs via `BroadcastChannel` and `storage` events (`src/lib/store.ts`) |
| User profiles | Multiple local profiles with name, email, currency, color, and JSON export/import (`/profile`) |
| AI advice ("using Claude") | `src/app/api/advice/route.ts`. Sends only budget numbers. Uses server-side refusal fallbacks. Without a key the app shows a friendly "not set up" message, and the rule-based suggestions still work |
| Dark mode | System default with a light/dark/system toggle, and a pre-paint script to avoid a flash |
| Contact form | Client and server validation, honeypot and rate limit. Messages are appended to `data/messages.jsonl`. Swap in an email provider when you deploy |
| RSS feed | `/rss.xml` built from `src/lib/articles.ts` |
| SEO | Per-page metadata, canonical URLs, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` |
| Accessibility | Semantic landmarks, skip link, labeled inputs, focus-visible styles, `aria-live` updates, reduced-motion support, 44px touch targets |

## Notes

- Profiles are stored in the browser (`localStorage`). There are no server accounts yet. To add real sign-in, put an auth provider and a database behind `src/lib/store.ts`'s `actions`.
- Set `NEXT_PUBLIC_SITE_URL` in production so canonical, sitemap and RSS links are absolute.
- The guidance is general budgeting information, not financial advice.
