"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { canonicalAuthOriginFromLocation } from "@/lib/auth-redirect";
import { isPermanentSupabaseSession } from "@/lib/appAuthGate";
import { normalizeNfcUidInput } from "@/lib/nfc-uid-browser";
import {
  addBoundRing,
  computeRingUidKey,
  getBoundRings,
  updateRingCloudMetadata,
  upsertBoundRingByUidKey,
} from "@/src/services/ringRegistryService";
import {
  fetchSecondaryVerificationToken,
  getSecuritySummary,
  initializeSecurity,
  verifyAndTrustCurrentDevice,
} from "@/src/services/deviceTrustService";
import { cacheSubscriptionStatus } from "@/src/services/subscriptionService";
import {
  clearPendingPartnerInvite,
  importHavenKeyFromInvitePackage,
  readInviteKeyPackageFromLocation,
  readPendingInviteKeyPackage,
  readPendingInviteKeyToken,
  savePendingPartnerInvite,
  uploadWrappedHavenKey,
} from "@/src/services/havenKeyService";
import { readPendingPartnerInviteCode } from "@/lib/partner-invite-pending";
import { NfcHoldGuide } from "@/src/components/NfcHoldGuide";
import { IndeterminateStepStatus } from "@/src/components/IndeterminateStepStatus";
import { ACTION_STEP_TIMING } from "@/lib/nfc-flow-timing";
import { APP_ENTRY_PATH } from "@/lib/site";
import { BIND_RING_PAGE_EN, formatJoinPrompt } from "@/src/content/bindRingPageContent";
import { getNfcHoldGuideCopy, type HavenPlatform } from "@/src/content/havenCopy";
import { usePlatform } from "@/src/hooks/usePlatform";

type AuthState = "checking" | "signed_out" | "ready";
type BindState = "idle" | "binding" | "success" | "error";

type BindResponse = {
  success?: boolean;
  alreadyLinkedToYou?: boolean;
  joinedExistingRing?: boolean;
  message?: string;
  havenId?: string | null;
  role?: "owner" | "member";
  ring?: {
    id?: string;
    haven_id?: string | null;
    bound_at?: string | null;
    last_used_at?: string | null;
  };
  subscription?: {
    tier?: string;
    source?: string;
    plusTrialEnd?: string | null;
    plusTrialDaysLeft?: number;
    ringLimit?: number;
    storageGb?: number;
    canSealWithRing?: boolean;
  };
  plusTrialActivated?: boolean;
  error?: string;
  code?: string;
};

type UidLinkState =
  | "idle"
  | "checking"
  | "unlinked"
  | "yours"
  | "other"
  | "retired"
  | "linked_unknown"
  | "error";

type InvitePreview = {
  inviterName: string;
  valid: boolean;
  expired: boolean;
  alreadyComplete: boolean;
};

interface BindRingClientProps {
  initialUid: string;
  initialInviteCode?: string;
}

function readInviteKeyTokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  return (
    (new URLSearchParams(window.location.search).get("kt") || "").trim() ||
    readPendingInviteKeyToken()
  );
}

function oauthReturnUrlForBind(uid: string, inviteCode: string) {
  const origin = canonicalAuthOriginFromLocation();
  const keyToken = readInviteKeyTokenFromLocation();
  if (uid) {
    const params = new URLSearchParams({ uid });
    if (inviteCode) params.set("invite", inviteCode);
    if (keyToken) params.set("kt", keyToken);
    return `${origin}/bind-ring?${params.toString()}`;
  }
  if (!inviteCode) return `${origin}/bind-ring`;
  const params = new URLSearchParams({ invite: inviteCode });
  if (keyToken) params.set("kt", keyToken);
  return `${origin}/bind-ring?${params.toString()}`;
}

