# Haven Ring — Architecture decisions

This document reflects the **current shipping code** (Next.js App Router + PWA shell under `src/`). It is the single place for **product intent + technical shape** so Phase 3+ refactors stay aligned.

---

## 1. Final product summary

| | |
|---|---|
| **Name** | **Haven Ring** — private memory sanctuary anchored by an NFC ring (“Haven Ring”). |
| **Audience** | Primarily US/EU; user-facing copy is English-first. |
| **Business model** | **Hardware-led acquisition** + **subscription profit**: buying a ring drives onboarding; **Haven Plus** ($4.90/mo or $49/yr) funds cloud backup and premium rituals. **Binding or claiming a ring** triggers a **30-day Haven Plus trial** (`user_entitlements.plus_trial_*`, `lib/subscription.ts`). |
| **Data posture** | **Local-first by default**: sealed memories and media live in **IndexedDB** on device; **optional encrypted cloud sync** is a Plus enhancement, not a prerequisite. |
| **Core idea** | **Local-First + Hardware Ritual**: the ring is a physical trust anchor for sealing; the app remains usable offline with local encryption. |

---

## 2. Recommended directory structure (current + direction)

```
app/                    # Next.js routes, API routes, marketing/legal pages
  start/                # Ring tap / onboarding (StartClient)
  bind-ring/            # Post-verify bind flow → /api/nfc/bind
  api/
    rings/sdm/resolve/  # Canonical SDM verifier (replay-safe counter)
    sdm/verify/         # LEGACY forwarder → resolve
    seal/finalize/      # Seal ticket commit
    subscription/status/# GET subscription snapshot (Bearer)
    ...

src/
  app-shell/            # PWA shell: AppShell (providers + router), AppRouter, AppChrome
  providers/            # SessionProvider, SubscriptionProvider, RingProvider
  App.js.bak            # Historical note only (former re-export shim; do not resurrect App.js)
  features/
    memories/           # Canonical local-first: IndexedDB encrypted memories + idb drafts
    subscription/       # Types, canUseFeature, entitlement copy (barrel)
    seal/                 # Seal-with-Ring orchestration (client)
  views/                # Screen components (timeline, new memory, rings, …)
  services/
    localMemoryStore.ts # Re-export shim → ../features/memories/localMemoryStore
    localStorageService.js # Legacy path → still works
    draftBoxService.js  # Re-export shim → ../features/memories/draftBoxStore
    encryptionService.js# Web Crypto port — localCrypto façade
    ...
  state/                # App flow machine (gates, recovery)
  hooks/
  content/              # Copy modules

lib/
  subscription.ts       # Server-side entitlements / trial
  supabase/             # Clients + types
  seal-flow.ts          # Client seal arm flags
  ...

docs/                   # Operational + architecture notes
haven-pwa-legacy/       # Frozen static PWA snapshot (NOT in Next build). Paths use `/haven-pwa-legacy/`.
supabase/migrations/    # DB schema (rings, user_nfc_rings, seal_tickets, entitlements, …)
```

**Refactor direction:** new code should import **`@/src/features/memories`** (or `localMemoryStore` / `draftBoxStore` / `memoryRepository` therein) instead of growing `localStorageService.js` / `draftBoxService.js`.

**Shims:** `src/services/localMemoryStore.ts` and `draftBoxService.js` re-export from `features/memories` so existing imports keep working.

### 2.1 App entry and shell split (completed)

- **`app/page.tsx`** is the Next.js **`/`** entry. It owns the **first-run redirect** (`/start` when onboarding / first-memory FTUX flags are incomplete) and, when allowed, renders **`<AppShell />`** imported from **`@/src/app-shell/AppShell`**.
- **`src/app-shell/AppShell.tsx`** wraps the tree: **`AppFlowProvider` → `SessionProvider` → `SubscriptionProvider` → `RingProvider` → `AppRouter`**. Global chrome and tab routing live under **`AppRouter`** / **`AppChrome`** — not in `app/page.tsx`.
- **`src/App.js`** was removed as redundant; **`src/App.js.bak`** documents the old single-line re-export pattern. **Do not reintroduce** `src/App.js` — use **`AppShell`** directly.

---

## 3. Authentication and Seal (end-to-end)

### 3.1 Authentication (account)

