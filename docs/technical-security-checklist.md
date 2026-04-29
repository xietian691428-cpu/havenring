# Technical & security checklist (Haven Ring)

## Data model

| Item | Status |
|------|--------|
| `user_nfc_rings` (`user_id`, `nfc_uid` **as hash**, `nickname`, `bound_at`, `last_used_at`, `is_active`) | Migration `0003_user_nfc_rings.sql` — server stores **SHA-256** of normalized UID (`nfc_uid_hash`), not raw wire UID. |
| Max one **active** binding per `(user_id, nfc_uid_hash)` | Partial unique index. |

## Local encryption

| Item | Status |
|------|--------|
| AES-GCM for local blobs | `src/services/encryptionService.js` |
| User-derived wrapping key (PBKDF2) | `deriveUserWrappingKey()` for migrating to passphrase-bound local keys. |

## Backend API

| Route | Purpose |
|-------|---------|
| `POST /api/nfc/bind` | Auth user; requires `X-Haven-Secondary-Verified: 1` and `privacy_acknowledged: true`; max 5 active rings. |
| `GET /api/nfc/list` | Lists current user’s bindings. |
| `POST /api/nfc/revoke` | Sets `is_active = false` (requires same secondary header). |
| `POST /api/auth/nfc-login` | Looks up active hash; returns JWT **if** `SUPABASE_JWT_SECRET` is set (Dashboard → API → JWT Secret). |

## Integrity

| Item | Status |
|------|--------|
| `moments.content_sha256` | Migration `0004_moments_content_sha256.sql` |
| Client canonical hash | `src/utils/memoryIntegrity.js` — use before sync to compare with server. |

## Privacy copy

| Location | Status |
|----------|--------|
| Ring setup intro | `RingSetupWizard` + `ringSetupContent` + link to `/privacy-policy` or `NEXT_PUBLIC_PRIVACY_POLICY_URL` |
| Settings | NFC bind / unbind / digital legacy lines + policy link |
| `app/privacy-policy/page.tsx` | Placeholder — replace with legal text. |

## Environment

- `SUPABASE_JWT_SECRET` — required for minting Supabase-compatible access tokens in `/api/auth/nfc-login` (same value as in Supabase project settings).
- `SUPABASE_JWT_ISS` — optional explicit issuer claim for NFC JWT; if omitted, app derives `<NEXT_PUBLIC_SUPABASE_URL>/auth/v1`.
- `NFC_ACCESS_TOKEN_SECONDS` — optional default NFC access JWT lifetime (seconds, default 90 days).
- `NFC_LONG_SESSION_MAX_SECONDS` — optional long-session NFC JWT lifetime (seconds, default 10 years cap).
- `NEXT_PUBLIC_NFC_ACCESS_GRANT_TTL_DAYS` — optional browser ring-grant TTL in days (default 90).
- `NEXT_PUBLIC_NFC_LONG_ACCESS_GRANT_TTL_DAYS` — optional browser long ring-grant TTL in days (default 3650).

## Test scenarios

See [security-checklist-tests.md](./security-checklist-tests.md).

## RLS owner-only verification SQL (single-user mode)

Use these checks in Supabase SQL Editor to validate owner-only access for
`user_nfc_rings` and optional owner-only mode for `moments`.

```sql
-- 1) user_nfc_rings must be strict owner-only for all operations
alter table public.user_nfc_rings enable row level security;

drop policy if exists "user_nfc_rings_select_own" on public.user_nfc_rings;
drop policy if exists "user_nfc_rings_insert_own" on public.user_nfc_rings;
drop policy if exists "user_nfc_rings_update_own" on public.user_nfc_rings;
drop policy if exists "user_nfc_rings_delete_own" on public.user_nfc_rings;

create policy "user_nfc_rings_select_own"
  on public.user_nfc_rings
  for select
  using (auth.uid() = user_id);

create policy "user_nfc_rings_insert_own"
  on public.user_nfc_rings
  for insert
  with check (auth.uid() = user_id);

create policy "user_nfc_rings_update_own"
  on public.user_nfc_rings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_nfc_rings_delete_own"
  on public.user_nfc_rings
  for delete
  using (auth.uid() = user_id);

-- 2) Optional: if product is pure owner-only (no shared haven),
-- enforce owner check on moments by created_by_user_id as well:
-- create policy "moments_owner_insert"
--   on public.moments for insert
--   with check (auth.uid() = created_by_user_id);
-- create policy "moments_owner_update"
--   on public.moments for update
--   using (auth.uid() = created_by_user_id)
--   with check (auth.uid() = created_by_user_id);
-- create policy "moments_owner_delete"
--   on public.moments for delete
--   using (auth.uid() = created_by_user_id);
```