export function BindRingClient({ initialUid, initialInviteCode = "" }: BindRingClientProps) {
  const uid = useMemo(() => normalizeNfcUidInput(initialUid), [initialUid]);
  const inviteCode = useMemo(() => String(initialInviteCode || "").trim(), [initialInviteCode]);
  const { platform: detectedPlatform, ready: platformReady } = usePlatform();
  const platform = (platformReady ? detectedPlatform : "other") as HavenPlatform;
  const holdCopy = useMemo(() => getNfcHoldGuideCopy(platform), [platform]);
  const copy = BIND_RING_PAGE_EN;
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [busyProvider, setBusyProvider] = useState<"apple" | "google" | "">("");
  const [nickname, setNickname] = useState("Ring");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [securityReady, setSecurityReady] = useState(() =>
    typeof window !== "undefined" ? getSecuritySummary().initialized : false
  );
  const [shownRecoveryCode, setShownRecoveryCode] = useState("");
  const [bindState, setBindState] = useState<BindState>("idle");
  const [message, setMessage] = useState("");
  const [uidLink, setUidLink] = useState<UidLinkState>("idle");
  const [inviteKeyPackage, setInviteKeyPackage] = useState("");
  const [hasExistingRing, setHasExistingRing] = useState(false);
  const [existingRingCheckDone, setExistingRingCheckDone] = useState(false);
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [invitePreviewDone, setInvitePreviewDone] = useState(false);

  useEffect(() => {
    if (!inviteCode || typeof window === "undefined") return;
    let active = true;

    const storedInvite = readPendingPartnerInviteCode();
    if (storedInvite && storedInvite !== inviteCode) {
      clearPendingPartnerInvite();
      setInviteKeyPackage("");
    }

    void (async () => {
      const ktFromUrl = (new URLSearchParams(window.location.search).get("kt") || "").trim();
      if (ktFromUrl) {
        savePendingPartnerInvite(inviteCode, readPendingInviteKeyPackage(), ktFromUrl);
      }

      const fromHash = readInviteKeyPackageFromLocation();
      const fromStorage = readPendingInviteKeyPackage();
      const cachedPackage = fromHash || fromStorage;
      const keyToken = readInviteKeyTokenFromLocation();
      if (cachedPackage) {
        savePendingPartnerInvite(inviteCode, cachedPackage, keyToken);
        setInviteKeyPackage(cachedPackage);
        if (fromHash) {
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${window.location.search}`
          );
        }
        return;
      }

      const keyTokenFromUrl = readInviteKeyTokenFromLocation();
      if (!keyTokenFromUrl) return;

      try {
        const res = await fetch(
          `/api/haven/invite/key?invite=${encodeURIComponent(inviteCode)}&kt=${encodeURIComponent(keyTokenFromUrl)}`
        );
        const payload = (await res.json().catch(() => ({}))) as {
          keyPackage?: string;
          error?: string;
        };
        if (!active) return;
        if (!res.ok || !payload.keyPackage) {
          setMessage(
            payload.error || copy.inviteKeyMissing
          );
          return;
        }
        savePendingPartnerInvite(inviteCode, payload.keyPackage, keyTokenFromUrl);
        setInviteKeyPackage(payload.keyPackage);
      } catch {
        if (active) {
          setMessage(copy.inviteKeyMissing);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteCode) {
      queueMicrotask(() => {
        setInvitePreview(null);
        setInvitePreviewDone(true);
      });
      return;
    }
    let active = true;
    queueMicrotask(() => setInvitePreviewDone(false));
    void (async () => {
      try {
        const res = await fetch(
          `/api/haven/invite/preview?invite=${encodeURIComponent(inviteCode)}`
        );
        const payload = (await res.json().catch(() => ({}))) as {
          inviterName?: string;
          valid?: boolean;
          expired?: boolean;
          alreadyComplete?: boolean;
        };
        if (!active) return;
        setInvitePreview({
          inviterName: String(payload.inviterName || "your partner"),
          valid: Boolean(payload.valid),
          expired: Boolean(payload.expired),
          alreadyComplete: Boolean(payload.alreadyComplete),
        });
      } catch {
        if (active) {
          setInvitePreview({
            inviterName: "your partner",
            valid: true,
            expired: false,
            alreadyComplete: false,
          });
        }
      } finally {
        if (active) setInvitePreviewDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [inviteCode]);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const next = data.session ?? null;
      setSession(next);
      setAuthState(isPermanentSupabaseSession(next) ? "ready" : "signed_out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const next = nextSession ?? null;
      setSession(next);
      setAuthState(isPermanentSupabaseSession(next) ? "ready" : "signed_out");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!inviteCode || !isPermanentSupabaseSession(session)) {
      queueMicrotask(() => {
        setHasExistingRing(false);
        setExistingRingCheckDone(Boolean(inviteCode));
      });
      return;
    }
    let active = true;
    queueMicrotask(() => setExistingRingCheckDone(false));
    void (async () => {
      try {
        const res = await fetch("/api/nfc/list", {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        const payload = (await res.json().catch(() => ({}))) as {
          rings?: Array<{ ownedByYou?: boolean }>;
        };
        if (!active) return;
        const owned = (payload.rings ?? []).filter((ring) => ring.ownedByYou);
        setHasExistingRing(owned.length >= 1);
      } catch {
        if (active) setHasExistingRing(false);
      } finally {
        if (active) setExistingRingCheckDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [inviteCode, session]);

  useEffect(() => {
    if (!uid) {
      queueMicrotask(() => setUidLink("idle"));
      return;
    }
    const ac = new AbortController();
    queueMicrotask(() => setUidLink("checking"));
    void (async () => {
      try {
        const headers: Record<string, string> = {};
        const s = session;
        if (isPermanentSupabaseSession(s)) {
          headers.Authorization = `Bearer ${s.access_token}`;
        }
        const res = await fetch(`/api/nfc/uid-status?uid=${encodeURIComponent(uid)}`, {
          signal: ac.signal,
          headers,
        });
        if (!res.ok) {
          setUidLink("error");
          return;
        }
        const j = (await res.json()) as {
          linked?: boolean;
          ownedByYou?: boolean;
          linkedToOtherAccount?: boolean;
          nonTransferable?: boolean;
        };
        if (j.nonTransferable) {
          setUidLink("retired");
          return;
        }
        if (!j.linked) {
          setUidLink("unlinked");
          return;
        }
        if (j.ownedByYou) {
          setUidLink("yours");
          return;
        }
        if (j.linkedToOtherAccount) {
          setUidLink("other");
          return;
        }
        setUidLink("linked_unknown");
      } catch {
        if (!ac.signal.aborted) setUidLink("error");
      }
    })();
    return () => ac.abort();
  }, [uid, session]);

  async function signInWith(provider: "apple" | "google") {
    if (!uid && !inviteCode) return;
    setBusyProvider(provider);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: oauthReturnUrlForBind(uid, inviteCode),
        },
      });
      if (error) {
        setMessage(copy.signInFailed);
      }
    } finally {
      setBusyProvider("");
    }
  }

  async function saveLocalRing(payload: BindResponse) {
    const label = nickname.trim() || "Ring";
    const cloudMeta = {
      cloudRingId: payload.ring?.id || undefined,
      havenId: payload.havenId || payload.ring?.haven_id || undefined,
      cloudBoundAt: payload.ring?.bound_at || undefined,
      cloudLastUsedAt: payload.ring?.last_used_at || undefined,
    };

    if (!uid && cloudMeta.cloudRingId) {
      const match = getBoundRings().find(
        (ring: { cloudRingId?: string; uidKey?: string }) =>
          ring.cloudRingId === cloudMeta.cloudRingId
      );
      if (match?.uidKey) {
        updateRingCloudMetadata(match.uidKey, cloudMeta);
        return;
      }
    }

    try {
      await addBoundRing({
        serialNumber: uid,
        fallbackText: uid,
        label,
        colorKey: "gold",
        icon: "ring",
        ...cloudMeta,
      });
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "";
      if (code !== "duplicate_ring") throw error;
      const uidKey = await computeRingUidKey(uid, "");
      upsertBoundRingByUidKey(uidKey, {
        label,
        colorKey: "gold",
        icon: "ring",
        ...cloudMeta,
      });
    }
  }

  async function ensureDeviceSecurityReady(): Promise<boolean> {
    if (securityReady) return true;
    const pwd = password.trim();
    const confirm = confirmPassword.trim();
    if (pwd.length < 6) {
      setBindState("error");
      setMessage(copy.passwordTooShort);
      return false;
    }
    if (pwd !== confirm) {
      setBindState("error");
      setMessage(copy.passwordMismatch);
      return false;
    }
    try {
      const { recoveryCode: code } = await initializeSecurity(pwd);
      setSecurityReady(true);
      if (code) {
        setShownRecoveryCode(code);
      }
      return true;
    } catch {
      setBindState("error");
      setMessage(copy.securitySetupFailed);
      return false;
    }
  }

  async function handleBind() {
    const joinWithExistingRing = Boolean(inviteCode && (hasExistingRing || uidLink === "yours"));
    if (!uid && !joinWithExistingRing) {
      setBindState("error");
      setMessage("Missing ring ID. Tap the ring again and retry.");
      return;
    }
    const activeSession = session;
    if (!isPermanentSupabaseSession(activeSession)) {
      setAuthState("signed_out");
      setMessage(copy.signInRequired);
      return;
    }

    setBindState("binding");
    setMessage("");
    try {
      if (!securityReady) {
        const ready = await ensureDeviceSecurityReady();
        if (!ready) {
          setBindState("error");
          return;
        }
      }
      await verifyAndTrustCurrentDevice({ password, recoveryCode });
      const secondaryToken = await fetchSecondaryVerificationToken(
        activeSession.access_token
      );
      const pendingKeyPackage = inviteCode
        ? inviteKeyPackage || readPendingInviteKeyPackage()
        : "";
      const joinWithExistingRing = Boolean(
        inviteCode && (hasExistingRing || uidLink === "yours")
      );
      if (inviteCode && !pendingKeyPackage && !joinWithExistingRing) {
        setBindState("error");
        setMessage(copy.inviteKeyMissing);
        return;
      }

      const response = await fetch("/api/nfc/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.access_token}`,
          "X-Haven-Secondary-Token": secondaryToken,
        },
        body: JSON.stringify({
          nfc_uid: uid || undefined,
          nickname: nickname.trim() || "Ring",
          invite_code: inviteCode || undefined,
          privacy_acknowledged: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BindResponse;
      if (!response.ok) {
        setBindState("error");
        setMessage(mapJoinErrorMessage(payload, response.status));
        return;
      }

      if (payload.subscription) {
        cacheSubscriptionStatus(payload.subscription);
      }
      await saveLocalRing(payload);
      const havenId = payload.havenId || payload.ring?.haven_id || "";
      if (havenId && inviteCode && pendingKeyPackage) {
        await importHavenKeyFromInvitePackage(havenId, inviteCode, pendingKeyPackage);
      }
      if (havenId) {
        const { ensureHavenKey } = await import("@/src/services/havenKeyService");
        await ensureHavenKey(havenId);
        await uploadWrappedHavenKey({
          accessToken: activeSession.access_token,
          havenId,
        });
      }
      if (inviteCode) {
        clearPendingPartnerInvite();
      }
      setBindState("success");
      const { setPairSharingEnabled } = await import(
        "@/src/services/pairSharingService"
      );
      setPairSharingEnabled(true);
      const trial = payload.plusTrialActivated ? "1" : "0";
      const role = payload.role === "member" ? "member" : "owner";
      window.setTimeout(() => {
        window.location.href = `/bind-success?trial=${trial}&role=${role}&pair=1`;
      }, ACTION_STEP_TIMING.bindSuccessRedirectMs);
    } catch (error) {
      setBindState("error");
      const msg = error instanceof Error ? error.message : "";
      setMessage(
        msg === "Verification failed." ? copy.passwordVerifyFailed : copy.bindFailed
      );
    }
  }

  const needsPasswordSetup = !securityReady;
  const joinPrompt = formatJoinPrompt(invitePreview?.inviterName || "your partner");
  const primaryBindLabel = needsPasswordSetup
    ? inviteCode
      ? copy.joinCtaSetup
      : copy.linkRingCtaSetup
    : inviteCode
      ? copy.joinCta
      : copy.linkRingCta;

  function goToApp() {
    window.location.href = APP_ENTRY_PATH;
  }

  function mapJoinErrorMessage(payload: BindResponse, status: number): string {
    if (payload.code === "INVITE_REQUIRES_SEPARATE_ACCOUNT") {
      return copy.joinErrorSeparateAccount;
    }
    if (payload.error) return payload.error;
    if (status === 409) return copy.alreadyBound;
    return inviteCode ? copy.joinErrorGeneric : copy.bindFailed;
  }

  function resolveInvitePhase():
    | "loading"
    | "invalid"
    | "sign_in"
    | "need_ring"
    | "confirm"
    | "blocked" {
    if (!invitePreviewDone || authState === "checking") return "loading";
    if (
      isPermanentSupabaseSession(session) &&
      inviteCode &&
      !existingRingCheckDone
    ) {
      return "loading";
    }
    if (uid && uidLink === "checking") return "loading";
    if (invitePreview && !invitePreview.valid) return "invalid";
    if (authState === "signed_out" || !isPermanentSupabaseSession(session)) {
      return "sign_in";
    }
    if (uid && (uidLink === "other" || uidLink === "retired")) return "blocked";
    if (!hasExistingRing && !uid) return "need_ring";
    return "confirm";
  }

  function renderDevicePasswordFields() {
    return (
      <>
        <label style={styles.label}>
          {needsPasswordSetup ? copy.devicePasswordCreateLabel : copy.devicePasswordLabel}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={styles.input}
            autoComplete={needsPasswordSetup ? "new-password" : "current-password"}
            minLength={needsPasswordSetup ? 6 : undefined}
          />
        </label>
        {needsPasswordSetup ? (
          <label style={styles.label}>
            {copy.devicePasswordConfirmLabel}
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={styles.input}
              autoComplete="new-password"
              minLength={6}
            />
          </label>
        ) : (
          <label style={styles.label}>
            {copy.recoveryCodeLabel}
            <input
              type="text"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              style={styles.input}
              placeholder={copy.recoveryOptional}
            />
          </label>
        )}
      </>
    );
  }

  if (inviteCode) {
    const phase = resolveInvitePhase();
    const blockedMessage =
      uidLink === "other"
        ? copy.statusOtherAccount
        : uidLink === "retired"
          ? copy.statusRetired
          : copy.joinErrorGeneric;

    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>{joinPrompt}</h1>
          {phase === "loading" ? (
            <IndeterminateStepStatus
              active
              label={copy.syncing}
              slowLabel={copy.syncing}
              style={styles.muted}
            />
          ) : null}
          {phase === "invalid" ? (
            <div style={styles.stack}>
              <p style={styles.body}>
                {invitePreview?.alreadyComplete ? copy.inviteComplete : copy.inviteExpired}
              </p>
              <button type="button" onClick={goToApp} style={styles.primaryButton}>
                {copy.openHavenCta}
              </button>
            </div>
          ) : null}
          {phase === "sign_in" ? (
            <div style={styles.stack}>
              <button
                type="button"
                onClick={() => void signInWith("apple")}
                disabled={Boolean(busyProvider)}
                style={styles.primaryButton}
              >
                {busyProvider === "apple" ? copy.openingSignIn : copy.signInApple}
              </button>
              <button
                type="button"
                onClick={() => void signInWith("google")}
                disabled={Boolean(busyProvider)}
                style={styles.secondaryButton}
              >
                {busyProvider === "google" ? copy.openingSignIn : copy.signInGoogle}
              </button>
              <button type="button" onClick={goToApp} style={styles.secondaryButton}>
                {copy.cancelCta}
              </button>
            </div>
          ) : null}
          {phase === "need_ring" ? (
            <div style={styles.stack}>
              <p style={styles.body}>{copy.joinTapRingHint}</p>
              <NfcHoldGuide platform={platform} />
              <button type="button" onClick={goToApp} style={styles.secondaryButton}>
                {copy.cancelCta}
              </button>
            </div>
          ) : null}
          {phase === "confirm" ? (
            <div style={styles.stack}>
              {renderDevicePasswordFields()}
              <button
                type="button"
                onClick={() => void handleBind()}
                disabled={bindState === "binding"}
                style={styles.primaryButton}
              >
                {bindState === "binding" ? copy.binding : primaryBindLabel}
              </button>
              <button type="button" onClick={goToApp} style={styles.secondaryButton}>
                {copy.cancelCta}
              </button>
            </div>
          ) : null}
          {phase === "blocked" ? (
            <div style={styles.stack}>
              <p style={styles.body}>{blockedMessage}</p>
              <button type="button" onClick={goToApp} style={styles.primaryButton}>
                {copy.openHavenCta}
              </button>
            </div>
          ) : null}
          {message ? (
            <p style={styles.status} role="alert">
              {message}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  if (!uid) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>{holdCopy.waitTitle}</h1>
          <p style={styles.body}>{holdCopy.waitSubtitle}</p>
          <NfcHoldGuide platform={platform} />
          {authState === "checking" ? (
            <IndeterminateStepStatus
              active
              label={holdCopy.checkingStatusLine}
              slowLabel={holdCopy.stillCheckingLine}
              style={styles.muted}
            />
          ) : null}
          {message ? (
            <p style={styles.status} role="alert">
              {message}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  const signedOut = authState === "signed_out" || !isPermanentSupabaseSession(session);
  const blockNewBind =
    uidLink === "yours" || uidLink === "other" || uidLink === "retired" || uidLink === "checking";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>{copy.title}</h1>
        <p style={styles.body}>{copy.body}</p>

        {!inviteCode ? (
          <div style={styles.uidBox}>
            <span style={styles.uidLabel}>UID</span>
            <span style={styles.uidValue}>{uid}</span>
          </div>
        ) : null}

        {uidLink === "checking" ? (
          <IndeterminateStepStatus
            active
            label={holdCopy.checkingStatusLine}
            slowLabel={holdCopy.stillCheckingLine}
            style={styles.muted}
          />
        ) : null}
        {uidLink !== "idle" && uidLink !== "checking" ? (
          <div
            style={{
              ...styles.ringStatusBox,
              ...(uidLink === "unlinked" ? styles.ringStatusUnlinked : {}),
              ...(uidLink === "yours" ? styles.ringStatusYours : {}),
              ...(uidLink === "other" ? styles.ringStatusOther : {}),
              ...(uidLink === "retired" ? styles.ringStatusOther : {}),
              ...(uidLink === "linked_unknown" ? styles.ringStatusUnknown : {}),
              ...(uidLink === "error" ? styles.ringStatusError : {}),
            }}
            role="status"
          >
            {uidLink === "unlinked"
              ? copy.statusUnlinked
              : uidLink === "yours"
                ? copy.statusYours
                : uidLink === "other"
                  ? copy.statusOtherAccount
                  : uidLink === "retired"
                    ? copy.statusRetired
                    : uidLink === "linked_unknown"
                      ? copy.signInRequired
                      : copy.statusCheckFailed}
          </div>
        ) : null}

        {authState === "checking" ? (
          <IndeterminateStepStatus
            active
            label={holdCopy.checkingStatusLine}
            slowLabel={holdCopy.stillCheckingLine}
            style={styles.muted}
          />
        ) : signedOut ? (
          <div style={styles.stack}>
            <button
              type="button"
              onClick={() => void signInWith("apple")}
              disabled={Boolean(busyProvider)}
              style={styles.primaryButton}
            >
              {busyProvider === "apple" ? copy.openingSignIn : copy.signInApple}
            </button>
            <button
              type="button"
              onClick={() => void signInWith("google")}
              disabled={Boolean(busyProvider)}
              style={styles.secondaryButton}
            >
              {busyProvider === "google" ? copy.openingSignIn : copy.signInGoogle}
            </button>
          </div>
        ) : (
          <div style={styles.stack}>
            <label style={styles.label}>
              {copy.nicknameLabel}
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                style={styles.input}
                placeholder="Ring"
              />
            </label>
            {renderDevicePasswordFields()}
            {shownRecoveryCode ? (
              <div style={styles.recoveryBox} role="status">
                <p style={styles.recoveryTitle}>{copy.recoveryTitle}</p>
                <p style={styles.recoveryCode}>{shownRecoveryCode}</p>
                <p style={styles.recoveryHint}>{copy.recoveryHint}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void handleBind()}
              disabled={bindState === "binding" || blockNewBind}
              style={styles.primaryButton}
            >
              {bindState === "binding" ? copy.binding : primaryBindLabel}
            </button>
            {bindState === "binding" ? (
              <IndeterminateStepStatus
                active
                label={holdCopy.bindingStatusLine}
                slowLabel={holdCopy.stillBindingLine}
                style={styles.muted}
              />
            ) : null}
          </div>
        )}

        {message ? (
          <p
            style={{
              ...styles.status,
              color: bindState === "success" ? "#b7f7c8" : "#ffb4a8",
            }}
            role={bindState === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding:
      "max(24px, env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom)) 24px",
    background: "#120f0e",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    display: "grid",
    gap: 18,
    border: "1px solid #4b3931",
    borderRadius: 24,
    padding: 24,
    background: "linear-gradient(180deg, #1b1512 0%, #120f0e 100%)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
  },
  kicker: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.15,
    fontWeight: 650,
  },
  body: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 16,
    lineHeight: 1.55,
  },
  uidBox: {
    display: "grid",
    gap: 6,
    border: "1px solid rgba(90, 59, 48, 0.7)",
    borderRadius: 14,
    padding: "12px 14px",
    background: "rgba(23, 18, 16, 0.72)",
  },
  uidLabel: {
    color: "#a8988c",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  uidValue: {
    color: "#f8efe7",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    overflowWrap: "anywhere",
  },
  ringStatusBox: {
    margin: 0,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(90, 59, 48, 0.7)",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#f8efe7",
  },
  ringStatusUnlinked: {
    borderColor: "rgba(120, 200, 160, 0.55)",
    background: "rgba(28, 48, 36, 0.55)",
  },
  ringStatusYours: {
    borderColor: "rgba(217, 166, 122, 0.75)",
    background: "rgba(48, 36, 24, 0.75)",
  },
  ringStatusOther: {
    borderColor: "rgba(255, 140, 120, 0.55)",
    background: "rgba(52, 28, 24, 0.72)",
  },
  ringStatusUnknown: {
    borderColor: "rgba(140, 160, 200, 0.45)",
    background: "rgba(28, 32, 44, 0.55)",
  },
  ringStatusError: {
    borderColor: "rgba(120, 110, 100, 0.6)",
    background: "rgba(30, 26, 24, 0.65)",
  },
  stack: {
    display: "grid",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 7,
    color: "#d9c3b3",
    fontSize: 13,
  },
  input: {
    borderRadius: 12,
    border: "1px solid #4b3931",
    background: "#171210",
    color: "#f8efe7",
    padding: "12px 14px",
    fontSize: 16,
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
  secondaryButton: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
  },
  notice: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 14,
    lineHeight: 1.5,
  },
  muted: {
    margin: 0,
    color: "#a8988c",
    fontSize: 13,
    lineHeight: 1.45,
  },
  status: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
  },
  stepCard: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(90, 59, 48, 0.7)",
    background: "rgba(23, 18, 16, 0.72)",
    display: "grid",
    gap: 6,
  },
  stepLabel: {
    margin: 0,
    color: "#a8988c",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  stepText: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 14,
    lineHeight: 1.5,
  },
  noticeBanner: {
    margin: 0,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(120, 200, 160, 0.45)",
    background: "rgba(28, 48, 36, 0.45)",
    color: "#d4e8dc",
    fontSize: 14,
    lineHeight: 1.5,
  },
  recoveryBox: {
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(217, 166, 122, 0.55)",
    background: "rgba(48, 36, 24, 0.72)",
    display: "grid",
    gap: 8,
  },
  recoveryTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 650,
    color: "#f0c29e",
  },
  recoveryCode: {
    margin: 0,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 20,
    letterSpacing: "0.12em",
    color: "#f8efe7",
  },
  recoveryHint: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "#a8988c",
  },
};
