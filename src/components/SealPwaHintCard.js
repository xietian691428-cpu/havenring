import Link from "next/link";
import { useEffect, useState } from "react";
import { isStandaloneDisplayMode, usePlatform } from "../hooks/usePlatform";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { SEAL_PWA_HINT } from "../features/seal/sealUserMessages";
import { STORAGE_KEYS } from "../../lib/storage-keys";

/**
 * One-line install hint for seal reliability (browser tab → Home Screen / install).
 */
export function SealPwaHintCard({ className = "" }) {
  const { platform, ready } = usePlatform();
  const [dismissed, setDismissed] = useState(true);
  const { canInstall, install } = usePwaInstall();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(
        window.localStorage.getItem(STORAGE_KEYS.sealPwaHintDismissed) === "1"
      );
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!ready || isStandaloneDisplayMode() || dismissed) {
    return null;
  }
  if (platform !== "ios" && platform !== "android") {
    return null;
  }

  function onDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEYS.sealPwaHintDismissed, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  async function onAndroidInstall() {
    await install();
  }

  const setupHref =
    platform === "ios"
      ? "/setup?return=%2Fapp%3Fopen%3Dnew"
      : "/setup?return=%2Fapp";

  return (
    <aside className={className} style={styles.card} role="note">
      <p style={styles.line}>{SEAL_PWA_HINT}</p>
      <div style={styles.actions}>
        {platform === "android" && canInstall ? (
          <button type="button" onClick={() => void onAndroidInstall()} style={styles.primary}>
            Install
          </button>
        ) : null}
        <Link href={setupHref} style={styles.link}>
          {platform === "ios" ? "Add to Home Screen" : "How to install"}
        </Link>
        <button type="button" onClick={onDismiss} style={styles.dismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </aside>
  );
}

const styles = {
  card: {
    margin: "0 0 12px",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(90, 72, 62, 0.55)",
    background: "rgba(24, 18, 15, 0.92)",
    display: "grid",
    gap: 8,
  },
  line: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(224, 206, 194, 0.9)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  primary: {
    border: "1px solid rgba(196, 149, 106, 0.85)",
    background: "linear-gradient(180deg, #e8b892, #c7976a)",
    color: "#1a1411",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  link: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e8b892",
    textDecoration: "none",
  },
  dismiss: {
    marginLeft: "auto",
    border: "none",
    background: "transparent",
    color: "rgba(190, 178, 168, 0.75)",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    padding: "0 4px",
  },
};
