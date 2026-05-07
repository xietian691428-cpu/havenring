# Haven Ring PRD (Working)

## Product Goal

Deliver a ritual-first dynamic NFC ring experience where users can:
- Capture a private moment
- Seal it with a physical tap
- Revisit sealed moments only by tapping the ring again
- Optionally run as a consented small-group haven with equivalent ring abilities

The product must stay low-frequency, privacy-preserving, and globally usable.

## Target Market and Language

- Global users excluding mainland China.
- Default language across PWA and app: English (`en`).
- Optional languages:
  - French (`fr`)
  - Spanish (`es`)
  - German (`de`)
  - Italian (`it`)

## Core Constraints

1. Main user flow is always **prewrite + claim**.
2. NFC write is a **recovery-only capability**, not a primary user feature.
3. No plaintext on server.
4. Seal and vault entry require physical tap ritual.
5. Production hardware is a dynamic SDM NFC ring; one verified tap entry resolves
   to new binding, daily access, or seal confirmation.

## Acceptance Criteria (Hard)

1. New-user first-use experience:
   - **A new user must be able to go from receiving a ring to first seal without
     any "download/install extra tool" step.**
2. Daily usage:
   - PWA remains sufficient for compose/seal/vault/wipe.
3. Recovery:
   - Native app recovery mode can rewrite tag with verification and rollback.
4. Security:
   - Tokens are server-issued and revocable.
5. Group authorization:
   - Adding a new ring to a shared haven requires explicit member consent.

## Implementation Roadmap

### A. PWA (near-term)

- Claim flow UX refinement
  - No NFC support:
    - "NFC is not available on this device."
  - Permission denied / unavailable:
    - "NFC access is unavailable. Try another device."
  - Ring inactive / not claimed:
    - "This ring is not active yet. Continue to claim."
- English-first copy with structured i18n keys for en/fr/es/de/it.

### B. Backend (near-term)

- Token authority APIs
  - Dynamic SDM resolve endpoint (server-only verifier proxy)
  - Legacy token issue/revoke endpoints for recovery compatibility
  - Audit trail for token lifecycle
- Existing RPC alignment
  - `resolve_ring_by_token`
  - `seal_moment`
  - `wipe_ring`

### C. Native app (later, recovery-only)

- Recovery Mode only:
  - Two-phase write (temp marker -> final token)
  - Mandatory read-back verification
  - Retry/rollback handling for partial failure
- Must not become a prerequisite for normal daily use.
