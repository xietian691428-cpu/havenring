<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product: Haven pair ring limit (do not regress to 5)

Haven is positioned as **personal records + a private couple pair**, not multi-ring family sharing or shared-login access.

- **Couple model:** each partner signs in with their **own Apple/Google account** and joins the same Haven by explicit invite. Never implement partner access by asking one person to use the other person's OAuth account.
- **Max active NFC rings per Haven pair: 2** (free and Plus use the same cap). In the couple flow this is one active ring per partner account.
- **Single source of truth for limits:** `FREE_RING_LIMIT` and `PLUS_RING_LIMIT` in `lib/subscription.ts` and `src/features/subscription/subscriptionTypes.ts`.
- **Shop checkout cap:** `MAX_RING_QUANTITY` in `lib/shop/catalog.ts`.
- **PWA local registry cap:** `MAX_BOUND_RINGS` in `src/services/ringRegistryService.js` (must match server `ringLimit`).
- **Server enforcement:** `POST /api/nfc/bind` creates or joins a Haven; first ring creates a one-person Haven, second ring requires a short-lived partner invite and a separate authenticated account.
- **Non-transferable ring rule:** a physical ring that has been activated cannot be released for another account/Haven in normal product flows. Retire credentials for loss/security incidents; do not relabel that as unlink/rebind.
- **Do not** reintroduce copy or gates for “up to 5 rings”, family sharing, or Plus tier ring-count upsell. Plus is for Seal with Ring, cloud backup, and storage — not extra ring slots.
- **Do not** reintroduce shared-account copy. Use “one shared Haven, two separate accounts, one ring each.”
- **Contract check:** `npx tsx scripts/verify-flow-contracts.ts` asserts all ring-limit constants stay at 2.

See also `docs/architecture-decisions.md` §3.2.
