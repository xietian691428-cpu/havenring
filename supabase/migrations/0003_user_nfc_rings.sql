-- User-bound NFC rings (UID fingerprint only; never store raw UID in plaintext).
-- Maps checklist fields: user_id, nfc_uid (stored as hash), nickname, bound_at, last_used_at, is_active.

create extension if not exists "pgcrypto";

create table if not exists public.user_nfc_rings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 hex of canonical NFC UID string (or hardware fingerprint policy).
  nfc_uid_hash    text not null,
  nickname        text not null default '',
  bound_at        timestamptz not null default now(),
  last_used_at    timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists user_nfc_rings_user_id_idx
  on public.user_nfc_rings (user_id);

create index if not exists user_nfc_rings_active_uid_idx
  on public.user_nfc_rings (nfc_uid_hash)
  where is_active = true;

-- One active binding per UID fingerprint per user; revoked rows can be replaced.
create unique index if not exists user_nfc_rings_user_uid_active_uniq
  on public.user_nfc_rings (user_id, nfc_uid_hash)
  where is_active = true;

comment on table public.user_nfc_rings is
  'Per-user NFC ring bindings; UID stored only as hash for identification.';

alter table public.user_nfc_rings enable row level security;

create policy "user_nfc_rings_select_own"
  on public.user_nfc_rings for select
  using (auth.uid() = user_id);

create policy "user_nfc_rings_insert_own"
  on public.user_nfc_rings for insert
  with check (auth.uid() = user_id);

create policy "user_nfc_rings_update_own"
  on public.user_nfc_rings for update
  using (auth.uid() = user_id);

create policy "user_nfc_rings_delete_own"
  on public.user_nfc_rings for delete
  using (auth.uid() = user_id);
