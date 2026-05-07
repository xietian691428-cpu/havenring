# Ring Provisioning Standard

> Scope: supply-chain prewrite, first-use claim, recovery-mode rewrite, and
> language/UX constraints for global users (excluding mainland China).

---

## 1. Product posture (must not change)

- Primary flow is **prewritten ring + claim**.
- NFC write is a **fallback/power feature** used in recovery only.
- Users must not perceive ring setup as a required configuration task.
- No third-party tools may appear in the normal path to first seal.

## 2. Entry-point model

### 2.1 Primary surface
- **PWA** is the daily product surface (compose, seal, vault, wipe).

### 2.2 Secondary surface
- **Native app** exists for:
  - Recovery rewrite
  - Ring diagnostics
  - High-trust security operations
- Native app must not be required for first-time core use.

## 3. Lock-tag strategy

- Default policy: **do not lock tag**.
- Advanced option may offer permanent lock with explicit irreversible warning:
  - "Lock this ring permanently? This cannot be undone."
- Software controls are preferred over hardware lock:
  - Token revocation
  - Server-side verification
  - RLS ownership checks

## 4. Token authority

- Production ring authority is **SDM dynamic verification**. Token issuance is
  kept only for legacy/recovery compatibility and remains server-side only.
- Client-generated tokens are disallowed.
- Required guarantees:
  - Auditable provisioning
  - Revocable credentials
  - Fresh-tap verification through SDM read counters / CMAC
  - Controlled lifecycle for compromised rings
- Canonical dynamic ring URL format:
  - `https://<app-domain>/start?picc_data=<dynamic>&cmac=<dynamic>`
  - Plain mirror compatibility: `https://<app-domain>/start?uid=<uid>&ctr=<counter>&cmac=<dynamic>`
- `MASTER_KEY` belongs only in the server/container environment for
  `icedevml/sdm-backend`. It must never appear in source code, committed config,
  client bundles, Supabase tables, logs, analytics, or support transcripts.

## 5. Write reliability (Recovery Mode only)

Recovery rewrite must use a deterministic two-step protocol:

1. Phase 1 (temporary marker):
   - Write temporary setup URL, e.g. `/setup?temp=<id>`
2. Phase 2 (final token):
   - Write final URL `/hub?token=<token>`
3. Post-write verification:
   - Immediate read-back
   - Exact URL match required
4. Failure handling:
   - Automatic retry when safe
   - Explicit user retry flow otherwise

UX instructions must remain simple:
- "Hold your ring near your phone."
- "Don't move it."

## 6. Device compatibility boundary

No hidden workarounds. Capability must be explicit:

- Supported:
  - iPhone XS+ (Core NFC-capable devices)
  - Most NFC-capable Android devices
- Unsupported:
  - Phones without NFC
  - Partial/low-end devices with unreliable write support

Required message when unsupported:
- "Your device can't set up this ring. Use another phone or contact support."

## 7. Reset and re-pair permission model

Two-level model:

- Level 1 (default user):
  - Can revoke ring
  - Can add a new ring
  - Cannot arbitrarily rewrite old ring tokens
- Level 2 (Recovery Mode):
  - Explicitly entered for loss/damage/replacement scenarios
  - Allows controlled rewrite and replacement

Avoid unrestricted "free write" UX.

## 8. Supply-chain prewrite specification

Each ring is prewritten before user handoff:

1. Provision the dynamic NFC ring with the production SDM keyset.
2. Write the canonical `/start?...SDM...` URL template to the ring.
3. Read-back and server-verify at least one live tap through
   `POST /api/rings/sdm/resolve`.
4. Store only server-side binding identifiers such as `nfc_uid_hash`; never
   store raw UID as plaintext.
5. Mark ring as distribution-ready with immutable audit trail.

## 9. First-use claim flow (main flow)

1. User receives ring.
2. User taps ring.
3. Browser opens PWA via `/start?...SDM...`.
4. App verifies the dynamic tap and returns `scene = new_ring_binding`.
5. User can immediately compose and seal.

Acceptance requirement:
- No extra tool installation step is allowed between unboxing and first seal.

## 10. Global language policy

- Default UI language: English (`en`) for both PWA and app.
- Optional languages:
  - French (`fr`)
  - Spanish (`es`)
  - German (`de`)
  - Italian (`it`)
- Provisioning/recovery/security copy must be translated with semantic parity.
- If locale detection fails, fallback to English.

## 11. PRD acceptance criteria

1. A new user can go from unboxing to first sealed moment without installing
   any extra tools.
2. Daily use requires no native app dependency.
3. Recovery rewrite is available only through controlled Recovery Mode.
4. Token issuance and revocation are server-authoritative.
5. Write verification and failure rollback paths are test-covered.