1. User signs in with **Apple** or **Google** via **Supabase Auth** (`lib/supabase/client.ts`, `SessionProvider`).
2. Authenticated API calls use **`Authorization: Bearer <access_token>`**.
3. Optional **NFC long-session** path: `POST /api/auth/nfc-login` issues a JWT-style access token when `SUPABASE_JWT_SECRET` is configured (`lib/supabase-access-jwt.ts`). This is **not** a refresh-token model; security notes live in `docs/technical-security-checklist.md`.
4. **Device trust** (password / recovery codes) gates sensitive local operations (`deviceTrustService.js`).

### 3.2 Ring binding (hardware trust in the account)

- **Dynamic NFC** payloads are verified server-side: **`POST /api/rings/sdm/resolve`** (canonical). Legacy **`POST /api/sdm/verify`** forwards to the same handler.
- Replay protection: **`user_nfc_rings.last_sdm_counter`** must **strictly increase** for bound rings.
- Binding: **`POST /api/nfc/bind`** creates/updates **`user_nfc_rings`** and can activate **Plus trial** (`activatePlusTrialForUser`).

### 3.3 Seal with Ring (hardware ritual)

1. User composes a memory; for **Seal with Ring**, drafts may be stored via **`draftBoxService` / `draftBoxRepository`** (`idb-keyval`).
2. Client arms seal context (`lib/seal-flow.ts`) and may pass **`context: seal_confirmation`** into SDM resolve together with **`draft_ids`**.
3. Server verifies SDM, optionally issues a **short-lived seal ticket** (`seal_tickets` table, issued in `app/api/rings/sdm/resolve/route.ts`).
4. Client calls **`POST /api/seal/finalize`** (`mode: precheck` then `commit`) with the ticket and draft payloads; server uses **`seal_finalize_atomic`** RPC for atomicity (`supabase/migrations/0009_*`).
5. Successful paths clear local draft state; **memories of record** remain in **`localMemoryStore`** (encrypted).

**Feature gating:** **Free** tier uses **Save Securely** paths; **Seal with Ring** requires **Plus or active trial** (`canUseFeature(..., "seal_with_ring")`, `lib/subscription.ts` + `GET /api/subscription/status`).

---

## 4. Local-First + Hardware Ritual — three layers

| Layer | Role | Primary code / data |
|-------|------|---------------------|
| **L1 — Local-first core** | Default: create/read memories **on device** without cloud. | `localMemoryStore.ts` / `memoryRepository`, `encryptionService.js` / **`localCrypto`** |
| **L2 — Account & device safety** | OAuth session, optional NFC login JWT, device passphrase / recovery; sync health & flow gates. | `SessionProvider`, `deviceTrustService.js`, `ringSyncService.js`, `appFlowMachine` |
| **L3 — Hardware ritual & cloud** | Verified ring tap (SDM), seal tickets, optional **Plus** cloud backup & higher limits. | `app/api/rings/sdm/resolve`, `app/api/seal/finalize`, `user_nfc_rings`, `user_entitlements` |

### Repository pattern (local storage)

- **`memoryRepository`** (`localMemoryStore.ts`): **encrypted** persisted memories (IndexedDB `haven_ring_memories_db`). Only this layer (plus `encryptionService`) should own persistence details.
- **`draftBoxRepository`** (`draftBoxService.js`): **plaintext drafts** for seal-in-progress UX; **must not** be treated as long-term vault — finalized memories belong in `memoryRepository`.
- **`localCrypto`** (`encryptionService.js`): **crypto port** consumed by memory repository; future stores (attachments cache, export bundles) should reuse it instead of duplicating Web Crypto.

### Next steps (optional backlog)

- Typed **`DraftItem`** in a small `draftBoxTypes.ts` (or migrate `draftBoxService` to `.ts`).
- Single **`LocalDataModule`** barrel export to document allowed imports for “data layer.”
- Migrate `encryptionService.js` → `.ts` when convenient; keep **`localCrypto`** as the stable façade.

---

## 5. Related docs

- `docs/database-schema.md` — tables (`user_nfc_rings`, `seal_tickets`, `user_entitlements`, …).
- `docs/technical-security-checklist.md` — SDM, NFC login, rate limits.
- `docs/core-definition.md` — product narrative (keep in sync with this file when terms change).
