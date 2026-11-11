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
cp .env.example .env.local   # optionally add ANTHROPIC_API_KEY and Supabase keys
npm run dev                  # http://localhost:3000
```

`npm run build && npm start` runs a production build.

## Turn on accounts (Supabase)

Accounts are optional. Without them the app runs in guest mode. To switch them on:

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Add your keys.** In the dashboard, open **Project Settings → API Keys** and copy the Project URL and the publishable key (or the legacy `anon` key) into `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Never put the `service_role` / secret key in this app.
3. **Create the table.** Open **SQL Editor**, paste in `supabase/migrations/0001_budgets.sql`, and run it. It creates `public.budgets`, turns on row-level security so each person only sees their own budgets, and enables Realtime. It is safe to run more than once.
4. **Set the redirect URLs.** Under **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (your real domain in production)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
5. **Restart the dev server** so it picks up the new env vars.

Email confirmation is on by default, so new users get a "confirm your email" link that lands on `/auth/callback`. Supabase's built-in email sender is rate-limited and meant for testing; add your own SMTP under **Authentication → Emails** before launch.

When someone signs up, the budgets already on their device are copied into their new account. If they sign in to an account that already has budgets, the planner asks before adding the device's budgets.

## Features → where they live

| Feature | Implementation |
|---|---|
| Budget engine (50/30/20, health score, avalanche/snowball simulation, goal funding, suggestions) | `src/lib/budget.ts` |
| Real-time updates | Calculations rerun on every keystroke. Profiles sync across open tabs via `BroadcastChannel` and `storage` events (`src/lib/store.ts`) |
| User profiles | Multiple budgets with name, currency, color, and JSON export/import (`/profile`) |
| Accounts (optional) | Email + password sign-in with Supabase. Budgets sync to Postgres with row-level security and update live across devices. Guests keep using browser storage (`src/lib/store.ts`, `src/lib/auth.ts`, `/login`) |
| AI advice ("using Claude") | `src/app/api/advice/route.ts`. Sends only budget numbers. Uses server-side refusal fallbacks. Without a key the app shows a friendly "not set up" message, and the rule-based suggestions still work |
| Dark mode | System default with a light/dark/system toggle, and a pre-paint script to avoid a flash |
| Contact form | Client and server validation, honeypot and rate limit. Messages are appended to `data/messages.jsonl`. Swap in an email provider when you deploy |
| RSS feed | `/rss.xml` built from `src/lib/articles.ts` |
| SEO | Per-page metadata, canonical URLs, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` |
| Accessibility | Semantic landmarks, skip link, labeled inputs, focus-visible styles, `aria-live` updates, reduced-motion support, 44px touch targets |

## Notes

- Without Supabase keys, budgets are stored in the browser (`localStorage`) and the Sign in button is hidden.
- Set `NEXT_PUBLIC_SITE_URL` in production so canonical, sitemap and RSS links are absolute.
- The guidance is general budgeting information, not financial advice.
