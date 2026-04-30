create table if not exists public.seal_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  endpoint text not null,
  phase text not null,
  outcome text not null,
  error_code text null,
  mode text null,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists seal_telemetry_events_created_idx
  on public.seal_telemetry_events (created_at desc);

create index if not exists seal_telemetry_events_outcome_idx
  on public.seal_telemetry_events (outcome, created_at desc);

create index if not exists seal_telemetry_events_user_idx
  on public.seal_telemetry_events (user_id, created_at desc);
