# Haven — Core Definition

> **Single source of truth for product intent.** Every file, decision, and line of code
> must defer to this document. If shipping code disagrees with **Current direction** below,
> treat the code as **legacy to migrate** (Phase 1+), not as permission to extend old UX.

---

## 当前生效产品方向（2026-06 更新）

**This section overrides all older text in this file and in other docs.**

### What Haven is

**Haven is a personal private Memory Sanctuary** — local-first, end-to-end encrypted,
with an optional NFC ring for a **Seal ritual only**. Optional **Pair mode** (max 2 people,
2 rings, 2 accounts) shares **sealed** memories automatically; drafts stay private until seal.
Not a shared-login device and not a “tap ring to open the app” product.

### Login and unlock

- **Only** personal account sign-in: **Apple**, **Google**, or **Email** (OAuth via Supabase).
- Daily use: open the PWA at **`/app`** → **Timeline (Memories)** with a normal session.
- **No ring-based login, unlock, or “enter Haven” gesture.** `POST /api/auth/nfc-login` stays disabled.

### What the ring does

| Ring **does** | Ring **does not** |
|---------------|-------------------|
| **Seal** — physical confirmation after the user composes a memory | Sign in or unlock the app |
| **First bind** — associate this physical ring with the **current** logged-in account | Open Timeline or vault for daily browsing |
| Prove a fresh, server-verifiable tap (SDM) during Seal | Grant access to another person’s account or memories |

**Canonical daily loop:** write memory in app → **Seal with Ring** → touch **your** ring → encrypted local save (optional Plus cloud).

### Account and sharing model

- **Default:** one person, one account, one ring (binding is per account).
- **Pair mode (lightweight):** invite a partner (separate OAuth account) → max **2** `haven_members`.
  - **Drafts** stay private on each device until sealed.
  - **Sealed** memories are visible to both Pair members (imported via `GET /api/sync/pair-bundles`).
  - Core sealed content is **immutable**; either partner may **append notes** only.
- **Plus cloud backup** keeps Pair sealed content in sync across devices (primary paid sync path).
- No multi-person groups, no complex permissions, no shared login.

### Pair join — foolproof UX (shipping target)

Users never choose Join vs Bind, Retire, or invite types. The app picks the path.

**Sender (has a ring, not yet paired):**

1. **Rings** or **Settings → Add Partner** → share link (QR / Copy / Share).
2. Wait on **Waiting for partner to join…** (Cancel anytime).

**Receiver (opens partner link):**

1. One screen: **Join [Name]'s Haven to share sealed memories with them?**
2. Sign in if needed (same screen, no steps).
3. **Join** + device password (security only). **Cancel** exits.
4. **Has a ring already:** server migrates into partner Haven — **no re-tap**.
5. **No ring yet:** brief **Hold your ring once** → returns to same Join screen → **Join**.
6. Success → **You're all set.** → **Open shared memories.**

**Automatic (no user action):**

- Stale local ring cache → **Syncing…** on Rings.
- Pair complete → **Linked with Partner** status; sharing on by default.
- Retire / lost ring → **Settings → Session → Advanced** only.

**APIs (unchanged):** `POST /api/haven/invite`, `GET /api/haven/invite/preview`, `POST /api/nfc/bind` + `joinExistingRingToInviteHaven`.

### Background fault tolerance (shipping target)

Users never see technical errors, manual Retry buttons, or blocking recovery gates for normal network/cache issues.

**Automatic (background only):**

- **Pair / ring sync** — `resolvePairState()` on app open and foreground; stale local rings pruned; auto-retry with backoff.
- **Seal offline queue** — finalize failures enqueue in `offlineSyncQueue`; flushed on reconnect and lifecycle hooks.
- **Pair import queue** — failed pair bundle import re-queued and retried silently.
- **Hash / integrity drift** — reconciled in background; Timeline shows **Syncing in the background.** at most.
- **Multi-tab Seal** — other tab finishing shows **Finishing…**; cross-tab lock handled internally.

**User-visible copy (≤1 sentence):**

| Situation | Copy |
|-----------|------|
| Seal saved locally, network down | Saved on this device — we'll sync when you're back online. |
| NFC / tap retry | Hold your ring near your phone once more. |
| Cross-tab Seal in progress | Finishing… |
| Background sync | Syncing in the background. |
| Session truly expired | Sign in to continue. |

**Only blocks main flow:** missing OAuth session (sign-in gate). Everything else is background + calm status lines.

### Copy and UX

- **Minimal in-flow copy:** ≤1 short sentence per screen for the action at hand.
- Explanations, privacy detail, and troubleshooting → **Settings** and **Help** only.
- **`/start`** is for **NFC bind** and **Seal confirmation** — not daily app entry.

### Storage

- **Local-first:** encrypted memories in IndexedDB (`localMemoryStore`); primary read path is Timeline after OAuth.
- **Target limits:** generous local media (goal **20MB+ per attachment** on device); avoid arbitrary small caps in product design.
- **Plus cloud:** optional E2E backup/sync and larger payloads (implementation backlog).
- **Note:** shipping code may still enforce smaller staging caps (e.g. seal staging ~2MB) until Phase 1 refactors land — do not treat those as the long-term product ceiling.

### Privacy invariant (unchanged)

- Server must not receive or store **plaintext** memory content.
- Web Crypto (AES-GCM) in the browser; ciphertext only over the network.

