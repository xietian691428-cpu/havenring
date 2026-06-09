-- Ephemeral encrypted seal staging (cross-tab / private browsing handoff).

create table if not exists public.seal_staging (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_ids jsonb not null default '[]'::jsonb,
  ciphertext text not null,
  iv text not null,
  content_sha256 text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists seal_staging_user_expires_idx
  on public.seal_staging (user_id, expires_at desc);

create index if not exists seal_staging_expires_idx
  on public.seal_staging (expires_at)
  where consumed_at is null;

alter table public.seal_tickets
  add column if not exists staging_id uuid null references public.seal_staging(id) on delete set null;

alter table public.seal_staging enable row level security;

revoke all on table public.seal_staging from anon, authenticated;
grant all on table public.seal_staging to service_role;
