# Security & QA scenarios (NFC / sync / privacy)

> **Product direction (2026-06):** OAuth daily use; ring for Seal/bind only. Tests marked **LEGACY**
> guard old Haven-pair behavior until Phase 2 migration.

Run before release; automate where possible.

---

## 当前生效产品方向（2026-06 更新）— test priorities

| Priority | Scenario |
|----------|----------|
| P0 | OAuth required for Timeline; `nfc-login` → **410** |
| P0 | Stranger + ring cannot read victim memories |
| P0 | Seal path: arm → SDM → finalize → local memory |
| P1 | Bind/revoke requires secondary token |
| P1 | Idle ring tap does **not** grant cross-account access |
| P2 | **LEGACY** dual-account Haven pair (until deprecated) |

---

## Auth and ring role

1. Unauthenticated `GET /api/cron/*` → 401 without secret.
2. `POST /api/auth/nfc-login` → **410** for any UID.
3. Signed-in user opens Timeline **without** ring tap.
4. `bind` without secondary token → **403**.

## Multi-ring (technical cap)

1. Bind ring via `POST /api/nfc/bind` (session + `X-Haven-Secondary-Token`).
2. Same UID cannot be active on two accounts.
3. Retired UID cannot rebind to another account in normal flows.
4. Max **2** active rings per account/Haven row (code constant).

## Lost ring / revoke

1. Revoke via `POST /api/nfc/revoke` + secondary token.
2. `nfc-login` with that UID → **410**.
3. Local memories remain on device; server binding inactive.

## Seal path

1. Compose → arm seal → SDM `seal_confirmation` → finalize.
2. Offline seal draft behavior per platform strategy (`getSealStrategy`).
3. iOS Private: staging upload/read/purge cron (when enabled).

## iOS vs Android

1. Android: Web NFC optional for in-app scan helpers.
2. iOS: ring URL opens `/start`; staging for cross-tab seal.

---

## LEGACY — Dual-account shared Haven regression

> **Deprecated product path.** Keep passing until Haven membership model is removed or narrowed.
> Do **not** add new features that depend on this.

1. Partner A binds ring A → one-person Haven created.
2. Partner invite → B binds ring B with separate OAuth.
3. Third account cannot access Haven moments.
4. Third active ring → **409** `HAVEN_PAIR_FULL`.

---

## Cross-device sync

1. Same **user account** on two devices → Timeline loads local/cloud per backup settings.
2. **Target:** Shared memories only when explicitly marked (Plus) — not yet fully implemented.

## Cron / staging

1. `POST /api/cron/purge-seal-staging` requires `CRON_SECRET` (Bearer or `X-Cron-Secret`).
2. Expired staging rows purged; telemetry logged.