---

## Deprecated concepts — do not extend

| Deprecated | Replacement |
|------------|-------------|
| `daily_access` = “Opening Haven…” / ring unlocks app | OAuth → `/app` Timeline; idle ring tap → short hint to start Seal in app (Phase 1) |
| Vault / memories **only** via ring tap | Timeline + Memory detail after sign-in |
| Mandatory **Ring Setup Gate** before using app | Optional bind in Settings / Rings; soft prompt only |
| Implicit 5-ring family vault | **Pair** (max 2) + personal drafts |
| Ring as **access credential** / NFC login JWT | Supabase session only |
| Long ritual copy on `/start` | One line + Help |
| “No timeline / no history UI” (old §2.1) | Timeline is the primary memory surface |

---

## 1. One-sentence product (current)

**Haven** lets a signed-in person capture private memories on their phone, **seal** chosen moments with a physical ring tap, and revisit them from their own account — local-first, encrypted, calm, and without ring-based login.

## 2. Principles (current)

### 2.1 Calm, low-noise use

- No streaks, spammy notifications, or habit gamification.
- **Timeline** is the normal place to browse **your** memories after sign-in.
- The ring adds meaning at **Seal** time, not on every app open.

### 2.2 Seal ritual (ring-required for Seal with Ring)

- **Seal with Ring** requires a physical tap after compose (SDM-verified).
- Revisiting memories does **not** require a ring tap (session + local decrypt).
- NFC tag **write** remains **recovery / factory** only; retail flow is prewritten SDM URL → `/start`.

### 2.3 Local-first encryption

- Encrypt/decrypt in the browser; keys and plaintext memories stay on device by default.
- Optional Plus cloud backup/sync must remain E2E from the client’s perspective.
- Server stores binding metadata, seal tickets, and ciphertext blobs — never plaintext story/media.

## 3. User mental model (current)

```
I sign in with my Apple / Google / Email account.
I open Haven and see my memories.

I write something that matters.
I tap Seal with Ring and touch my ring.
It’s sealed — calm, final, mine.

Later I open the app again — no ring needed to read.
If I share with someone I trust, I mark it Shared (Plus) or export — explicitly.
```

## 4. NFC / SDM flow (target behavior)

Hardware: dynamic NTAG 424 DNA URL → `https://<app>/start?picc_data=…&cmac=…`

`POST /api/rings/sdm/resolve` verifies the tap. **Product target** scenes:

```
User taps ring → /start?...SDM...
    │
    ├─ UID not bound to any account
    │     └─ new_ring_binding → bind to current session (or sign-in first)
    │
    ├─ UID bound, seal flow armed in app
    │     └─ seal_confirmation → finalize seal ticket
    │
    └─ UID bound, no seal armed  [LEGACY: daily_access — TO REMOVE]
          └─ TARGET: one-line “Open Haven to seal a memory” → /app (no unlock narrative)
```

SDM proves **this ring was tapped now**; it does **not** prove identity — OAuth does.

## 5. Compose and seal flow (code-aligned)

```
Sign in (OAuth) → New memory (NewMemoryPage)
  └─ arm seal prep (lib/seal-flow, draft ids)
      └─ User taps ring → /start → sdm/resolve (seal_confirmation)
          └─ POST /api/seal/finalize (precheck + commit)
              └─ Encrypted row in localMemoryStore (+ optional cloud backlog)
                  └─ /seal-success ceremony → back to Timeline
```

**Save securely** (without ring) may remain as a secondary path until product retires it.

## 6. What Haven is **not** (current)

- Not ring-based login or “tap to enter someone’s Haven.”
- Not a shared couple vault where membership implies all memories visible.
- Not a social feed or public sharing network.
- Not plaintext-on-server storage.
- Not a requirement to bind a ring before using the app (bind is for Seal + ownership).

## 7. Architecture snapshot

| Layer | Role |
|-------|------|
| `/app` PWA shell | OAuth session, Timeline, compose, settings |
| IndexedDB + Web Crypto | Local encrypted memories |
| Supabase Auth | Apple / Google / Email session |
| SDM + `/api/rings/sdm/resolve` | Tap verification for bind + seal |
| Seal tickets + finalize | Server-audited seal commit |
| Plus (target) | E2E cloud, Shared memories, larger media |

## 8. Language policy

- English-first (`en`); optional `fr`, `es`, `de`, `it`.
- In-flow strings stay short; legal and help content may be longer.

## 9. Decision guardrails (current)

Before shipping a feature, ask:

1. Does it require a **ring tap to browse** memories? → **Reject** (except Seal ritual).
2. Does it sign a user in **without** their OAuth account? → **Reject**.
3. Does it expose **another account’s** memories via a ring tap? → **Reject**.
4. Does it send **plaintext** to the server? → **Reject**.
5. Does in-flow copy exceed **one necessary sentence** without living in Help? → **Revise**.

---

## Appendix — superseded text (archival only)

<details>
<summary>Pre-2026-06 definitions (do not implement)</summary>

- “Only way into the vault is to physically tap the ring.”
- “No timeline, history, or search in UI.”
- “Revisiting sealed moments requires physical tap every time.”
- “Three equal outcomes: new_ring_binding, daily_access, seal_confirmation” as daily entry model.
- Small-group Haven with equivalent ring read for all members as the **primary** sharing story.

</details>
