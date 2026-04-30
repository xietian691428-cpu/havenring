create table if not exists public.seal_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ring_uid_hash text not null,
  draft_ids jsonb not null default '[]'::jsonb,
  ticket_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists seal_tickets_ticket_hash_idx
  on public.seal_tickets (ticket_hash);

create index if not exists seal_tickets_user_expires_idx
  on public.seal_tickets (user_id, expires_at desc);

