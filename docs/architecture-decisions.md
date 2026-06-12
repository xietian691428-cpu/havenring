# Haven — Architecture decisions

This document records **product intent + technical shape** for agents and engineers.
It must stay aligned with `docs/core-definition.md`.

---

## 当前生效产品方向（2026-06 更新）

| Topic | Decision |
|-------|----------|
| **Positioning** | Personal **Memory Sanctuary** (individual-first). |
| **Auth** | Supabase OAuth only: **Apple / Google / Email**. No NFC login. |
| **Ring** | **Seal ritual + bind only** — not daily unlock or app entry. |
| **Daily UX** | `/app` → **Timeline** with session; compose → Seal → ring tap. |
| **Sharing** | **Explicit Shared** memories (Plus, E2E) or export/import — **not** implicit full Haven membership read. |
| **Copy** | ≤1 sentence in-flow; detail in Settings / Help. |
| **`/start`** | NFC bind + Seal confirm only; shrink legacy branches (Phase 1). |
| **Storage** | Local-first; target **20MB+** local attachments; Plus for larger cloud (code limits may lag). |

**Code vs direction:** Shipping code may still implement `daily_access`, `RING_SETUP_GATE`, and `haven_members` sharing. Treat those as **legacy**; new work follows the table above and must not deepen deprecated paths.

### Deprecated / weakening (do not extend)

- `daily_access` “Opening Haven…” redirect as primary ring behavior.
- Mandatory ring setup gate before app use.
- Couple **Haven pair** as the main sharing metaphor.
- Client NFC silent login (**removed Phase 1**). Legacy ring access grants in `deviceTrustService` may remain until Phase 4.
- Ring described as access credential in user-facing copy.

---

## 1. Product summary

| | |
|---|---|
| **Name** | **Haven** / Haven Ring — personal memory sanctuary; NFC ring for **Seal** ritual. |
| **Audience** | US/EU; English-first UI. |
| **Business** | Hardware + **Haven Plus** (Seal with Ring, E2E cloud, Shared memories, storage). Ring bind may still trigger Plus trial in code (`lib/subscription.ts`). |
| **Data** | **Local-first** IndexedDB; optional Plus cloud (target: true E2E implementation). |
| **Core loop** | OAuth → Timeline → write → **Seal with Ring** → SDM tap → local encrypted memory. |

---

## 2. Repository layout (current + direction)

```
app/
  app/page.tsx          → /app shell (OAuth gate → AppShell)
  start/                → NFC: bind + seal confirm (converge in Phase 1)
  bind-ring/            → POST /api/nfc/bind
  login/                → OAuth entry
  api/
    rings/sdm/resolve/  → SDM verify; scenes (legacy daily_access → deprecate)
    seal/finalize/        → Seal ticket commit
    auth/nfc-login/     → DISABLED (410) — keep disabled
    auth/secondary-token/ → Short-lived token after device verify (bind/revoke)

src/
  app-shell/            → AppRouter (default route: timeline)
  features/memories/    → localMemoryStore (canonical)
  features/seal/        → Seal orchestration
  state/appFlowMachine  → gates (RING_SETUP_GATE → target: optional/soft)

lib/
  seal-flow.ts          → Client seal arm state
  subscription.ts       → Entitlements
```

**Import rule:** prefer `@/src/features/memories` over growing legacy shims.

### 2.1 Entry points

| Route | Role (target) |
|-------|----------------|
| `/` | Marketing |
| `/login` | OAuth sign-in → `/app` |
| `/app` | **Primary app** — Timeline, compose, settings |
| `/start` | **Ring NFC only** — bind, seal confirmation |
| `/hub` | **Legacy** token router — migrate to `/start` or recovery-only |

---

## 3. Authentication

### 3.1 Account session (canonical)

1. User signs in with **Apple**, **Google**, or **Email** via Supabase (`SessionProvider`).
2. APIs use `Authorization: Bearer <access_token>`.
3. **`POST /api/auth/nfc-login`** returns **410** — ring must never bootstrap OAuth.

