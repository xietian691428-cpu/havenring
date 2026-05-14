"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { canonicalAuthOriginFromLocation } from "@/lib/auth-redirect";
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

type AuthState = "checking" | "signed_out" | "ready";
type BindState = "idle" | "binding" | "success" | "error";

type BindResponse = {
  ring?: {
    id?: string;
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

type UidLinkState = "idle" | "checking" | "unlinked" | "yours" | "other" | "linked_unknown" | "error";

interface BindRingClientProps {
  initialUid: string;
}

function isPermanentSession(session: Session | null): session is Session {
  if (!session) return false;
  return (
    session.user.is_anonymous !== true &&
    session.user.app_metadata?.provider !== "anonymous"
  );
}

function redirectUrlFor(uid: string) {
  const params = new URLSearchParams();
  params.set("uid", uid);
  const origin = canonicalAuthOriginFromLocation();
  return `${origin}/bind-ring?${params.toString()}`;
}

export function BindRingClient({ initialUid }: BindRingClientProps) {
  const uid = useMemo(() => normalizeNfcUidInput(initialUid), [initialUid]);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [busyProvider, setBusyProvider] = useState<"apple" | "google" | "">("");
  const [nickname, setNickname] = useState("Ring");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [bindState, setBindState] = useState<BindState>("idle");
  const [message, setMessage] = useState("");
  const [uidLink, setUidLink] = useState<UidLinkState>("idle");

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthState(data.session ? "ready" : "signed_out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthState(nextSession ? "ready" : "signed_out");
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
        if (isPermanentSession(s)) {
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
        };
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
        options: { redirectTo: redirectUrlFor(uid) },
      });
      if (error) {
        setMessage("Sign-in could not start. Please try again.");
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
    if (!isPermanentSession(activeSession)) {
      setAuthState("signed_out");
      setMessage("Sign in with a permanent account before linking this ring.");
      return;
    }

    const security = getSecuritySummary();
    if (!security.initialized) {
      setBindState("error");
      setMessage(
        "Device protection is required before linking a ring. Open Haven first and finish device protection setup."
      );
      return;
    }

    setBindState("binding");
    setMessage("");
    try {
      await verifyAndTrustCurrentDevice({ password, recoveryCode });

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
          privacy_acknowledged: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as BindResponse;
      if (!response.ok) {
        setBindState("error");
        setMessage(
          payload.error ||
            (response.status === 409
              ? "This ring cannot be linked right now. See the note above or try again."
              : "Ring binding failed. Please try again.")
        );
        return;
      }

      if (payload.subscription) {
        cacheSubscriptionStatus(payload.subscription);
      }
      await saveLocalRing(payload);
      setBindState("success");
      setMessage(
        payload.plusTrialActivated
          ? "Ring linked. 30-Day Haven Plus activated! Opening Haven..."
          : "Ring linked. Opening Haven..."
      );
      window.setTimeout(() => {
        window.location.href = "/hub";
      }, 900);
    } catch {
      setBindState("error");
      setMessage("Verification or binding failed. Check your password or recovery code and try again.");
    }
  }

  if (!uid) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.kicker}>Ring setup</p>
          <h1 style={styles.title}>Missing ring ID</h1>
          <p style={styles.body}>Tap your Haven Ring again to restart setup.</p>
          <button type="button" onClick={() => window.history.back()} style={styles.secondaryButton}>
            Go back
          </button>
        </section>
      </main>
    );
  }

  const signedOut = authState === "signed_out" || !isPermanentSession(session);
  const blockNewBind = uidLink === "yours" || uidLink === "other" || uidLink === "checking";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.kicker}>New ring binding</p>
        <h1 style={styles.title}>Link this Haven Ring</h1>
        <p style={styles.body}>
          This ring was verified by Haven. Sign in, confirm it is you, then link it
          to your account for quick access and sealing.
        </p>
        <div style={styles.uidBox}>
          <span style={styles.uidLabel}>Ring ID</span>
          <span style={styles.uidValue}>{uid}</span>
        </div>

        {uidLink === "checking" ? (
          <p style={styles.muted}>Checking whether this ring is already linked to a Haven account…</p>
        ) : null}
        {uidLink !== "idle" && uidLink !== "checking" ? (
          <div
            style={{
              ...styles.ringStatusBox,
              ...(uidLink === "unlinked" ? styles.ringStatusUnlinked : {}),
              ...(uidLink === "yours" ? styles.ringStatusYours : {}),
              ...(uidLink === "other" ? styles.ringStatusOther : {}),
              ...(uidLink === "linked_unknown" ? styles.ringStatusUnknown : {}),
              ...(uidLink === "error" ? styles.ringStatusError : {}),
            }}
            role="status"
          >
            {uidLink === "unlinked"
              ? "Not linked: this ring is not on any Haven account yet. You can link it below (one active account per ring)."
              : uidLink === "yours"
                ? "Already linked to you: this ring is on your account. To re-link elsewhere, open My Rings in the app and unlink it first."
                : uidLink === "other"
                  ? "Linked to someone else: this ring is on another Haven account. That owner must unlink it in My Rings before you can link it here."
                  : uidLink === "linked_unknown"
                    ? "May already be linked: sign in to see if this ring is yours. If it is, use My Rings — do not link again until you have unlinked."
                    : "Could not verify link status. If this is a brand-new ring, you can still try linking after sign-in."}
          </div>
        ) : null}

        {authState === "checking" ? (
          <p style={styles.muted}>Checking sign-in...</p>
        ) : signedOut ? (
          <div style={styles.stack}>
            <p style={styles.notice}>
              A permanent account is required before this ring can be linked.
            </p>
            <button
              type="button"
              onClick={() => void signInWith("apple")}
              disabled={Boolean(busyProvider)}
              style={styles.primaryButton}
            >
              {busyProvider === "apple" ? "Opening Apple Sign In..." : "Continue with Apple"}
            </button>
            <button
              type="button"
              onClick={() => void signInWith("google")}
              disabled={Boolean(busyProvider)}
              style={styles.secondaryButton}
            >
              {busyProvider === "google" ? "Opening Google Sign In..." : "Continue with Google"}
            </button>
          </div>
        ) : (
          <div style={styles.stack}>
            <label style={styles.label}>
              Ring name
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                style={styles.input}
                placeholder="Daily ring"
              />
            </label>
            <label style={styles.label}>
              Device password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={styles.input}
                autoComplete="current-password"
              />
            </label>
            <label style={styles.label}>
              Recovery code
              <input
                type="text"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                style={styles.input}
                placeholder="Optional if password is entered"
              />
            </label>
            <p style={styles.muted}>
              Haven asks for this confirmation because a ring tap alone should not
              add hardware to your account.
            </p>
            <button
              type="button"
              onClick={() => void handleBind()}
              disabled={bindState === "binding" || blockNewBind}
              style={styles.primaryButton}
            >
              {bindState === "binding" ? "Linking ring..." : "Confirm and link ring"}
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
