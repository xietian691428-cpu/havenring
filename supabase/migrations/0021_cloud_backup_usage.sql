-- Plus cloud backup usage tracking (50 GB hard quota enforced in API).

create table if not exists public.cloud_backup_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bytes_used bigint not null default 0 check (bytes_used >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_backup_usage_updated_idx
  on public.cloud_backup_usage (updated_at desc);

alter table public.cloud_backup_usage enable row level security;

create policy "cloud_backup_usage_select_own"
  on public.cloud_backup_usage for select
  using (auth.uid() = user_id);
