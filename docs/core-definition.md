# Haven Ring — Core Definition

> **Single Source of Truth.** Every file, decision, and line of code in this repo
> must defer to this document. If a feature disagrees with this file, the feature
> is wrong — not the file.

---

## 1. One-sentence product

**Haven Ring** is a physical NFC ring that lets a person turn a private thought
into a **sealed, immutable** digital moment — by typing it once on their phone
and then *touching the ring* — and that lets only explicitly authorized members
of the same private haven revisit those moments, but **only** when they
physically tap a linked ring again.

It is not a journal. It is not a diary. It is not a note app. It is a **ritual
device**.

## 2. Three unbreakable principles

These are the only invariants. If a decision violates one, stop.

### 2.1 Low frequency
- The product is designed to be used **rarely** — maybe once a week, maybe once
  a year. The UI must *discourage* casual or habitual use.
- No streaks. No daily prompts. No reminders. No notifications of any kind.
- The app has **no in-UI affordance** to view sealed moments. There is no
  "history", "memories", "timeline", "search" or "export" button anywhere.
  The only way into the vault is to physically tap the ring.
- There is no feed. There is no "today's moment". There is no digest email.

### 2.2 Ritual / ceremony
- Sealing a moment requires a **physical act** (touching the ring to the phone).
  This is non-negotiable. No "seal" button. No "save" shortcut.
- Revisiting sealed moments **also** requires the physical act. Tapping the
  ring is the one, only, universal gesture this product has.
- **Hard constraint:** NFC write capability belongs to **recovery tooling**, not
  the primary user flow. Main flow is always **prewritten ring + claim**.
- Every screen change that follows a tap is full-screen, dark, and animated
  with deliberate slowness (Framer Motion). The user must *feel* that
  something happened.
- Copy is sparse, declarative, and final: *"Touch your ring to seal."*,
  *"Sealed forever."*, *"The ring is now empty and ready for a new chapter."*.
  No exclamation marks, no emoji, no confirmation toasts.
- **Sealed = immutable.** Once sealed, a moment cannot be edited, deleted
  individually, exported, or shared. The author may *revisit* it (via ring
  tap), but never alter it. The only way to remove a sealed moment is to wipe
  the whole ring — which is all-or-nothing and irreversible.

### 2.3 Zero sensitive data on the server
- The server (Supabase) **must never** see plaintext. Ever.
- All payload encryption and decryption happens in the browser via Web Crypto
  (AES-GCM 256).
- The encryption key is generated in the browser and stored **only** in
  IndexedDB (`idb-keyval`). **No backend storage, no backup, no sync, no escrow,
  no recovery.** Losing the device == losing the ability to ever decrypt. That
  is the feature, not a bug.
- Wiping a ring is the only sanctioned destructive path. It deletes all
  ciphertext rows server-side *and* destroys the local key.
- The server stores:
  - `rings` — ring id, owner id, status, a *hash* of the NFC token.
  - `moments` — ring id, opaque `encrypted_vault` blob, `iv`, `is_sealed` flag,
    `created_at`. No title, no tags, no preview, no category, no length
    bucketing, no metadata beyond that.
- The server never receives, logs, or proxies anything that could reveal
  plaintext — including via analytics, error reporting, or logs.

## 3. The user's mental model

```
I had a thought.
I typed it on my phone.
I touched my ring. — Sealed.

Weeks later, idly, I touched my ring again.
The past came back, only for a moment.
I read. I closed the app. It's locked away again until I tap next.
```

That's the whole product. Everything else is scaffolding.

## 4. The canonical NFC flow (one dynamic URL, three outcomes)

Haven Ring hardware is a **dynamic NFC ring**. Production rings use NTAG 424
DNA Secure Dynamic Messaging (SDM), so each physical tap produces a fresh,
server-verifiable URL. The SDM master key lives only in the server-side
`sdm-backend` container environment; it is never committed, shipped to the
browser, or stored in Supabase.

The ring is programmed with exactly **one** dynamic NDEF URL template:

```
https://<app>/start?picc_data=<dynamic>&cmac=<dynamic>
```

Plain UID mirroring is supported only as a compatibility mode:
`/start?uid=<uid>&ctr=<read-counter>&cmac=<dynamic>`.

`/start` calls `POST /api/rings/sdm/resolve`, which validates the tap against
`sdm-backend`, maps the verified UID to the active ring binding, rejects replayed
read counters, and returns one of three scenes:

```
User taps dynamic ring → /start?...SDM...
    │
    ├─ No active binding for verified UID
    │     └─ scene = new_ring_binding
    │
    ├─ Active binding exists, no armed seal context
    │     └─ scene = daily_access
    │
    └─ Active binding exists, authenticated owner has armed seal flow
          └─ scene = seal_confirmation
```

The same physical tap is *new ring binding*, *daily access*, and *seal
confirmation*. The server verifies that the tap is real and fresh; local product
state decides which trusted scene should continue.

## 5. Compose flow (unchanged)

