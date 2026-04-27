import { useMemo, useState } from "react";
import { NfcErrorHandler } from "./NfcErrorHandler";
import { NfcTroubleshooting } from "./NfcTroubleshooting";
import {
  readRingTextRecord,
  writeFixedEntryUrlToRing,
} from "../services/nfcRingService";
import { getNfcGuideContent } from "../content/nfcGuideContent";
import { usePlatformTarget } from "../hooks/usePlatformTarget";

/**
 * NfcGuideModal
 * Friendly first-time NFC guide with clear visual target zone.
 */
export function NfcGuideModal({
  open,
  locale = "en",
  onClose,
  onShowLater,
}) {
  const platform = usePlatformTarget();
  const t = useMemo(() => getNfcGuideContent(locale, platform), [locale, platform]);
  const [nfcError, setNfcError] = useState(null);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [nfcStatus, setNfcStatus] = useState("");
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [lastAction, setLastAction] = useState("read");
  if (!open) return null;

  async function handleReadTap() {
    setLastAction("read");
    setNfcBusy(true);
    setNfcError(null);
    setNfcStatus(t.hold);
    try {
      const result = await readRingTextRecord();
      setNfcStatus(`${t.ringDetected}${result.text.slice(0, 56)}${result.text.length > 56 ? "..." : ""}`);
    } catch (error) {
      setNfcStatus("");
      setNfcError(error);
    } finally {
      setNfcBusy(false);
    }
  }

  async function handleWriteTap() {
    setLastAction("write");
    setNfcBusy(true);
    setNfcError(null);
    const fixedUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/hub`
        : "https://haven.yourdomain.com/hub";
    setNfcStatus(t.writingStatus);
    try {
      await writeFixedEntryUrlToRing(fixedUrl);
      setNfcStatus(t.writeSuccess);
    } catch (error) {
      setNfcStatus("");
      setNfcError(error);
    } finally {
      setNfcBusy(false);
    }
  }

  function retryLastAction() {
    if (lastAction === "write") {
      void handleWriteTap();
      return;
    }
    void handleReadTap();
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="nfc-guide-title">
      <section style={styles.modal}>
        <header style={styles.header}>
          <h2 id="nfc-guide-title" style={styles.title}>
            {t.title}
          </h2>
          <p style={styles.intro}>{t.intro}</p>
        </header>

        <div style={styles.content}>
          <div style={styles.phoneWrap}>
            <IphoneBackDiagram
              ariaLabel={t.diagramAriaLabel}
              sweetSpotLabel={t.sweetSpotLabel}
            />
          </div>

          <ol style={styles.stepList}>
            {t.steps.map((step) => (
              <li key={step.title} style={styles.stepItem}>
                <span style={styles.stepIcon} aria-hidden>
                  {step.icon}
                </span>
                <div style={styles.stepTextWrap}>
                  <p style={styles.stepTitle}>{step.title}</p>
                  <p style={styles.stepBody}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <footer style={styles.footer}>
          <div style={styles.nfcActions}>
            <button
              type="button"
              onClick={handleReadTap}
              disabled={nfcBusy}
              style={styles.secondaryButton}
            >
              {nfcBusy && lastAction === "read" ? t.reading : t.read}
            </button>
            <button
              type="button"
              onClick={handleWriteTap}
              disabled={nfcBusy}
              style={styles.secondaryButton}
            >
              {nfcBusy && lastAction === "write"
                ? t.writing
                : t.write}
            </button>
          </div>
          <p style={styles.statusText}>{nfcStatus || "\u00A0"}</p>
          <NfcErrorHandler
            error={nfcError}
            locale={locale}
            onTryAgain={retryLastAction}
            onShowFullGuide={() => {
              setNfcError(null);
              setNfcStatus("");
              setShowTroubleshooting(true);
            }}
            onDismiss={() => setNfcError(null)}
          />
          {showTroubleshooting ? (
            <NfcTroubleshooting locale={locale} platform={platform} />
          ) : null}
          <button type="button" onClick={onClose} style={styles.primaryButton}>
            {t.gotIt}
          </button>
          <button type="button" onClick={onShowLater} style={styles.secondaryButton}>
            {t.later}
          </button>
        </footer>
      </section>
    </div>
  );
}

function IphoneBackDiagram({ ariaLabel, sweetSpotLabel }) {
  return (
    <svg viewBox="0 0 320 520" width="100%" style={styles.svg} aria-label={ariaLabel}>
      <defs>
        <linearGradient id="phoneBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2b2421" />
          <stop offset="100%" stopColor="#171210" />
        </linearGradient>
        <linearGradient id="zoneGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3c9a9" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#d9a67a" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <rect x="22" y="12" width="276" height="496" rx="44" fill="url(#phoneBg)" stroke="#4a3932" strokeWidth="3" />
      <rect x="40" y="30" width="92" height="92" rx="20" fill="#231c19" stroke="#5b463d" strokeWidth="2" />
      <circle cx="68" cy="58" r="14" fill="#161210" stroke="#71584c" strokeWidth="2" />
      <circle cx="105" cy="58" r="14" fill="#161210" stroke="#71584c" strokeWidth="2" />
      <circle cx="86" cy="90" r="14" fill="#161210" stroke="#71584c" strokeWidth="2" />

      <ellipse cx="160" cy="126" rx="95" ry="38" fill="url(#zoneGlow)" />
      <ellipse cx="160" cy="126" rx="95" ry="38" fill="none" stroke="#ffd8bb" strokeWidth="2" strokeDasharray="8 8" />

      <path d="M278 74 C298 76 308 86 304 106 C298 132 264 142 234 134" fill="none" stroke="#ffd8bb" strokeWidth="3" />
      <polygon points="230,133 242,126 240,140" fill="#ffd8bb" />
      <text x="206" y="64" fill="#ffd8bb" fontSize="13" fontFamily="Inter, sans-serif">
        {sweetSpotLabel}
      </text>
    </svg>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    background: "rgba(8, 7, 6, 0.72)",
    backdropFilter: "blur(8px)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 980,
    maxHeight: "92vh",
    overflow: "auto",
    borderRadius: 22,
    border: "1px solid #4b3931",
    background: "linear-gradient(180deg, #1a1412 0%, #120f0e 100%)",
    color: "#f8efe7",
    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
    padding: 20,
    display: "grid",
    gap: 18,
  },
  header: { display: "grid", gap: 8 },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.2,
    fontWeight: 650,
    letterSpacing: "0.01em",
  },
  intro: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 17,
    lineHeight: 1.65,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 340px) 1fr",
    gap: 20,
    alignItems: "start",
  },
  phoneWrap: {
    border: "1px solid #46352d",
    borderRadius: 16,
    background: "#171210",
    padding: 12,
  },
  svg: { display: "block", height: "auto" },
  stepList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 12,
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    border: "1px solid #3d2e27",
    borderRadius: 14,
    padding: 14,
    background: "#1a1412",
  },
  stepIcon: { fontSize: 24, lineHeight: 1.1 },
  stepTextWrap: { display: "grid", gap: 4 },
  stepTitle: {
    margin: 0,
    color: "#f0c29e",
    fontWeight: 700,
    fontSize: 16,
  },
  stepBody: {
    margin: 0,
    color: "#f8efe7",
    fontSize: 17,
    lineHeight: 1.6,
  },
  footer: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    flexDirection: "column",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  nfcActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignSelf: "stretch",
  },
  statusText: {
    margin: 0,
    color: "#f2d8c5",
    minHeight: 18,
    fontSize: 13,
    alignSelf: "stretch",
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "11px 16px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
  secondaryButton: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "11px 16px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
  },
};
