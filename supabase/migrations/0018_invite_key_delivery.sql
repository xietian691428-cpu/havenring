-- Server-delivered invite key packages (replaces URL #key= hash for IM-safe sharing).

alter table public.ring_invites
  add column if not exists key_token_hash text,
  add column if not exists key_package text;

create index if not exists ring_invites_key_token_hash_idx
  on public.ring_invites (key_token_hash)
  where key_token_hash is not null and consumed_at is null and cancelled_at is null;
