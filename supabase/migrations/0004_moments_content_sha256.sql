-- Optional integrity digest for sealed payloads (client-computed SHA-256 hex of canonical plaintext bundle).

alter table public.moments
  add column if not exists content_sha256 text;

comment on column public.moments.content_sha256 is
  'SHA-256 hex over canonical sealed plaintext bundle for sync integrity checks.';
