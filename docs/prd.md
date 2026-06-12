# Haven PRD (Working)

> Aligned with **当前生效产品方向（2026-06 更新）** in `docs/core-definition.md`.

---

## 当前生效产品方向（2026-06 更新）

- **Personal Memory Sanctuary** — individual-first; local-first + E2E encryption.
- **Login:** Apple / Google / Email only (OAuth). **No ring login.**
- **Ring:** **Seal ritual + first bind** only — not daily unlock or app entry.
- **Daily loop:** Open app (Timeline) → write → Seal with Ring → tap own ring → sealed locally.
- **Sharing:** Explicit **Shared** memories (Plus) or export — not implicit full Haven membership vault.
- **Copy:** ≤1 sentence in-flow; Help/Settings for depth.
- **Storage:** Local target 20MB+ per attachment; Plus cloud for larger/E2E sync.

---

## Product goal

Deliver a calm, privacy-first memory app where users can:

- Sign in with a **personal account** and browse memories on **Timeline** without a ring.
- **Seal** chosen moments with a physical ring tap (SDM-verified ritual).
- Optionally use **Haven Plus** for E2E cloud backup and **explicitly shared** memories.

The product must stay globally usable (excl. mainland China), low-noise, and free of ring-based authentication.

## Target market and language

- Global users excluding mainland China.
- Default UI: English (`en`); optional `fr`, `es`, `de`, `it`.

## Core constraints

1. Main hardware flow: **prewritten SDM ring + bind** (factory); NFC write = recovery only.
2. **No plaintext** on server.
3. **Seal** requires physical ring tap when using Seal with Ring.
4. **Browsing** does **not** require a ring tap (OAuth session + local decrypt).
5. SDM resolve may still return `daily_access` in code — **deprecated**; Phase 1 removes unlock UX.
6. Production ring URL: `/start?...SDM...` → bind or seal confirm only (target).

## Acceptance criteria (hard)

1. **Onboarding:** New user can sign in, use Timeline, and complete first **Seal** without extra tools (bind ring when ready, not blocked from app).
2. **Daily usage:** PWA at `/app` is sufficient for read/compose/seal/settings.
3. **Security:** Ring tap never signs user into another account; `nfc-login` stays disabled.
4. **Recovery:** Controlled recovery rewrite for tags (native/recovery tooling) — not daily path.
5. **Sharing (target):** Shared memories are **opt-in per item** (Plus), not automatic couple vault.

## Deprecated acceptance (do not reintroduce)

- Revisit memories **only** by ring tap.
- Ring as daily app launcher (`daily_access` “Opening Haven”).
- Mandatory ring bind before any app use.
- Small-group Haven where membership implies read access to **all** sealed moments.

## Implementation roadmap

### A. PWA — Phase 1 (alignment)

- Converge `/start` to bind + seal confirm; remove daily-access redirect narrative.
- Soft optional ring setup (Settings / Rings).
- Minimal copy; expand Help.
- Remove/hide NFC silent login client.

### B. Backend — maintain

- `POST /api/rings/sdm/resolve` (SDM verify + seal tickets).
- `POST /api/seal/finalize`.
- `POST /api/nfc/bind` / revoke (per-account binding).
- Keep `nfc-login` **410**.

### C. Plus — Phase 2

- True E2E cloud backup (`cloudBackupService` replacement).
- **Shared** memory flag + sync.
- Raise local/cloud media limits toward 20MB+ product target.

### D. Native app (later)

- Recovery rewrite only; not required for daily use.
