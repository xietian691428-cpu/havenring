# Security & QA scenarios (NFC / sync / privacy)

Run these before release; automate where possible.

## Multi-ring

1. **Bind 2–5 rings** for the same user via `POST /api/nfc/bind` (with valid session + `X-Haven-Secondary-Verified: 1`).
2. **List** returns all rows; **active** count cannot exceed 5.
3. **Partial unique index**: same UID cannot be active twice; after **revoke**, same UID can be bound again (inactive row remains).
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

## Extreme: five rings in use

1. Attempt sixth bind → **409** with limit message.
2. Revoke one → bind succeeds again.

## Cross-device sync / recovery

1. Device A binds 2+ rings and creates offline drafts.
2. Device B signs in to same account and opens timeline/rings pages.
3. Verify cloud placeholder groups appear by ring and can be expanded/collapsed.
4. Trigger "Sync active ring" then "Sync all rings" and confirm issue panel clears.

## Lost ring single revoke

1. Use Rings page revoke on one ring with secondary verification.
2. Confirm warning text is shown before verification:
   "After unbinding, this ring will immediately stop working for login and sealing. All sealed content remains permanently and safely stored in the cloud."
3. Confirm `/api/nfc/revoke` success updates both cloud list and local registry.
4. Verify revoked ring UID can no longer complete `nfc-login` (401).

## Hash mismatch recovery

1. Force mismatch by changing local queued `content_sha256` for one draft.
2. Run sync and verify mismatch warning + issue reason appears.
3. Use manual resync action; verify fallback to cloud source path and no data deletion.

## NFC login JWT

1. With `SUPABASE_JWT_SECRET` unset → **503** `nfc_login_unconfigured`.
2. With secret set → **200** and JWT accepted by Supabase client `setSession` / REST per project configuration (**verify in staging** — JWT claims must match your GoTrue version).

## Privacy gates

1. `bind` without `privacy_acknowledged: true` → **400**.
2. `bind` without `X-Haven-Secondary-Verified` → **403**.
3. Policy links open `/privacy-policy` or external URL from env.
