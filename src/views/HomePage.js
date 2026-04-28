import { useEffect, useRef, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { FirstTimeOnboarding } from "../components/FirstTimeOnboarding";
import { HOME_PAGE_CONTENT } from "../content/homePageContent";

const ONBOARDING_DONE_KEY = "haven.onboarding.completed.v1";
/**
 * Haven Home Page
 * Warm, simple entry point focused on emotional clarity.
 */
export function HomePage({
  locale = "en",
  onOpenTimeline,
  onCreateMemory,
  onOpenSettings,
  onOpenMemoryFromRing,
  onQuickSignIn,
  loading = false,
  quickSigningIn = false,
  message = "",
}) {
  const t = HOME_PAGE_CONTENT[locale] || HOME_PAGE_CONTENT.en;
  const ringHandledRef = useRef(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [ringSignIn, setRingSignIn] = useState({
    needed: false,
    token: "",
    reason: "",
  });
  const [platformSignInProvider, setPlatformSignInProvider] = useState("apple");

  useEffect(() => {
    if (ringHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const memoryId =
      params.get("memoryId") || params.get("memory") || params.get("m");
    if (!memoryId) return;
    ringHandledRef.current = true;
    onOpenMemoryFromRing?.(memoryId);
  }, [onOpenMemoryFromRing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const ring = url.searchParams.get("ring");
    if (ring !== "signin") return;
    setRingSignIn({
      needed: true,
      token: url.searchParams.get("token") || "",
      reason: url.searchParams.get("reason") || "",
    });
    url.searchParams.delete("ring");
    url.searchParams.delete("token");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes("macintosh") && "ontouchend" in window);
    if (isAndroid) {
      setPlatformSignInProvider("google");
      return;
    }
    if (isIOS) {
      setPlatformSignInProvider("apple");
      return;
    }
    setPlatformSignInProvider("apple");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
    if (!done) setOnboardingOpen(true);
  }, []);

  function markOnboardingDone() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    }
    setOnboardingOpen(false);
  }

  return (
    <>
      <main style={styles.page}>
        <section style={styles.shell}>
        <header style={styles.header}>
          <p style={styles.brand}>{t.brand}</p>
          <OnlineStatusBadge locale={locale} />
        </header>

        <div style={styles.hero}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtitle}>
            {t.subtitle}
          </p>
        </div>

        <section style={styles.howItWorksCard}>
          <p style={styles.howItWorksTitle}>{t.howTitle}</p>
          <p style={styles.howItWorksBody}>
            {t.howBody}
          </p>
        </section>
        {ringSignIn.needed ? (
          <section style={styles.ringSignInCard}>
            <p style={styles.ringSignInTitle}>{t.ringSignInTitle}</p>
            <p style={styles.howItWorksBody}>{t.ringSignInBody}</p>
            {ringSignIn.reason === "permission_denied" ? (
              <p style={styles.feedback}>{t.ringSignInPermissionHint}</p>
            ) : null}
            <button
              type="button"
              disabled={quickSigningIn}
              onClick={() =>
                onQuickSignIn?.(platformSignInProvider, ringSignIn.token)
              }
              style={styles.primaryButton}
            >
              {quickSigningIn
                ? t.ringSignInPrimaryLoading
                : platformSignInProvider === "google"
                  ? t.ringSignInGoogle
                  : t.ringSignInApple}
            </button>
            <div style={styles.altSignInRow}>
              <button
                type="button"
                disabled={quickSigningIn}
                onClick={() => onQuickSignIn?.("apple", ringSignIn.token)}
                style={styles.tertiaryButton}
              >
                {t.ringSignInApple}
              </button>
              <button
                type="button"
                disabled={quickSigningIn}
                onClick={() => onQuickSignIn?.("google", ringSignIn.token)}
                style={styles.tertiaryButton}
              >
                {t.ringSignInGoogle}
              </button>
            </div>
          </section>
        ) : null}

          <div style={styles.actions}>
          <button
            type="button"
            disabled={loading}
            onClick={onOpenTimeline}
            style={styles.primaryButton}
          >
            {loading ? t.opening : t.open}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCreateMemory}
            style={styles.secondaryButton}
          >
            {t.create}
          </button>
            <button
              type="button"
              disabled={loading}
              onClick={onOpenSettings}
              style={styles.tertiaryButton}
            >
              {t.settings}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setOnboardingOpen(true)}
              style={styles.tertiaryButton}
            >
              {t.start}
            </button>
          </div>

          <p style={styles.feedback}>{message || "\u00A0"}</p>
        </section>
      </main>
      <FirstTimeOnboarding
        open={onboardingOpen}
        locale={locale}
        onComplete={markOnboardingDone}
        onSkip={markOnboardingDone}
      />
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at top, #2a1e19 0%, #120f0e 55%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: 680,
    border: "1px solid #3a2d28",
    borderRadius: 22,
    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    padding: 24,
    display: "grid",
    gap: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.24em",
    fontSize: 12,
    color: "#d9c3b3",
  },
  hero: {
    display: "grid",
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.25,
    fontWeight: 500,
  },
  subtitle: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.7,
    maxWidth: 560,
  },
  howItWorksCard: {
    border: "1px solid #3a2d28",
    borderRadius: 14,
    background: "#1b1512",
    padding: 14,
    display: "grid",
    gap: 6,
  },
  howItWorksTitle: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#f0c29e",
  },
  howItWorksBody: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.6,
    fontSize: 14,
  },
  ringSignInCard: {
    border: "1px solid #d9a67a",
    borderRadius: 14,
    background: "#1b1512",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  ringSignInTitle: {
    margin: 0,
    fontSize: 13,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#f0c29e",
  },
  altSignInRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  actions: {
    display: "grid",
    gap: 12,
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 700,
    padding: "14px 18px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    padding: "12px 16px",
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    fontSize: 13,
    minHeight: 18,
    color: "#f2d8c5",
  },
  tertiaryButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#d9c3b3",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 16px",
    cursor: "pointer",
  },
};
