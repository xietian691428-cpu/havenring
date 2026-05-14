-- One active NFC UID may belong to at most one Haven account at a time.
-- Re-linking for a different user requires the previous owner to revoke (is_active = false).
-- If this migration fails with a unique violation, two accounts already share the same
-- active UID hash — resolve in SQL (deactivate one row) before retrying.

create unique index if not exists user_nfc_rings_active_uid_global_uniq
  on public.user_nfc_rings (nfc_uid_hash)
  where (is_active = true);

comment on index public.user_nfc_rings_active_uid_global_uniq is
  'Globally unique active binding per NFC UID hash; pairs with per-user uniqueness.';
