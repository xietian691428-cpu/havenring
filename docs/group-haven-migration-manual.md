# Group Haven Migration Manual

## Goal

Upgrade Haven Ring from single-owner ring access to consent-based small group access:

- Any existing member can authorize adding a new ring.
- New ring join requires both tap token + invite consent.
- All linked rings in the same haven have equivalent seal/read capabilities.
- Privacy model remains unchanged: ciphertext only on server.

## What Changed

- Added group scope tables: `havens`, `haven_members`, `ring_invites`.
- Added `haven_id` to `rings` and `moments` for shared authorization scope.
- Expanded ring event actions for authorization audit:
  - `ring_link_request`
  - `ring_link_approved`
  - `ring_link_rejected`
- Added secure RPC contracts:
  - `issue_ring_invite(p_haven_id)`
  - `link_ring_by_invite(p_token, p_invite_code)`

## Security Model

- No invite plaintext persisted; only `sha256(invite_code)` hash.
- Invite is one-time, expires quickly (default 10 minutes), and can be cancelled.
- Linking a ring requires:
  - authenticated user
  - valid invite
  - physical ring tap token
- Membership controls all access (RLS by `haven_members`).

## Rollout Steps

1. Run `docs/database-schema.md` sections in order:
   - Extensions
   - Tables
   - Compatibility migration
   - Indexes
   - RLS
   - RPCs
2. Validate schema:
   - `rings.haven_id` exists
   - `moments.haven_id` exists
   - `havens`, `haven_members`, `ring_invites` tables exist
3. Validate function availability:
   - `issue_ring_invite`
   - `link_ring_by_invite`
4. Smoke test:
   - User A issues invite for haven
   - User B taps ring and completes `link_ring_by_invite`
   - User B can read/write moments in same haven
   - Existing User A access remains unchanged

## Backward Compatibility

- Existing single-ring users are migrated to one-person havens.
- Existing flows remain valid until UI routes are switched from ring scope to haven scope.
- Existing RPCs can coexist with new invite/link RPCs during transition.

## API Transition Guidance

- Current: ring-scoped reads/writes (`ring_id`).
- Target: haven-scoped reads/writes (`haven_id`) with ring retained for audit.
- Recommended transition:
  1. Write both `ring_id` and `haven_id`.
  2. Read by `haven_id`.
  3. Keep `ring_id` for event attribution and operational tooling.

## Privacy Checklist

- [ ] Plaintext never written to server logs.
- [ ] Invite code never stored in plaintext.
- [ ] All membership checks performed server-side.
- [ ] All sensitive RPCs are `security definer` with fixed `search_path`.
- [ ] Ring token rotation/revocation remains available for incident response.
