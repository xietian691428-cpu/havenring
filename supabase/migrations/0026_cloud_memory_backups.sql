-- Per-memory Plus cloud backup manifest (links Storage object → memory_id).

create table if not exists public.cloud_memory_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_id uuid not null,
  upload_id text not null,
  backed_up_at timestamptz not null default now(),
  version int not null default 1 check (version >= 1),
  byte_size bigint not null check (byte_size >= 0),
  kind text not null default 'pair_memory'
);

create unique index if not exists cloud_memory_backups_user_upload_uidx
  on public.cloud_memory_backups (user_id, upload_id);

create index if not exists cloud_memory_backups_user_memory_backed_idx
  on public.cloud_memory_backups (user_id, memory_id, backed_up_at desc);

create index if not exists cloud_memory_backups_user_backed_idx
  on public.cloud_memory_backups (user_id, backed_up_at desc);

alter table public.cloud_memory_backups enable row level security;

create policy "cloud_memory_backups_select_own"
  on public.cloud_memory_backups for select
  using (auth.uid() = user_id);
