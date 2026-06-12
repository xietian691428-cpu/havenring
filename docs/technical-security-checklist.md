# Technical & security checklist (Haven)

> **Product direction (2026-06):** Personal sanctuary; OAuth login only; ring for **Seal + bind**,
> not vault unlock. See `docs/core-definition.md`.

---

## 当前生效产品方向（2026-06 更新）— security implications

| Area | Requirement |
|------|-------------|
| Auth | Supabase OAuth (Apple / Google / Email). **`nfc-login` disabled (410).** |
| Ring tap | Must **not** sign user into another account or expose partner memories. |
| SDM | Replay-safe counters; `seal_confirmation` only when seal armed. |
| `daily_access` | **Legacy scene** — must not become ring-based vault unlock (Phase 1 UX removal). |
| Bind/revoke | Authenticated user + secondary token + device verify. |
| Data | No plaintext memory content on server. |

---

## Data model

| Item | Status |
|------|--------|
| `user_nfc_rings` (hashed UID, `is_active`, SDM counters) | Migration `0003`, `0012` |
| Max one active binding per `(user_id, nfc_uid_hash)` | Partial unique index |
| `havens` / `haven_members` | **Legacy schema** — product moving to explicit Shared memories |

## Local encryption

| Item | Status |
|------|--------|
| AES-GCM local blobs | `src/services/encryptionService.js` |
| PBKDF2 wrapping key | `deriveUserWrappingKey()` |

## Backend API

| Route | Purpose |
|-------|---------|
| `POST /api/rings/sdm/resolve` | SDM verify; scenes: `new_ring_binding`, `seal_confirmation`, **legacy** `daily_access` |
| `POST /api/nfc/bind` | Bind ring to **authenticated user**; secondary token; max 2 active rings (code constant) |
| `POST /api/nfc/revoke` | Retire credential |
| `POST /api/auth/secondary-token` | Short-lived token after device verify |
| `POST /api/auth/nfc-login` | **Disabled (410)** — ring must not replace OAuth |

## Integrity

| Item | Status |
|------|--------|
| `moments.content_sha256` | Migration `0004` |
| Client hash | `src/utils/memoryIntegrity.js` |

## Privacy copy

| Location | Direction |
|----------|-----------|
| In-flow | ≤1 sentence |
| Ring setup / bind | Short + link to `/privacy-policy` |
| Detail | Settings / Help |

## Environment

- `CRON_SECRET` — seal staging purge cron (see `.env.example`).
- `SDM_BACKEND_URL`, `MASTER_KEY` (sdm-backend only) — SDM verification.
- `SUPABASE_*` — OAuth session.
- Legacy NFC JWT env vars — only if `nfc-login` were re-enabled (**forbidden by product direction**).

## Test scenarios

See [security-checklist-tests.md](./security-checklist-tests.md). Dual-account Haven tests are **legacy regression** until schema/UX migrates to Shared memories.

## RLS notes

Owner-only `user_nfc_rings` policies remain required. **Target product** is owner-scoped memories with optional explicit Shared sync — not broad Haven member read for all rows.
