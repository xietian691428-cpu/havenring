"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";
import { START_PAGE_CONTENT } from "@/src/content/startPageContent";

const FTUX_STARTED_KEY = "haven.ftux.started.v1";

export default function StartClient() {
  const [busyProvider, setBusyProvider] = useState("");
  const [notice, setNotice] = useState("");
  const [supportsPasskey, setSupportsPasskey] = useState(false);
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const hero = START_PAGE_CONTENT.hero;
  const hasVideoHero = Boolean(hero.video);

  useEffect(() => {
    setSupportsPasskey(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined"
    );
  }, []);

  async function signInWith(provider: "apple" | "google") {
    setBusyProvider(provider);
    setNotice("");
    try {
      window.localStorage.setItem(FTUX_STARTED_KEY, "1");
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        setNotice("Sign-in could not start. Please try again.");
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
          <h1 style={styles.title}>Welcome to Your Private Memory Sanctuary</h1>
          <p style={styles.subtitle}>Simple. Private. Forever.</p>

          <button
            type="button"
            onClick={() => void signInWith("apple")}
            disabled={Boolean(busyProvider)}
            style={styles.primaryButton}
          >
            {busyProvider === "apple"
              ? "Opening Apple Sign In..."
              : "Start Your Memory Journey"}
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

          <section style={styles.tipCard}>
            <p style={styles.tipTitle}>Best iPhone experience</p>
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
};
