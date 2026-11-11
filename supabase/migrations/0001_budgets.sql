-- Ledgerly: budgets saved to user accounts
-- Run this once in your Supabase project (Dashboard → SQL Editor → New query → paste → Run).
-- It is safe to run again: every statement checks whether its object already exists.

-- 1. Table ---------------------------------------------------------------------
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_name text not null default 'My budget' check (char_length(budget_name) between 1 and 60),
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  color       text not null default '#2563EB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- income, expenses, debts, goals and payoff strategy (see BudgetData in src/lib/types.ts)
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists budgets_user_id_idx on public.budgets (user_id);

-- 2. Keep updated_at current -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- 3. Row-level security: people can only ever see and change their own budgets ---
alter table public.budgets enable row level security;

drop policy if exists "Read own budgets" on public.budgets;
create policy "Read own budgets" on public.budgets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Create own budgets" on public.budgets;
create policy "Create own budgets" on public.budgets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Update own budgets" on public.budgets;
create policy "Update own budgets" on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own budgets" on public.budgets;
create policy "Delete own budgets" on public.budgets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Live updates across devices ----------------------------------------------------
-- Realtime respects the policies above, so each person only receives their own rows.
-- Deleted rows only broadcast their id (default replica identity), never their contents.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets'
  ) then
    alter publication supabase_realtime add table public.budgets;
  end if;
end;
$$;
