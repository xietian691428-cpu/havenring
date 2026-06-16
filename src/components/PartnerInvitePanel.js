import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InviteQrCode } from "@/src/components/InviteQrCode";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";
import { shareInviteLink, canNativeShare } from "@/lib/shareInviteLink";
import {
  fetchPartnerInviteStatus,
  preparePartnerInvite,
  revokePartnerInvite,
} from "@/src/services/partnerInviteService";

const POLL_MS = 8_000;

export function PartnerInvitePanel({
  localeContent: t,
  havenId,
  onClose,
  onPartnerJoined,
  onRefreshRings,
}) {
  const [phase, setPhase] = useState("preparing");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");
  const [shareState, setShareState] = useState("idle");
  const [waiting, setWaiting] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const prepareStartedRef = useRef(false);
  const inviteErrorRetriesRef = useRef(0);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const runPrepare = useCallback(async () => {
    setPhase("preparing");
    setError("");
    setShareState("idle");
    setWaiting(false);
    setPartnerJoined(false);
    try {
      const prepared = await preparePartnerInvite({ havenId });
      setInviteCode(prepared.inviteCode);
      setInviteUrl(prepared.inviteUrl);
      setAccessToken(prepared.accessToken);
      setPhase("ready");
    } catch (e) {
      const message = e instanceof Error ? e.message : "prepare_failed";
      if (message === "cloud_sign_in_required") {
        setError(t.cloudSignInRequired);
      } else {
        setError(message === "prepare_failed" ? t.invitePrepareFailed : message);
      }
      setPhase("error");
    }
  }, [havenId, t.cloudSignInRequired, t.invitePrepareFailed]);

  useEffect(() => {
    if (prepareStartedRef.current) return;
    prepareStartedRef.current = true;
    void runPrepare();
  }, [runPrepare]);

  useEffect(() => {
    if (phase !== "error") return undefined;
    if (inviteErrorRetriesRef.current >= 2) return undefined;
    const timer = window.setTimeout(() => {
      inviteErrorRetriesRef.current += 1;
      void runPrepare();
    }, 2000 * (inviteErrorRetriesRef.current + 1));
    return () => window.clearTimeout(timer);
  }, [phase, runPrepare]);

  const checkStatus = useCallback(async () => {
    if (!inviteCode || !accessToken) return false;
    try {
      const status = await fetchPartnerInviteStatus({
        inviteCode,
        accessToken,
      });
      if (status.partnerJoined || status.consumed) {
        setPartnerJoined(true);
        setWaiting(false);
        onRefreshRings?.();
        onPartnerJoined?.();
        return true;
      }
      if (!status.pending) {
        setError(t.inviteExpiredOrClosed);
        setWaiting(false);
      }
      return false;
    } catch {
      return false;
    }
  }, [
    inviteCode,
    accessToken,
    onPartnerJoined,
    onRefreshRings,
    t.inviteExpiredOrClosed,
  ]);

  useEffect(() => {
    if (!waiting || partnerJoined) return undefined;
    const tick = () => {
      void checkStatus();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [waiting, partnerJoined, checkStatus]);

  async function handleShare() {
    if (!inviteUrl) return;
    setShareState("busy");
    setError("");
    const result = await shareInviteLink(inviteUrl);
    if (result === "shared" || result === "copied") {
      setShareState(result);
      setWaiting(true);
      void checkStatus();
      return;
    }
    if (result === "cancelled") {
      setShareState("idle");
      return;
    }
    setShareState("failed");
    setError(t.inviteShareFailed);
  }

  async function handleCopyFallback() {
    if (!inviteUrl) return;
    setShareState("busy");
    setError("");
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareState("copied");
      setWaiting(true);
      void checkStatus();
    } catch {
      setShareState("failed");
      setError(t.inviteShareFailed);
    }
  }

  async function handleRevoke() {
    if (!inviteCode || !accessToken) return;
    setRevokeBusy(true);
    setError("");
    try {
      await revokePartnerInvite({ inviteCode, accessToken });
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.inviteRevokeFailed);
    } finally {
      setRevokeBusy(false);
    }
  }

  const showCopyPrimary = !canNativeShare();
  const shareLabel =
    shareState === "busy"
      ? t.inviteSharing
      : showCopyPrimary
        ? t.inviteCopyLinkCta
        : t.inviteShareCta;

  return portalReady
    ? createPortal(
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="partner-invite-title">
          <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
            <section style={styles.shell}>
              <header style={styles.header}>
                <button type="button" onClick={() => onClose?.()} style={styles.backBtn}>
                  {t.inviteBackCta}
                </button>
              </header>

              <div style={styles.hero}>
                <h1 id="partner-invite-title" style={styles.title}>
                  {t.invitePanelTitle}
                </h1>
                {t.invitePanelSubtitle ? (
                  <p style={styles.subtitle}>{t.invitePanelSubtitle}</p>
                ) : null}
              </div>

              {phase === "preparing" ? <p style={styles.note}>{t.inviteCreating}</p> : null}

              {phase === "error" ? (
                <div style={styles.errorBox}>
                  <p style={styles.error}>{error || t.invitePrepareFailed}</p>
                </div>
              ) : null}

              {phase === "ready" && inviteUrl ? (
                <>
                  <div style={styles.qrWrap}>
                    <InviteQrCode value={inviteUrl} size={220} />
                  </div>

                  <div style={styles.actions}>
                    <button
                      type="button"
                      onClick={() => (showCopyPrimary ? void handleCopyFallback() : void handleShare())}
                      disabled={shareState === "busy"}
                      style={styles.primaryBtn}
                    >
                      {shareLabel}
                    </button>
                    {!showCopyPrimary ? (
                      <button
                        type="button"
                        onClick={() => void handleCopyFallback()}
                        disabled={shareState === "busy"}
                        style={styles.secondaryBtn}
                      >
                        {t.inviteCopyLinkCta}
                      </button>
                    ) : null}
                  </div>

                  {waiting && !partnerJoined ? (
                    <p style={styles.waitingLine} role="status">
                      {t.inviteWaitingTitle}
                    </p>
                  ) : null}

                  {partnerJoined ? (
                    <div style={styles.successBox} role="status">
                      <p style={styles.successTitle}>{t.invitePartnerJoinedTitle}</p>
                      <button type="button" onClick={() => onClose?.()} style={styles.primaryBtn}>
                        {t.inviteDoneCta}
                      </button>
                    </div>
                  ) : null}

                  {shareState === "copied" && !waiting ? (
                    <p style={styles.note}>{t.inviteLinkCopied}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleRevoke()}
                    disabled={revokeBusy || partnerJoined}
                    style={styles.ghostBtn}
                  >
                    {revokeBusy ? t.inviteRevoking : t.revokeInvite}
                  </button>
                </>
              ) : null}

              {error && phase === "ready" ? <p style={styles.error}>{error}</p> : null}
            </section>
          </main>
        </div>,
        document.body
      )
    : null;
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
  },
  page: {
    minHeight: "100dvh",
    boxSizing: "border-box",
    padding:
      "max(16px, env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom))",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 520,
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  header: {
    display: "flex",
    justifyContent: "flex-start",
  },
  backBtn: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    padding: "8px 0",
  },
  hero: {
    display: "grid",
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 600,
    lineHeight: 1.15,
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.72)",
  },
  qrWrap: {
    justifySelf: "center",
    width: "100%",
    maxWidth: 280,
    overflow: "visible",
  },
  actions: {
    display: "grid",
    gap: 10,
  },
  primaryBtn: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
    minHeight: 48,
  },
  secondaryBtn: {
    border: "1px solid rgba(232, 220, 208, 0.22)",
    background: "transparent",
    color: sanctuaryTheme.cream,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
    minHeight: 44,
  },
  ghostBtn: {
    border: "none",
    background: "transparent",
    color: "rgba(232, 220, 208, 0.45)",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    justifySelf: "center",
    padding: 8,
  },
  waitingLine: {
    margin: 0,
    fontSize: 14,
    textAlign: "center",
    color: sanctuaryTheme.accentSoft,
  },
  successBox: {
    padding: "16px",
    borderRadius: 14,
    border: "1px solid rgba(120, 200, 160, 0.45)",
    background: "rgba(28, 48, 36, 0.5)",
    display: "grid",
    gap: 10,
  },
  successTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 650,
    color: "#b7f7c8",
    textAlign: "center",
  },
  note: {
    margin: 0,
    fontSize: 13,
    color: sanctuaryTheme.inkSoft,
    textAlign: "center",
  },
  errorBox: {
    display: "grid",
    gap: 12,
  },
  error: {
    margin: 0,
    fontSize: 14,
    color: "#ffb4a8",
    lineHeight: 1.5,
  },
};
