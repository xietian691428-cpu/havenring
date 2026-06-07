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
  upsertBoundRingByUidKey,
} from "@/src/services/ringRegistryService";
import {
  getSecuritySummary,
  verifyAndTrustCurrentDevice,
} from "@/src/services/deviceTrustService";
import { cacheSubscriptionStatus } from "@/src/services/subscriptionService";
import {
  clearPendingPartnerInvite,
  importHavenKeyFromInvitePackage,
  readInviteKeyPackageFromLocation,
  readPendingInviteKeyPackage,
  savePendingPartnerInvite,
  uploadWrappedHavenKey,
} from "@/src/services/havenKeyService";
import { NfcHoldGuide } from "@/src/components/NfcHoldGuide";
import { getNfcHoldGuideCopy, type HavenPlatform } from "@/src/content/havenCopy";
import { usePlatform } from "@/src/hooks/usePlatform";

type AuthState = "checking" | "signed_out" | "ready";
type BindState = "idle" | "binding" | "success" | "error";

type BindResponse = {
  success?: boolean;
  alreadyLinkedToYou?: boolean;
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

interface BindRingClientProps {
  initialUid: string;
  initialInviteCode?: string;
}

function redirectUrlFor(uid: string, inviteCode = "") {
  const params = new URLSearchParams();
  params.set("uid", uid);
  if (inviteCode) params.set("invite", inviteCode);
  const origin = canonicalAuthOriginFromLocation();
  return `${origin}/bind-ring?${params.toString()}`;
}

export function BindRingClient({ initialUid, initialInviteCode = "" }: BindRingClientProps) {
  const uid = useMemo(() => normalizeNfcUidInput(initialUid), [initialUid]);
  const inviteCode = useMemo(() => String(initialInviteCode || "").trim(), [initialInviteCode]);
  const { platform: detectedPlatform, ready: platformReady } = usePlatform();
  const platform = (platformReady ? detectedPlatform : "other") as HavenPlatform;
  const holdCopy = useMemo(() => getNfcHoldGuideCopy(platform), [platform]);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [busyProvider, setBusyProvider] = useState<"apple" | "google" | "">("");
  const [nickname, setNickname] = useState("Ring");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [bindState, setBindState] = useState<BindState>("idle");
  const [message, setMessage] = useState("");
  const [uidLink, setUidLink] = useState<UidLinkState>("idle");
  const [inviteKeyPackage, setInviteKeyPackage] = useState("");

  useEffect(() => {
    if (!inviteCode || typeof window === "undefined") return;
    const fromHash = readInviteKeyPackageFromLocation();
    const fromStorage = readPendingInviteKeyPackage();
    const encodedPackage = fromHash || fromStorage;
    savePendingPartnerInvite(inviteCode, encodedPackage);
    setInviteKeyPackage(encodedPackage);
    if (fromHash) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
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
    if (!uid) return;
    setBusyProvider(provider);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrlFor(uid, inviteCode) },
      });
      if (error) {
        setMessage("登录失败");
      }
    } finally {
      setBusyProvider("");
    }
  }

  async function saveLocalRing(payload: BindResponse) {
    const label = nickname.trim() || "Ring";
    try {
      await addBoundRing({
        serialNumber: uid,
        fallbackText: uid,
        label,
        colorKey: "gold",
        icon: "ring",
        cloudRingId: payload.ring?.id || undefined,
        havenId: payload.havenId || payload.ring?.haven_id || undefined,
        cloudBoundAt: payload.ring?.bound_at || undefined,
        cloudLastUsedAt: payload.ring?.last_used_at || undefined,
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
        cloudRingId: payload.ring?.id || undefined,
        havenId: payload.havenId || payload.ring?.haven_id || undefined,
        cloudBoundAt: payload.ring?.bound_at || undefined,
        cloudLastUsedAt: payload.ring?.last_used_at || undefined,
      });
    }
  }

  async function handleBind() {
    if (!uid) {
      setBindState("error");
      setMessage("Missing ring ID. Tap the ring again and retry.");
      return;
    }
    const activeSession = session;
    if (!isPermanentSupabaseSession(activeSession)) {
      setAuthState("signed_out");
      setMessage("请先登录");
      return;
    }

    const security = getSecuritySummary();
    if (!security.initialized) {
      setBindState("error");
      setMessage("请先完成设备验证");
      return;
    }

    setBindState("binding");
    setMessage("");
    try {
      await verifyAndTrustCurrentDevice({ password, recoveryCode });
      const pendingKeyPackage = inviteCode
        ? inviteKeyPackage || readPendingInviteKeyPackage()
        : "";
      if (inviteCode && !pendingKeyPackage) {
        setBindState("error");
        setMessage("Invite key missing. Ask your partner to create a fresh invite.");
        return;
      }

      const response = await fetch("/api/nfc/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.access_token}`,
          "X-Haven-Secondary-Verified": "1",
        },
        body: JSON.stringify({
          nfc_uid: uid,
          nickname: nickname.trim() || "Ring",
          invite_code: inviteCode || undefined,
          privacy_acknowledged: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BindResponse;
      if (!response.ok) {
        setBindState("error");
        setMessage(
          payload.error || (response.status === 409 ? "戒指已绑定" : "绑定失败，请重试")
        );
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
        await uploadWrappedHavenKey({
          accessToken: activeSession.access_token,
          havenId,
        });
      }
      if (inviteCode) {
        clearPendingPartnerInvite();
      }
      setBindState("success");
      const trial = payload.plusTrialActivated ? "1" : "0";
      const role = payload.role === "member" ? "member" : "owner";
      window.setTimeout(() => {
        window.location.href = `/bind-success?trial=${trial}&role=${role}`;
      }, 400);
    } catch {
      setBindState("error");
      setMessage("绑定失败，请重试");
    }
  }

  if (!uid) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.kicker}>Join Haven</p>
          <h1 style={styles.title}>{inviteCode ? "Now tap your ring" : holdCopy.waitTitle}</h1>
          <p style={styles.body}>
            {inviteCode
              ? "Invite saved. Sign in, then tap your ring."
              : holdCopy.waitSubtitle}
          </p>
          {!inviteCode ? <NfcHoldGuide platform={platform} /> : null}
          <button type="button" onClick={() => window.history.back()} style={styles.secondaryButton}>
            Back
          </button>
        </section>
      </main>
    );
  }

  const signedOut = authState === "signed_out" || !isPermanentSupabaseSession(session);
  const blockNewBind =
    uidLink === "yours" ||
    uidLink === "other" ||
    uidLink === "retired" ||
    uidLink === "checking";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.kicker}>绑定</p>
        <h1 style={styles.title}>{inviteCode ? "Join Haven" : "Bind Ring"}</h1>
        <p style={styles.body}>
          {inviteCode
            ? "Use your own account and ring."
            : "Bind your ring. Invite your partner later."}
        </p>
        {inviteCode ? (
          <div style={styles.uidBox}>
            <span style={styles.uidLabel}>Partner invite</span>
            <span style={styles.uidValue}>{inviteCode}</span>
          </div>
        ) : null}
        <div style={styles.uidBox}>
          <span style={styles.uidLabel}>UID</span>
          <span style={styles.uidValue}>{uid}</span>
        </div>

        {uidLink === "checking" ? (
          <p style={styles.muted}>检查中</p>
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
              ? "可绑定"
              : uidLink === "yours"
                ? "This ring is already linked to your account."
                : uidLink === "other"
                  ? "This ring is already linked to another Haven and cannot be transferred."
                  : uidLink === "retired"
                    ? "This ring was already activated and cannot be transferred to another Haven."
                    : uidLink === "linked_unknown"
                      ? "请登录"
                      : "检查失败"}
          </div>
        ) : null}

        {authState === "checking" ? (
          <p style={styles.muted}>检查中</p>
        ) : signedOut ? (
          <div style={styles.stack}>
            <p style={styles.notice}>
              Use your own account.
            </p>
            <button
              type="button"
              onClick={() => void signInWith("apple")}
              disabled={Boolean(busyProvider)}
              style={styles.primaryButton}
            >
              {busyProvider === "apple" ? "打开中" : "Apple 登录"}
            </button>
            <button
              type="button"
              onClick={() => void signInWith("google")}
              disabled={Boolean(busyProvider)}
              style={styles.secondaryButton}
            >
              {busyProvider === "google" ? "打开中" : "Google 登录"}
            </button>
          </div>
        ) : (
          <div style={styles.stack}>
            <label style={styles.label}>
              名称
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                style={styles.input}
                placeholder="Ring"
              />
            </label>
            <label style={styles.label}>
              设备密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={styles.input}
                autoComplete="current-password"
              />
            </label>
            <label style={styles.label}>
              恢复码
              <input
                type="text"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                style={styles.input}
                placeholder="可选"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleBind()}
              disabled={bindState === "binding" || blockNewBind}
              style={styles.primaryButton}
            >
              {bindState === "binding"
                ? "Binding..."
                : inviteCode
                  ? "Join Haven and bind my ring"
                  : "Create Haven with this ring"}
            </button>
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
    padding: 24,
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
};
