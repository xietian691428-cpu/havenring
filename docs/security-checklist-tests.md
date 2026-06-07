# Security & QA scenarios (NFC / sync / privacy)

Run these before release; automate where possible.

## Multi-ring

1. **Bind 1 ring** for the first account via `POST /api/nfc/bind` (valid session + `X-Haven-Secondary-Verified: 1`).
2. Bind the partner ring only through a valid partner invite and the partner's own account.
3. **Partial unique index**: same UID cannot be active twice; after retire, the same UID cannot be rebound to another account/Haven.
4. Verify `RingsPage` card fields from cloud/local merge:
   - nickname
   - cloud `bound_at`
   - cloud `last_used_at`
   - linked memory count per ring id

## Lost ring / revoke

1. Revoke ring A via `POST /api/nfc/revoke` + secondary header.
2. Confirm `nfc-login` with that UID returns **401**.
3. Confirm sealed memories (moments) remain (revoke does not wipe vault).

## Offline seal → sync

1. Seal locally while offline (PWA).
2. Compute `computeMemoryBundleHash` / persist `content_sha256` when uploading moment row.
3. On reconnect, compare stored hash with server — mismatch triggers integrity warning path (implement UI alert).
4. Confirm backoff/retry metadata updates in timeline:
   - last attempt
   - last success
   - failure streak
   - next auto retry timestamp

## iOS vs Android

1. **Android Chrome**: Web NFC available — bind flow uses UID hash client-side before POST.
2. **iOS Safari**: Web NFC unavailable — expect wizard branch `blocked_ios`; bind via Android/desktop or native helper.

## iOS + Android mixed-device regression (single user, must-pass)

1. Bind ring A on Android, then sign in on iOS with the same user account and confirm ring list + timeline load.
2. Create 2 drafts on iOS, get ticket with ring tap, and finalize on iOS from Home Screen launch.
3. Repeat finalize on Android for a different draft and verify both memories appear after sync.
4. Retire ring A on iOS, then confirm Android seal is rejected for that ring.
5. Confirm the retired ring UID cannot be rebound to another account/Haven.
6. Verify `seal_telemetry_events` captures success/error ratio and key `error_code` values.

## Dual-account shared Haven regression (must-pass)

1. Partner A signs in with Apple/Google and binds ring A → first bind creates one-person Haven.
2. A creates partner invite from Rings page / `POST /api/haven/invite`.
3. Partner B opens invite, signs in with B's own Apple/Google account, taps ring B, and binds with `invite_code`.
4. Confirm A and B list the same Haven rings, with one ring owned by each account.
5. Confirm B cannot join with A's OAuth account and cannot bind ring B without invite.
6. Confirm a third account cannot list rings, issue seal tickets, or read moments for the Haven.
7. Confirm a third active ring in the same Haven returns **409** `HAVEN_PAIR_FULL`.

## Cross-device sync / recovery

1. Device A binds one ring and creates offline drafts.
2. Device B signs in to the same user account and opens timeline/rings pages.
3. Verify cloud placeholder groups appear by ring and can be expanded/collapsed.
4. Trigger "Sync active ring" then "Sync all rings" and confirm issue panel clears.

## Lost ring single revoke

1. Use Rings page retire on one ring with secondary verification.
2. Confirm warning text is shown before verification:
   "This ring credential will stop working for sealing right away and cannot be transferred to another Haven."
3. Confirm `/api/nfc/revoke` success updates both cloud list and local registry.
4. Verify retired ring UID cannot be rebound and cannot complete seal.

## Hash mismatch recovery

1. Force mismatch by changing local queued `content_sha256` for one draft.
2. Run sync and verify mismatch warning + issue reason appears.
3. Use manual resync action; verify fallback to cloud source path and no data deletion.

## NFC login

1. `POST /api/auth/nfc-login` returns **410** `nfc_login_disabled_for_shared_haven`.
2. Verify a ring tap never signs Partner B into Partner A's account.

## Privacy gates

1. `bind` without `privacy_acknowledged: true` → **400**.
2. `bind` without `X-Haven-Secondary-Verified` → **403**.
3. Policy links open `/privacy-policy` or external URL from env.
