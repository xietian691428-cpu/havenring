-- User subscription and trial entitlements.
-- Hardware purchase drives acquisition: first successful ring claim/bind grants
-- a 30-day Haven Plus trial. Plus unlocks cloud backup, up to 5 rings, and
-- Seal with Ring. Free remains local-first with one ring and Save Securely.

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  plus_trial_start timestamptz,
  plus_trial_end timestamptz,
  plus_subscription_status text not null default 'none'
    check (plus_subscription_status in ('none', 'active', 'past_due', 'canceled')),
  plus_subscription_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_entitlements_trial_idx
  on public.user_entitlements (plus_trial_end);

alter table public.user_entitlements enable row level security;

create policy "user_entitlements_select_own"
  on public.user_entitlements for select
  using (auth.uid() = user_id);

create policy "user_entitlements_insert_own"
  on public.user_entitlements for insert
  with check (auth.uid() = user_id);

create policy "user_entitlements_update_own"
  on public.user_entitlements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
