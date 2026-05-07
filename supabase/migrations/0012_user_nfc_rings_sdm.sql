-- Track Secure Dynamic Messaging state for dynamic NFC ring verification.
alter table public.user_nfc_rings
  add column if not exists sdm_enabled boolean not null default false,
  add column if not exists last_sdm_counter bigint,
  add column if not exists last_sdm_verified_at timestamptz;

create index if not exists user_nfc_rings_sdm_counter_idx
  on public.user_nfc_rings (nfc_uid_hash, last_sdm_counter)
  where is_active = true;
