import { useMemo } from "react";
import { SAVE_TO_HAVEN_DIALOG_CONTENT } from "../content/saveToHavenDialogContent";

/**
 * Post-save dialog for local Haven persistence.
 * The flow is explicit: saving -> success -> next action.
 */
export function SaveToHavenDialog({
  open,
  locale = "en",
  status = "saving", // saving | success | error
  errorMessage = "",
  onSealNow,
  onCreateAnother,
  onRetry,
  onClose,
  onBack,
  errorTitle = "",
}) {
  const t = SAVE_TO_HAVEN_DIALOG_CONTENT[locale] || SAVE_TO_HAVEN_DIALOG_CONTENT.en;
  const title = useMemo(() => {
    if (status === "saving") return t.titleSaving;
    if (status === "success") return t.titleSuccess;
    if (status === "error" && errorTitle) return errorTitle;
    return t.titleError;
  }, [status, t, errorTitle]);

  const subtitle = useMemo(() => {
    if (status === "saving") {
      return t.subtitleSaving;
    }
    if (status === "success") {
      return t.subtitleSuccess;
    }
    return errorMessage || t.subtitleErrorFallback;
  }, [status, errorMessage, t]);

  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={t.dialogAriaLabel}
    >
      <section style={styles.dialog}>
        {status === "error" && onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={styles.dismissBtn}
            aria-label={t.close}
          >
            ×
          </button>
        ) : null}
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>{subtitle}</p>

        {status === "saving" ? (
          <div style={styles.spinner} aria-hidden />
        ) : null}

        {status === "success" ? (
          <div style={styles.actions}>
            <button type="button" onClick={onSealNow} style={styles.primaryButton}>
              {t.touchRingToSeal}
            </button>
            <button type="button" onClick={onCreateAnother} style={styles.secondaryButton}>
              {t.createAnother}
            </button>
          </div>
        ) : null}

        {status === "error" ? (
          <div style={styles.actions}>
            <button
              type="button"
              onClick={onRetry || onCreateAnother}
              style={styles.primaryButton}
            >
              {t.tryAgain}
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} style={styles.secondaryButton}>
                {t.close}
              </button>
            ) : null}
            {onBack ? (
              <button type="button" onClick={onBack} style={styles.secondaryButton}>
                {t.backToMemories}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(7, 6, 6, 0.55)",
    backdropFilter: "blur(5px)",
    display: "grid",
    placeItems: "center",
    zIndex: 40,
    padding: 16,
  },
  dialog: {
    position: "relative",
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    border: "1px solid #3a2d28",
    background: "#171210",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    padding: 18,
    display: "grid",
    gap: 12,
  },
  dismissBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: "#f8efe7",
    paddingRight: 28,
  },
  subtitle: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.6,
  },
  spinner: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid #5a3b30",
    borderTopColor: "#f0c29e",
    animation: "spin 900ms linear infinite",
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
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
