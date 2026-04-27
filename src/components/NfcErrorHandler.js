import { useMemo } from "react";
import { NFC_ERROR_HANDLER_CONTENT } from "../content/nfcErrorHandlerContent";

const ERROR_PATTERNS = [
  {
    key: "connection_lost",
    test: (msg) => /tag connection lost|connection lost|lost/i.test(msg),
  },
  {
    key: "stack_error",
    test: (msg) => /stack error|stack/i.test(msg),
  },
  {
    key: "session_invalidated",
    test: (msg) => /session invalidated|session.*ended|session/i.test(msg),
  },
  {
    key: "not_supported",
    test: (msg) => /not supported|ndefreader|nfc.*not/i.test(msg),
  },
  {
    key: "permission_denied",
    test: (msg) => /permission|notallowed|denied/i.test(msg),
  },
];

export function mapNfcErrorToGuidance(error, locale = "en") {
  const t = NFC_ERROR_HANDLER_CONTENT[locale] || NFC_ERROR_HANDLER_CONTENT.en;
  const raw = String(error?.message || error || "");
  const normalized = raw.toLowerCase();
  const matched = ERROR_PATTERNS.find((item) => item.test(normalized));
  if (!matched) {
    return {
      code: "generic",
      title: t.genericTitle,
      help: t.fallback,
      raw,
    };
  }
  const localized = t.errors?.[matched.key] || NFC_ERROR_HANDLER_CONTENT.en.errors[matched.key];
  return {
    code: matched.key,
    title: localized?.title || t.genericTitle,
    help: localized?.help || t.fallback,
    raw,
  };
}

/**
 * NfcErrorHandler
 * Friendly, actionable guidance for NFC failures.
 */
export function NfcErrorHandler({
  error,
  locale = "en",
  onTryAgain,
  onShowFullGuide,
  onDismiss,
}) {
  const t = NFC_ERROR_HANDLER_CONTENT[locale] || NFC_ERROR_HANDLER_CONTENT.en;
  const details = useMemo(() => mapNfcErrorToGuidance(error, locale), [error, locale]);

  if (!error) return null;

  return (
    <section style={styles.wrap} role="alert" aria-live="polite">
      <p style={styles.kicker}>{t.title}</p>
      <h4 style={styles.title}>{details.title}</h4>
      <p style={styles.body}>{details.help}</p>

      <div style={styles.actions}>
        <button type="button" onClick={onTryAgain} style={styles.primaryButton}>
          {t.tryAgain}
        </button>
        <button type="button" onClick={onShowFullGuide} style={styles.secondaryButton}>
          {t.showFullGuide}
        </button>
        <button type="button" onClick={onDismiss} style={styles.ghostButton}>
          {t.dismiss}
        </button>
      </div>
    </section>
  );
}

const styles = {
  wrap: {
    border: "1px solid #6b4a39",
    borderRadius: 14,
    background: "rgba(217, 166, 122, 0.12)",
    padding: 12,
    display: "grid",
    gap: 8,
  },
  kicker: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    margin: 0,
    color: "#f8efe7",
    fontSize: 20,
    lineHeight: 1.3,
  },
  body: {
    margin: 0,
    color: "#f4dfcf",
    fontSize: 16,
    lineHeight: 1.65,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "9px 13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "9px 13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostButton: {
    border: "none",
    background: "transparent",
    color: "#d9c3b3",
    textDecoration: "underline",
    padding: "9px 6px",
    cursor: "pointer",
    fontWeight: 600,
  },
};
