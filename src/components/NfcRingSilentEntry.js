"use client";

import { useState } from "react";
import { silentLoginViaNfcScan } from "../services/nfcSilentAuthService";
import { sanctuaryTheme } from "../theme/sanctuaryTheme";

function supabaseConfigured() {
  if (typeof process === "undefined") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * When there is no Supabase session, offers one-tap NFC UID login (no account picker).
 */
export function NfcRingSilentEntry({
  copy,
  onSignedIn,
}) {
  const t = copy || {};
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!supabaseConfigured()) return null;

  async function handleTap() {
    setBusy(true);
    setError("");
    try {
      await silentLoginViaNfcScan();
      onSignedIn?.();
    } catch (e) {
      const code = e?.code || e?.message || "";
      if (code === "nfc_login_unconfigured" || /not configured/i.test(String(e?.message))) {
        setError(t.unconfigured || "Cloud sign-in is not configured on this build.");
      } else if (code === "Unknown or inactive ring" || e?.message?.includes?.("Unknown")) {
        setError(t.noBinding || "This tag is not linked to an account.");
      } else if (e?.message === "no_uid_from_tag") {
        setError(t.noUid || "Could not read the tag ID.");
      } else {
        setError(t.generic || "Could not sign in with this ring.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={styles.wrap}
      role="region"
      aria-label={t.regionLabel || "Ring sign-in"}
    >
      <p style={styles.lede}>{t.lede}</p>
      <button
        type="button"
        onClick={() => void handleTap()}
        disabled={busy}
        style={styles.btn}
      >
        {busy ? t.scanning || "Hold ring…" : t.cta || "Continue with ring"}
      </button>
      {error ? (
        <p style={styles.err} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const styles = {
  wrap: {
    marginTop: 8,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(196, 149, 106, 0.35)",
    background: "rgba(44, 36, 31, 0.35)",
  },
  lede: {
    margin: "0 0 10px",
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(248, 239, 231, 0.72)",
  },
  btn: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  err: {
    margin: "10px 0 0",
    fontSize: 12,
    color: "#ffb8a3",
  },
};
