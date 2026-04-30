create table if not exists public.first_run_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  event_name text not null,
  platform text null,
  locale text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists first_run_events_created_idx
  on public.first_run_events (created_at desc);

create index if not exists first_run_events_event_idx
  on public.first_run_events (event_name, created_at desc);
