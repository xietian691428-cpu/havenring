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
  authExpiredNotice = "",
}) {
  const t = copy || {};
  const [busy, setBusy] = useState(false);
  const [errorState, setErrorState] = useState({ message: "", help: "" });

  if (!supabaseConfigured()) return null;

  async function handleTap() {
    setBusy(true);
    setErrorState({ message: "", help: "" });
    try {
      await silentLoginViaNfcScan();
      onSignedIn?.();
    } catch (e) {
      const code = e?.code || e?.message || "";
      if (code === "nfc_login_unconfigured" || /not configured/i.test(String(e?.message))) {
        setErrorState({
          message: t.unconfigured || "Cloud sign-in is not configured on this build.",
          help:
            t.helpUnconfigured ||
            "Server-side NFC login is not configured yet. Please contact support or the app operator.",
        });
      } else if (code === "Unknown or inactive ring" || e?.message?.includes?.("Unknown")) {
        setErrorState({
          message: t.noBinding || "This tag is not linked to an account.",
          help:
            t.helpNoBinding ||
            "This ring is not bound to this account. Open Rings and bind this ring first, then try again.",
        });
      } else if (e?.message === "no_uid_from_tag") {
        setErrorState({
          message: t.noUid || "Could not read the tag ID.",
          help:
            t.helpNoUid ||
            "The tag ID was not read. Keep your ring close to the NFC area for 1-2 seconds and try again.",
        });
      } else {
        setErrorState({
          message: t.generic || "Could not sign in with this ring.",
          help:
            t.helpGeneric ||
            "Try once more with a steady ring touch. If it still fails, check network and ring binding status.",
        });
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
      {authExpiredNotice ? <p style={styles.notice}>{authExpiredNotice}</p> : null}
      <button
        type="button"
        onClick={() => void handleTap()}
        disabled={busy}
        style={styles.btn}
      >
        {busy ? t.scanning || "Hold ring…" : t.cta || "Continue with ring"}
      </button>
      {errorState.message ? (
        <p style={styles.err} role="alert">
          {errorState.message}
        </p>
      ) : null}
      {errorState.help ? <p style={styles.help}>{errorState.help}</p> : null}
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
  notice: {
    margin: "0 0 10px",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#f2d8c5",
    background: "rgba(217, 166, 122, 0.08)",
    border: "1px solid rgba(217, 166, 122, 0.3)",
    borderRadius: 10,
    padding: "8px 10px",
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
  help: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(248, 239, 231, 0.74)",
  },
};
