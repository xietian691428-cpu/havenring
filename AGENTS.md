<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 当前生效产品方向（2026-06 更新）— READ FIRST

**All agents must follow this before any code, copy, or API design.**

| Rule | Requirement |
|------|-------------|
| **Product** | Haven = **personal Memory Sanctuary** (individual-first). |
| **Login** | **Apple / Google / Email** OAuth only — **never** ring-based login. |
| **Ring** | **Seal ritual + bind only** — not unlock, not “open Haven,” not vault entry. |
| **Daily use** | User opens **`/app`** (Timeline) signed in; **no ring required to view** own memories. |
| **Seal loop** | Write memory → Seal with Ring → tap **own** ring → local encrypt (+ optional Plus cloud). |
| **Sharing** | **Explicit Shared** memories (Plus) or export — **not** implicit couple Haven full read. |
| **Copy** | In-flow ≤ **1 sentence**; explanations → Settings / Help. |
| **`/start`** | NFC **bind + seal confirm** only — do not add daily-access / unlock flows. |
| **Storage** | Local-first; design for **20MB+** local media; Plus for larger cloud. |

**SSOT:** `docs/core-definition.md` and `docs/architecture-decisions.md`. If your change conflicts, **stop and align with docs** (or update docs first with user approval).

### Deprecated — do not implement or extend

- `daily_access` as “Opening Haven” / ring unlock UX.
- `POST /api/auth/nfc-login` or client silent NFC login.
- Mandatory **Ring Setup Gate** blocking app without a bound ring.
- **Couple Haven pair** as primary positioning (“one shared Haven, two rings, shared vault”).
- Ring as **access credential** in copy or gates.
- Long explanatory strings on `/start` or composer (use Help).

### Legacy code (may exist until Phase 1 — do not deepen)

- `haven_members`, partner invite, `daily_access` in `sdm/resolve`, `RING_SETUP_GATE`, `hub-router`. (`nfcSilentAuthService` removed Phase 1.)

---

## Product: ring limit and binding (technical constants)

Haven is **not** multi-ring family sharing. Position as **one person, one account, one seal ring** (product); code may allow up to **2** active bindings per account/Haven row for legacy pair flows.

- **Max active NFC rings:** **2** (`FREE_RING_LIMIT` / `PLUS_RING_LIMIT` in `lib/subscription.ts` and `src/features/subscription/subscriptionTypes.ts`). **Do not regress to 5.**
- **Shop checkout cap:** `MAX_RING_QUANTITY` in `lib/shop/catalog.ts`.
- **PWA local registry cap:** `MAX_BOUND_RINGS` in `src/services/ringRegistryService.js` (must match server `ringLimit`).
- **Server enforcement:** `POST /api/nfc/bind` — ring binds to **authenticated user**; legacy Haven invite path exists but is **deprecated for product**.
- **Non-transferable ring:** activated rings are not released for rebind to another account in normal flows; retire for loss/security only.
- **Plus tier:** Seal with Ring, cloud backup, Shared memories, storage — **not** extra ring slots as upsell.
- **Never** shared OAuth between partners; each person uses their own Apple/Google/Email account.
- **Contract check:** `npx tsx scripts/verify-flow-contracts.ts` asserts ring-limit constants stay at 2.

See `docs/architecture-decisions.md` §4–§5.