```
Input (plain text in browser)
  └─ Web Crypto AES-GCM encrypt (key from IndexedDB)
      └─ POST to Supabase moments table   { encrypted_vault, iv, is_sealed: false }
          └─ UI transitions to full-screen "Touch your ring to seal"
              └─ User taps ring → /hub?token=T
                  └─ hub calls seal_moment RPC → is_sealed = true
                      └─ "Sealed forever."
```

## 6. Vault flow

```
User taps ring (nothing pending) → /hub?token=T
  └─ hub calls resolve_ring_by_token RPC → ringId
      └─ RPC hashes plaintext T inside Postgres and compares with rings.token_hash
      └─ store in-memory vaultAccess = { ringId, token, expiresAt }
          └─ redirect /vault/[ringId]
              └─ vault verifies vaultAccess matches ringId and not expired
                  └─ select sealed moments for ringId (RLS enforces ownership)
                      └─ decrypt each row locally
                          └─ render minimal, read-only, dark timeline
```

Vault access lives **only in memory** (not localStorage, not IndexedDB). When
the tab closes or reloads without a ring tap, access is gone. Default TTL
is short (order of minutes).

## 7. Wipe flow — the only destructive path

Deep inside the vault, a visually-recessed affordance reveals a confirmation
dialog. The user must type `ERASE FOREVER` exactly. On confirm:

```
wipe_ring RPC (verifies ring token server-side)
  └─ hard-delete every row in moments where ring_id = X
      └─ update rings.status = 'unclaimed', owner_id = null
          └─ client destroys IndexedDB key + clears all Zustand state
              └─ "The ring is now empty and ready for a new chapter."
```

Token handling invariant:
- Ring URL carries plaintext opaque token `T` only.
- Server/RPC computes hash at query-time (`encode(extensions.digest(T, 'sha256'), 'hex')`).
- `token_hash` is never exposed to the client or API consumers.

After a wipe:
- Server retains no ciphertext for that ring.
- Client retains no key that could decrypt old backups (if any existed).
- The ring is now an unclaimed device that can be re-paired by a new owner.

## 8. What Haven Ring is **not**

To prevent scope creep, explicit non-goals:

- **Not** a searchable, queryable journal. No list, no search, no filter, no
  export, no tags, no titles.
- **Not** a public social product. Moments can only be shared inside a private,
  explicitly consented small group haven.
- **Not** an encrypted backup service. There is no cloud restore.
- **Not** cross-device key sync. Each device keeps its own local key; a device
  can only decrypt moments it encrypted unless members intentionally use the
  same trusted device.
- **Not** a chat, a wallet, a health tracker, or a keepsake viewer.
- **Not** a gamified habit tool. No streaks, badges, counts, or reminders.
- **Not** a casual-access app. Vault access is gated by a physical tap every
  single time.

## 9. Architecture at a glance

| Layer          | Tech                                             | Why                                                           |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Shell          | Next.js 16 App Router, PWA (install-to-home)     | One codebase, offline-capable, no app store friction          |
| UI             | React 19 + Tailwind v4 + Framer Motion           | Minimal, fast, ceremony animations                            |
| Local identity | Web Crypto `SubtleCrypto` + `idb-keyval`         | Key never leaves the device                                   |
| Session        | Zustand — persisted `pending` + session `vaultAccess` | Compose state survives reloads; vault access does not    |
| Transport      | Supabase JS client (HTTPS)                       | Only ciphertext crosses the network                           |
| Server state   | Supabase Postgres + Row Level Security           | Rings, sealed moments, no plaintext                           |
| Auth           | Supabase Auth (owner of a ring)                  | Ring claiming, vault RLS, wipe authorisation                  |
| Hardware       | Dynamic NTAG 424 DNA SDM URL → `/start?...`      | One dynamic URL, one gesture, replay-resistant tap proof      |

## 10. Language policy

- Product targets global users (excluding mainland China) with **English as the
  default UI language** across PWA and app.
- Optional language packs are available in:
  - English (`en`)
  - French (`fr`)
  - Spanish (`es`)
  - German (`de`)
  - Italian (`it`)
- Recovery copy, security prompts, and wipe confirmations must be translated
  consistently with the same legal/meaning precision as English.

The ring itself holds the SDM app configuration, not user content. A verified
SDM response proves *"this specific ring was tapped right now"*, not identity,
not plaintext content.

## 11. Decision guardrails for future work

Before adding any feature, answer all five:

1. Does this increase the **frequency** of app use? → Reject.
2. Does this create any way to reach the vault **without** a ring tap
   (e.g. "remember me", "recent view", "login & browse")? → Reject.
3. Does this weaken the **ritual** (e.g. "seal without touching the ring",
   "quick-save draft", "edit a sealed moment")? → Reject.
4. Does this require the **server** to ever see plaintext, user-typed metadata,
   or anything that could be correlated to content? → Reject.
5. Does this create a **recovery or backup path** for the encryption key? → Reject.

If all five are "no", the feature may be discussed.
