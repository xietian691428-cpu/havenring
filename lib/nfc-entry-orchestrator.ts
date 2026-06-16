/**
 * NFC / Pair entry orchestration for /start, /bind-ring, Seal prep, and /app.
 * Runs pair-state reconciliation and returns a small action plan for the surface.
 */
import { hasSdmSearch, readNfcIntent } from "@/lib/nfc-intent";
import {
  buildBindRingUrl,
  hasPendingPartnerInvite,
  readPendingPartnerInviteCode,
} from "@/lib/partner-invite-pending";
import {
  resolvePairState,
  type PairStateSnapshot,
} from "@/lib/pair-state-resolver";
import {
  listenForRingTapWithRetry,
  NFC_AUTO_RETRY_COUNT,
  postSdmResolveWithRetry,
} from "@/lib/nfc-sdm-resolve-client";
import { readPendingPartnerInviteKeyToken } from "@/lib/partner-invite-pending";
import { withNfcIntent } from "@/lib/nfc-intent";

export type NfcEntrySurface = "start" | "bind-ring" | "seal" | "app";

export type NfcEntryContext = {
  surface: NfcEntrySurface;
  search?: string;
  uid?: string;
  inviteCode?: string;
  accessToken?: string;
};

export type NfcEntryPlan = {
  pairState: PairStateSnapshot;
  pendingInvite: boolean;
  inviteCode: string;
  shouldEnablePairSharing: boolean;
  /** When set, /start should navigate here instead of asking the user to choose bind vs join. */
  bindRingHref: string | null;
  hasOwnedCloudRing: boolean;
  nfcIntent: ReturnType<typeof readNfcIntent>;
};

function readSearch(ctx: NfcEntryContext): string {
  if (ctx.search) return ctx.search.startsWith("?") ? ctx.search : `?${ctx.search}`;
  if (typeof window === "undefined") return "";
  return window.location.search || "";
}

function readInviteFromContext(ctx: NfcEntryContext, search: string): string {
  const fromCtx = String(ctx.inviteCode || "").trim();
  if (fromCtx) return fromCtx;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fromUrl = String(params.get("invite") || "").trim();
  if (fromUrl) return fromUrl;
  return readPendingPartnerInviteCode();
}

function readUidFromContext(ctx: NfcEntryContext, search: string): string {
  const fromCtx = String(ctx.uid || "").trim();
  if (fromCtx) return fromCtx;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return String(params.get("uid") || "").trim();
}

function buildBindHref(origin: string, uid: string): string | null {
  if (!uid) return null;
  return buildBindRingUrl(origin, uid);
}

/** /start landing for partner join when the receiver has no ring yet. */
export function buildStartBindInviteHref(
  origin: string,
  inviteCode: string,
  keyToken?: string
): string {
  const params = new URLSearchParams();
  params.set("intent", "bind");
  if (inviteCode) params.set("invite", inviteCode);
  const kt = String(keyToken || readPendingPartnerInviteKeyToken() || "").trim();
  if (kt) params.set("kt", kt);
  const path = `/start?${params.toString()}`;
  return withNfcIntent(`${origin}${path}`, "bind");
}

export async function fetchInviteKeyPackage(
  inviteCode: string,
  keyToken: string
): Promise<string | null> {
  const invite = String(inviteCode || "").trim();
  const kt = String(keyToken || "").trim();
  if (!invite || !kt) return null;

  let lastError: unknown;
  for (let attempt = 0; attempt <= NFC_AUTO_RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(
        `/api/haven/invite/key?invite=${encodeURIComponent(invite)}&kt=${encodeURIComponent(kt)}`
      );
      const payload = (await res.json().catch(() => ({}))) as {
        keyPackage?: string;
      };
      if (res.ok && payload.keyPackage) {
        return payload.keyPackage;
      }
      if (res.status >= 500 && attempt < NFC_AUTO_RETRY_COUNT) {
        await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return null;
    } catch (error) {
      lastError = error;
      if (attempt < NFC_AUTO_RETRY_COUNT) {
        await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  void lastError;
  return null;
}

export async function ensureInviteKeyPackageAuto(args: {
  inviteCode: string;
  keyToken?: string;
  cachedPackage?: string;
}): Promise<string | null> {
  const cached = String(args.cachedPackage || "").trim();
  if (cached) return cached;
  const kt =
    String(args.keyToken || "").trim() || readPendingPartnerInviteKeyToken();
  if (!args.inviteCode || !kt) return null;
  return fetchInviteKeyPackage(args.inviteCode, kt);
}

export async function repairPairStateAfterFailure(accessToken?: string) {
  return resolvePairState({ accessToken, force: true });
}

export { listenForRingTapWithRetry, postSdmResolveWithRetry, NFC_AUTO_RETRY_COUNT };

/**
 * Reconcile Pair / ring state and derive the recommended entry path.
 * Safe to call on every NFC landing and on app resume.
 */
export async function runNfcEntryOrchestrator(
  ctx: NfcEntryContext
): Promise<NfcEntryPlan> {
  const search = readSearch(ctx);
  const inviteCode = readInviteFromContext(ctx, search);
  const uid = readUidFromContext(ctx, search);
  const pendingInvite = Boolean(inviteCode) || hasPendingPartnerInvite();
  const nfcIntent = readNfcIntent(search);

  const pairState = await resolvePairState({
    accessToken: ctx.accessToken,
    force: ctx.surface === "bind-ring" || ctx.surface === "start",
  });

  const hasOwnedCloudRing =
    pairState.ownedCloudRingCount > 0 ||
    pairState.cloudRings.some((row) => row.ownedByYou);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://havenring.me";

  let bindRingHref: string | null = null;
  if (ctx.surface === "start" && pendingInvite && uid) {
    bindRingHref = buildBindHref(origin, uid);
  } else if (
    ctx.surface === "start" &&
    pendingInvite &&
    hasOwnedCloudRing &&
    hasSdmSearch(search)
  ) {
    const resolvedUid = uid || readUidFromContext(ctx, search);
    if (resolvedUid) {
      bindRingHref = buildBindHref(origin, resolvedUid);
    }
  } else if (ctx.surface === "bind-ring" && pendingInvite && uid && hasOwnedCloudRing) {
    bindRingHref = buildBindHref(origin, uid);
  }

  const shouldEnablePairSharing =
    pairState.pairActive || pairState.recommendedAction === "enable_pair_sharing";

  return {
    pairState,
    pendingInvite,
    inviteCode,
    shouldEnablePairSharing,
    bindRingHref,
    hasOwnedCloudRing,
    nfcIntent,
  };
}