### 3.2 Device trust (implementation detail)

- Local device password / recovery (`deviceTrustService.js`) gates **bind, revoke, seal step-up** — not app login.
- `POST /api/auth/secondary-token` issues short-lived server tokens for high-risk NFC APIs.

**Phase 1+ consideration:** simplify device password if OAuth re-auth suffices for bind/revoke.

---

## 4. Ring binding

- Ring binds to **the authenticated account** that completes bind (`POST /api/nfc/bind`).
- SDM verification via `POST /api/rings/sdm/resolve`; replay protection via `last_sdm_counter`.
- **Technical cap (shipping code):** max **2** active rings per user/Haven row (`FREE_RING_LIMIT` / `PLUS_RING_LIMIT` = 2). **Product target:** one ring per person for Seal; do not market multi-ring family sharing.
- Retired rings are **non-transferable** in normal flows.

### Legacy: Haven pair + partner invite

- DB tables `havens`, `haven_members`, partner invite APIs still exist.
- **Product direction:** deprecate as the sharing model; replace with per-memory **Shared** (Plus).
- Do not add features that assume “all Haven members see all moments.”

---

## 5. Seal with Ring

1. User composes on `NewMemoryPage`; arms seal (`lib/seal-flow.ts`).
2. Ring tap → `/start` → `sdm/resolve` with `context: seal_confirmation` + `draft_ids`.
3. Server issues seal ticket → `POST /api/seal/finalize` (precheck/commit).
4. Memory persists in **`localMemoryStore`** (encrypted).
5. iOS Private: seal staging + cron purge (Phase 3) — unchanged technically.

**Gating (shipping):** `canSealWithRing` requires Plus or trial — product may revisit for “ring owners always seal.”

---

## 6. SDM scenes — target mapping

| Scene | Shipping behavior | Target product |
|-------|-------------------|----------------|
| `new_ring_binding` | Bind flow | **Keep** |
| `seal_confirmation` | Finalize seal | **Keep** |
| `daily_access` | Redirect / “Opening Haven…” | **Remove** — replace with neutral hint + `/app` |

---

## 7. Three technical layers

| Layer | Role | Code |
|-------|------|------|
| **L1 Local** | Memories on device | `localMemoryStore`, `encryptionService` |
| **L2 Account** | OAuth, device trust, flow gates | `SessionProvider`, `deviceTrustService`, `appFlowMachine` |
| **L3 Ritual & cloud** | SDM, seal tickets, Plus backup | `sdm/resolve`, `seal/finalize`, cloud backlog |

---

## 8. Storage strategy

| Tier | Target |
|------|--------|
| **Local** | Primary; attachments **20MB+** per file (product goal; raise code limits in Phase 1/2). |
| **Seal staging** | Ephemeral cross-tab handoff; shipping ~2MB cap — not the long-term user limit. |
| **Plus cloud** | E2E encrypted backup + Shared memory sync; larger objects in object storage. |

---

## 9. Phase 1 engineering alignment (planned — not yet code)

1. Remove `daily_access` unlock UX from `StartClient`.
2. Soft optional ring setup (drop hard `RING_SETUP_GATE`).
3. Delete or hide NFC silent login client paths.
4. Converge `/start` to bind + seal only.
5. Update in-flow copy to ≤1 sentence; move prose to Help.
6. Document Shared-memory schema/API when Plus cloud is implemented.

---

## 10. Related docs

| Doc | Purpose |
|-----|---------|
| `docs/core-definition.md` | Product SSOT |
| `docs/prd.md` | Working PRD (aligned 2026-06) |
| `docs/haven-user-journey.md` | Code-aligned journeys (being updated) |
| `docs/ring-provisioning.md` | Factory / SDM (hardware unchanged) |
| `docs/database-schema.md` | Schema (legacy Haven tables noted) |
| `docs/group-haven-migration-manual.md` | **Deprecated** product path — schema reference only |
