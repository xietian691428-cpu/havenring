# Group Haven Migration Manual

> ## ⚠️ LEGACY — Phase 5 (2026-06)
>
> **Do not build new product features on this model.**
>
> | Era | Model |
> |-----|--------|
> | **Current** | Personal Memory Sanctuary per account. Sharing = **Plus explicit Shared** only. |
> | **Legacy (this doc)** | `havens` + `haven_members` + partner invite → pair-scoped rings and implicit haven-wide reads. |

## Current product (Phase 5)

- **Default:** one person, one account, local-first memories on device.
- **Ring:** optional bind; owner account only may seal with that ring (`lib/haven-access.ts`).
- **Sync:** `/api/sync/moments` returns moments for **owner rings only** — not haven-wide.
- **Second ring:** legacy invite path retained for recovery (`PartnerInvitePanel`, `/api/haven/invite/*`) — de-emphasized in UI, not removed.
- **Plus:** optional cloud backup + explicit sharing when user chooses (not automatic via membership).

## What remains in code (backward compatibility)

| Artifact | Status |
|----------|--------|
| `havens`, `haven_members`, `ring_invites` tables | DB legacy; bind/invite still write rows |
| `haven_member_keys` | Legacy key wrap for invite recovery |
| `/api/nfc/list` | Shows legacy pair rings in same haven (`legacyPairRing`) for display |
| `currentUserIsHavenMember` in SDM resolve | Deprecated telemetry field only |
| `linkedToYourHaven` in uid-status | Deprecated bind UX hint |

## Historical goal (pre–Phase 5)

Upgrade Haven Ring from single-owner ring access to consent-based small group access:

- Any existing member could authorize adding a new ring.
- New ring join required both tap token + invite consent.
- All linked rings in the same haven had equivalent seal/read capabilities.

**Superseded by:** per-account library + opt-in Shared items (Plus).

## Schema (still in DB)

- Group scope tables: `havens`, `haven_members`, `ring_invites`.
- `haven_id` on `rings` and `moments` for legacy authorization scope.
- RPCs: `issue_ring_invite`, `link_ring_by_invite`.

## Security model (historical)

- Invite hash only; one-time 24h invite.
- Linking required authenticated user + invite + physical tap.
- Membership controlled access (RLS by `haven_members`).

## Rollout / regression

1. Schema: `supabase/migrations/0017_dual_account_haven_pair.sql`
2. Legacy invite APIs: `app/api/haven/invite/*`, `app/api/nfc/bind`
3. Contract checks: `scripts/verify-flow-contracts.ts` (dual-account + phase 5 personal-first)

## Migration checklist (operators)

- [ ] Do not market “shared Haven” or couple auto-sync.
- [ ] Deploy Phase 5 API changes (`haven-access`, sync/moments owner scope).
- [ ] When Plus Shared ships per-memory flags, narrow RLS further per `docs/core-definition.md`.
