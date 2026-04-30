"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";
import { START_PAGE_CONTENT } from "@/src/content/startPageContent";
import { getPlatformGuidance } from "@/src/utils/platformGuidance";

const FTUX_STARTED_KEY = "haven.ftux.started.v1";
const PROD_ORIGIN = "https://www.havenring.me";

export default function StartClient() {
  const [busyProvider, setBusyProvider] = useState("");
  const [notice, setNotice] = useState("");
  const [supportsPasskey, setSupportsPasskey] = useState(false);
  const [appleProviderReady, setAppleProviderReady] = useState(true);
  const [claimToken, setClaimToken] = useState("");
  const [claimState, setClaimState] = useState<
    "idle" | "waiting_signin" | "claiming" | "claimed" | "failed" | "skipped"
  >("idle");
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const guidance = useMemo(() => getPlatformGuidance(platform), [platform]);
  const hero = START_PAGE_CONTENT.hero;
  const hasVideoHero = Boolean(hero.video);
  const claimAttemptedRef = useRef(false);

  useEffect(() => {
    setSupportsPasskey(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined"
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = window.location.search
      ? new URLSearchParams(window.location.search).get("claim") || ""
      : "";
    if (!value) return;
    setClaimToken(value);
    setClaimState("waiting_signin");
    setNotice("Connecting your ring...");
  }, []);

  useEffect(() => {
    if (claimState !== "claimed") return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setClaimToken("");
      setNotice("Setup complete! You can now start saving memories.");
      window.history.replaceState({}, "", "/start");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [claimState]);

  async function claimRingWithToken(accessToken: string) {
    if (!claimToken || claimAttemptedRef.current) return;
    claimAttemptedRef.current = true;
    setClaimState("claiming");
    setNotice("Connecting your ring...");
    try {
      const res = await fetch("/api/rings/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token: claimToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        claimAttemptedRef.current = false;
        setClaimState("failed");
        setNotice(
          typeof data?.error === "string" && data.error
            ? "We could not connect this ring yet. You can continue now and link it later."
            : "We could not connect this ring yet. You can continue without ring for now."
        );
        return;
      }
      setClaimState("claimed");
      setNotice("Setup complete! You can now start saving memories.");
    } catch {
      claimAttemptedRef.current = false;
      setClaimState("failed");
      setNotice("We could not connect this ring yet. You can continue without ring for now.");
    }
  }

  useEffect(() => {
    if (!claimToken) return;
    const supabase = getSupabaseBrowserClient();
    let active = true;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session?.access_token) {
        void claimRingWithToken(data.session.access_token);
      } else {
        setClaimState("waiting_signin");
      }
    };
    void run();
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.access_token) {
        void claimRingWithToken(session.access_token);
      }
    });
    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [claimToken]);

  function getFriendlyAuthError(message: string, provider: "apple" | "google") {
    const normalized = String(message || "").toLowerCase();
    if (normalized.includes("provider is not enabled")) {
      if (provider === "apple") {
        return "Apple Sign In is not ready yet. Please continue with Google.";
      }
      return "Google Sign In is not ready yet. Please try Apple Sign In.";
    }
    return "Sign-in could not start. Please try again in a moment.";
  }

  async function signInWith(provider: "apple" | "google") {
    setBusyProvider(provider);
    setNotice("");
    try {
      window.localStorage.setItem(FTUX_STARTED_KEY, "1");
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin || "";
      const safeOrigin =
        origin.includes("localhost") || origin.includes("127.0.0.1")
          ? PROD_ORIGIN
          : origin;
      const redirectTo = claimToken
        ? `${safeOrigin}/start?claim=${encodeURIComponent(claimToken)}`
        : `${safeOrigin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        if (
          provider === "apple" &&
          String(error.message || "")
            .toLowerCase()
            .includes("provider is not enabled")
        ) {
          setAppleProviderReady(false);
          setNotice("Apple Sign In is not ready yet. Redirecting to Google Sign In...");
          window.setTimeout(() => {
            void signInWith("google");
          }, 250);
          return;
        }
        setNotice(getFriendlyAuthError(error.message, provider));
      }
    } finally {
      setBusyProvider("");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div
          style={{
            ...styles.backdrop,
            backgroundImage: `linear-gradient(180deg, rgba(30,23,20,0.65), rgba(19,15,14,0.88)), url('${hero.image}')`,
          }}
        />
        {hasVideoHero ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={hero.poster || hero.image}
            style={styles.videoBackdrop}
          >
            <source src={hero.video} />
          </video>
        ) : null}
        <div style={styles.content}>
          <p style={styles.kicker}>Haven Ring</p>
          <h1 style={styles.title}>{guidance.startTitle}</h1>
          <p style={styles.subtitle}>{guidance.startSubtitle}</p>
          <p style={styles.privacyLead}>
            Your Face ID protects your account. Your ring gives you fast access and a special ritual for your most precious memories.
          </p>
          {claimToken ? (
            <section style={styles.claimCard}>
              <p style={styles.claimTitle}>Ring setup in progress</p>
              <p style={styles.claimBody}>
                {claimState === "claimed"
                  ? "Your ring is securely connected to your account."
                  : "Connecting your ring..."}
              </p>
              {claimState === "failed" ? (
                <button
                  type="button"
                  onClick={() => {
                    setClaimState("skipped");
                    setClaimToken("");
                    setNotice("You can continue now and connect a ring later in My Rings.");
                    if (typeof window !== "undefined") {
                      window.history.replaceState({}, "", "/start");
                    }
                  }}
                  style={styles.secondaryButton}
                >
                  Continue without ring for now
                </button>
              ) : null}
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => void signInWith("apple")}
            disabled={Boolean(busyProvider) || !appleProviderReady}
            style={styles.primaryButton}
          >
            {busyProvider === "apple"
              ? "Opening Apple Sign In..."
              : appleProviderReady
                ? "Continue with Apple"
                : "Apple Sign In coming soon"}
          </button>

          <button
            type="button"
            onClick={() => void signInWith("google")}
            disabled={Boolean(busyProvider)}
            style={styles.secondaryButton}
          >
            {busyProvider === "google"
              ? "Opening Google Sign In..."
              : "Continue with Google"}
          </button>
          {supportsPasskey ? (
            <button
              type="button"
              onClick={() =>
                void signInWith(platform === "ios" ? "apple" : "google")
              }
              disabled={Boolean(busyProvider)}
              style={styles.secondaryButton}
            >
              Continue with device passkey
            </button>
          ) : null}

          <p style={styles.linkLine}>
            Already have an account?{" "}
            <a href="/" style={styles.link}>
              Sign in
            </a>
          </p>
          <p style={styles.complianceLine}>
            By continuing, you agree to our{" "}
            <a href="/privacy-policy" style={styles.link}>
              Privacy Policy
            </a>
            .
          </p>
          <section style={styles.trustCard}>
            <p style={styles.trustTitle}>Privacy-first sign in</p>
            <ul style={styles.trustList}>
              <li>We never see your Apple or Google password.</li>
              <li>Apple users can choose Hide My Email.</li>
              <li>Your memory content stays protected in Haven.</li>
            </ul>
          </section>

          <section
            style={{
              ...styles.tipCard,
              ...(guidance.isIos ? styles.tipCardIosStrong : null),
            }}
          >
            <p style={styles.tipTitle}>
              {guidance.isIos ? "Important for iPhone" : "Best iPhone experience"}
            </p>
            <p style={styles.tipBody}>
              Add Haven to your Home Screen for the smoothest app-like flow.
            </p>
            <ol style={styles.tipList}>
              <li>Tap the Share button in Safari</li>
              <li>Scroll and tap Add to Home Screen</li>
              <li>Tap Add</li>
            </ol>
            {platform === "ios" ? (
              <p style={styles.tipFootnote}>
                This is recommended on iPhone and works like a real app.
              </p>
            ) : (
              <p style={styles.tipFootnote}>
                On Android, you can install directly when prompted.
              </p>
            )}
          </section>

          <p style={styles.notice}>{notice || "\u00A0"}</p>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: 20,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(160deg, rgba(30,22,18,0.96) 0%, rgba(18,14,12,1) 55%, rgba(14,12,11,1) 100%)",
  },
  heroCard: {
    position: "relative",
    width: "100%",
    maxWidth: 760,
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid #4a372f",
    boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(30,23,20,0.65), rgba(19,15,14,0.88)), url('/start/hero-memory-sanctuary.svg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  videoBackdrop: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.42,
    filter: "saturate(0.88) contrast(0.95)",
  },
  content: {
    position: "relative",
    padding: 28,
    display: "grid",
    gap: 14,
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: 12,
    color: "#d9c3b3",
  },
  title: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.25,
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    fontSize: 18,
    color: "#e7d2c3",
  },
  privacyLead: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: "#e8d7cb",
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "14px 18px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  linkLine: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 14,
  },
  complianceLine: {
    margin: 0,
    color: "#cbb09f",
    fontSize: 13,
    lineHeight: 1.5,
  },
  link: {
    color: "#f0c29e",
  },
  tipCard: {
    marginTop: 6,
    border: "1px solid #5a3b30",
    borderRadius: 14,
    background: "rgba(26, 20, 18, 0.8)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  tipCardIosStrong: {
    borderColor: "#d9a67a",
    boxShadow: "0 0 0 1px rgba(217,166,122,0.28) inset",
  },
  trustCard: {
    border: "1px solid #5a3b30",
    borderRadius: 14,
    background: "rgba(26, 20, 18, 0.8)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  trustTitle: {
    margin: 0,
    fontSize: 13,
    color: "#f0c29e",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  trustList: {
    margin: 0,
    paddingLeft: 18,
    color: "#d9c3b3",
    lineHeight: 1.55,
  },
  tipTitle: {
    margin: 0,
    fontSize: 13,
    color: "#f0c29e",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  tipBody: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.5,
  },
  tipList: {
    margin: 0,
    paddingLeft: 18,
    color: "#d9c3b3",
    lineHeight: 1.55,
  },
  tipFootnote: {
    margin: 0,
    color: "#cbb09f",
    fontSize: 12,
  },
  notice: {
    margin: 0,
    minHeight: 18,
    color: "#ffcab5",
    fontSize: 13,
  },
  claimCard: {
    border: "1px solid #d9a67a",
    borderRadius: 12,
    background: "rgba(48, 34, 27, 0.75)",
    padding: 12,
    display: "grid",
    gap: 8,
  },
  claimTitle: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 700,
  },
  claimBody: {
    margin: 0,
    color: "#f8efe7",
    lineHeight: 1.5,
    fontSize: 14,
  },
};
