import { useEffect, useMemo, useRef, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { TIMELINE_PAGE_CONTENT } from "../content/timelinePageContent";
import { consumeWelcomeToast } from "../utils/welcomeToast";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";
import { NfcRingSilentEntry } from "../components/NfcRingSilentEntry";

/**
 * Timeline — primary “memory space” view; photo-forward cards on warm canvas.
 */
export function TimelinePage({
  memories = [],
  loading = false,
  syncing = false,
  error = "",
  integrityWarning = "",
  cloudPlaceholders = [],
  syncIssues = [],
  syncMeta = {},
  onResyncNow,
  onResyncActiveRing,
  onRecoverNow,
  onOpenMemory,
  onOpenMemoryFromRing,
  locale = "en",
  showRingSignIn = false,
  onRingSignedIn,
}) {
  const t = TIMELINE_PAGE_CONTENT[locale] || TIMELINE_PAGE_CONTENT.en;
  const [pinnedId, setPinnedId] = useState(null);
  const [notice, setNotice] = useState("");
  const [welcomeLine, setWelcomeLine] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const ringHandledRef = useRef(false);
  const { soundEnabled, hapticEnabled, soundScope } = useFeedbackPrefs();
  const isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;

  const ordered = useMemo(() => {
    const list = [...memories].sort((a, b) => b.timelineAt - a.timelineAt);
    if (!pinnedId) return list;
    return list.sort((a, b) => (a.id === pinnedId ? -1 : b.id === pinnedId ? 1 : 0));
  }, [memories, pinnedId]);

  const groupedCloud = useMemo(() => {
    const map = new Map();
    for (const row of cloudPlaceholders) {
      const key = row.uidKey || row.ring_id || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          key,
          ringLabel: row.ringLabel || "Ring",
          rows: [],
        });
      }
      map.get(key).rows.push(row);
    }
    return Array.from(map.values()).map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => b.timelineAt - a.timelineAt),
    }));
  }, [cloudPlaceholders]);

  const syncIssueLines = useMemo(() => {
    const uniq = Array.from(new Set(syncIssues || []));
    return uniq
      .map((code) => {
        if (code === "auth") return t.syncIssueAuth;
        if (code === "network") return t.syncIssueNetwork;
        if (code === "hash") return t.syncIssueHash;
        return "";
      })
      .filter(Boolean);
  }, [syncIssues, t]);

  const failureReasonText = useMemo(() => {
    if (syncMeta?.lastFailureCode === "auth") return t.syncIssueAuth;
    if (syncMeta?.lastFailureCode === "hash") return t.syncIssueHash;
    if (syncMeta?.lastFailureCode === "network") return t.syncIssueNetwork;
    return "";
  }, [syncMeta?.lastFailureCode, t]);

  function formatTs(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  }

  useEffect(() => {
    const payload = consumeWelcomeToast();
    if (!payload?.nickname) return;
    const line = t.welcomeBackNamed.replace("{name}", payload.nickname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot welcome from session after ring setup
    setWelcomeLine(line);
    triggerSuccessFeedback({
      soundEnabled,
      hapticEnabled,
      allowSound: soundScope === "all_success",
    });
    const id = window.setTimeout(() => setWelcomeLine(""), 3200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePin(id) {
    setPinnedId((prev) => {
      const next = prev === id ? null : id;
      setNotice(next ? t.pinnedNotice : t.unpinnedNotice);
      triggerSuccessFeedback({
        soundEnabled,
        hapticEnabled,
        allowSound: soundScope === "all_success",
      });
      return next;
    });
  }

  useEffect(() => {
    if (ringHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const memoryId =
      params.get("memoryId") || params.get("memory") || params.get("m");
    if (!memoryId) return;
    ringHandledRef.current = true;
    (onOpenMemoryFromRing ?? onOpenMemory)?.(memoryId);
  }, [onOpenMemoryFromRing, onOpenMemory]);

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{t.brand}</p>
            <h1 style={styles.title}>{t.title}</h1>
            <p style={styles.tagline}>{t.tagline}</p>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        {welcomeLine ? (
          <div style={styles.welcomeToast} role="status">
            {welcomeLine}
          </div>
        ) : null}

        {showRingSignIn ? (
          <NfcRingSilentEntry
            copy={{
              regionLabel: t.nfcRegionLabel,
              lede: t.nfcLede,
              cta: t.nfcCta,
              scanning: t.nfcScanning,
              generic: t.nfcErrGeneric,
              noBinding: t.nfcErrNoBinding,
              noUid: t.nfcErrNoUid,
              unconfigured: t.nfcErrUnconfigured,
            }}
            onSignedIn={onRingSignedIn}
          />
        ) : null}

        <div style={styles.syncStatusBox}>
          <p style={styles.syncStatusTitle}>
            {t.syncStatusLabel}: {syncing ? t.syncStatusRunning : t.syncStatusIdle}
          </p>
          <p style={styles.syncStatusLine}>
            {t.syncLastAttempt.replace("{time}", formatTs(syncMeta?.lastAttemptAt))}
          </p>
          <p style={styles.syncStatusLine}>
            {t.syncLastSuccess.replace("{time}", formatTs(syncMeta?.lastSuccessAt))}
          </p>
          {syncMeta?.lastFailureAt ? (
            <p style={styles.syncStatusLine}>
              {t.syncLastFailure.replace(
                "{reason}",
                `${formatTs(syncMeta.lastFailureAt)} · ${failureReasonText || "Unknown"}`
              )}
            </p>
          ) : null}
          {syncMeta?.failureStreak ? (
            <p style={styles.syncStatusLine}>
              {t.syncFailureStreak.replace(
                "{n}",
                String(syncMeta.failureStreak || 0)
              )}
            </p>
          ) : null}
          {syncMeta?.nextRetryAt ? (
            <p style={styles.syncStatusLine}>
              {t.syncNextRetry.replace(
                "{time}",
                formatTs(syncMeta.nextRetryAt)
              )}
            </p>
          ) : null}
          {syncMeta?.lastRecoveryAt ? (
            <p style={styles.syncStatusLine}>
              {t.syncLastRecovery
                .replace("{time}", formatTs(syncMeta.lastRecoveryAt))
                .replace("{count}", String(syncMeta.lastRecoveryCount || 0))}
            </p>
          ) : null}
          <div style={styles.integrityActions}>
            <button
              type="button"
              style={styles.integrityButton}
              onClick={() => void onRecoverNow?.()}
              disabled={syncing}
            >
              {syncing ? t.resyncing : t.rebuildLocalCache}
            </button>
          </div>
        </div>

        {isOffline ? (
          <p style={styles.offlineTip}>{t.offlineTip}</p>
        ) : null}
        <p style={styles.cloudNote}>{t.cloudSourceNote}</p>

        {integrityWarning ? (
          <div style={styles.integrityBox}>
            <p style={styles.integrityText}>{t.integrityMismatch}</p>
            <div style={styles.integrityActions}>
              <button
                type="button"
                style={styles.integrityButton}
                onClick={() => void onResyncActiveRing?.()}
                disabled={syncing}
              >
                {syncing ? t.resyncing : t.resyncActive}
              </button>
              <button
                type="button"
                style={styles.integrityButton}
                onClick={() => void onResyncNow?.()}
                disabled={syncing}
              >
                {syncing ? t.resyncing : t.resyncAll}
              </button>
            </div>
          </div>
        ) : null}

        {syncIssueLines.length ? (
          <div style={styles.issueBox}>
            {syncIssueLines.map((line) => (
              <p key={line} style={styles.issueLine}>
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {!loading && !ordered.length ? (
          <p style={styles.feedback}>{t.empty}</p>
        ) : null}

        <ol style={styles.list}>
          {ordered.map((memory) => {
            const pinned = pinnedId === memory.id;
            return (
              <li key={memory.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <small style={styles.date}>
                    {new Date(memory.timelineAt).toLocaleString()}
                  </small>
                  <button
                    type="button"
                    onClick={() => togglePin(memory.id)}
                    style={styles.pinButton}
                  >
                    {pinned ? t.unpin : t.pin}
                  </button>
                </div>
                <h3 style={styles.cardTitle}>
                  {pinned ? "📌 " : ""}
                  {memory.title || t.untitled}
                </h3>
                <p style={styles.preview}>{memory.story || t.noStory}</p>
                <button
                  type="button"
                  onClick={() => onOpenMemory?.(memory.id)}
                  style={styles.primaryButton}
                  disabled={loading}
                >
                  {t.open}
                </button>
              </li>
            );
          })}
        </ol>

        {groupedCloud.length ? (
          <section style={styles.cloudSection}>
            <p style={styles.cloudTitle}>{t.cloudSectionTitle}</p>
            {groupedCloud.map((group) => (
              <div key={group.key} style={styles.cloudGroup}>
                <div style={styles.cloudGroupHeader}>
                  <p style={styles.cloudGroupTitle}>
                    {group.ringLabel} ·{" "}
                    {t.cloudGroupCount.replace("{n}", String(group.rows.length))}
                  </p>
                  <button
                    type="button"
                    style={styles.cloudToggleBtn}
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                  >
                    {expandedGroups[group.key] ? t.cloudShowLess : t.cloudShowMore}
                  </button>
                </div>
                <ol style={styles.list}>
                  {(expandedGroups[group.key]
                    ? group.rows
                    : group.rows.slice(0, 3)
                  ).map((row) => (
                    <li key={`cloud-${row.id}`} style={styles.cloudCard}>
                      <div style={styles.cardHeader}>
                        <small style={styles.date}>
                          {new Date(row.timelineAt).toLocaleString()}
                        </small>
                      </div>
                      <h3 style={styles.cardTitle}>☁ {t.untitled}</h3>
                      <p style={styles.preview}>
                        {t.cloudPlaceholderBody.replace(
                          "{ring}",
                          row.ringLabel || "ring"
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ) : null}

        <p style={styles.feedback}>{notice || "\u00A0"}</p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding:
      "12px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 820,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  brand: {
    margin: 0,
    color: sanctuaryTheme.accentSoft,
    fontSize: 11,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0 0",
    fontSize: 28,
    fontWeight: 500,
    color: sanctuaryTheme.cream,
  },
  tagline: {
    margin: "6px 0 0",
    fontSize: 14,
    lineHeight: 1.45,
    color: "rgba(248, 239, 231, 0.65)",
    maxWidth: 420,
  },
  welcomeToast: {
    margin: 0,
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(196, 149, 106, 0.35)",
    background: "rgba(44, 36, 31, 0.45)",
    color: sanctuaryTheme.creamMuted,
    fontSize: 15,
    textAlign: "center",
  },
  offlineTip: {
    margin: 0,
    padding: "10px 12px",
    border: "1px solid rgba(107, 83, 68, 0.25)",
    borderRadius: 10,
    background: "rgba(217, 166, 122, 0.08)",
    color: "#f2d8c5",
  },
  syncStatusBox: {
    border: "1px solid rgba(122, 163, 201, 0.25)",
    background: "rgba(122, 163, 201, 0.08)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "grid",
    gap: 4,
  },
  syncStatusTitle: {
    margin: 0,
    fontSize: 13,
    color: "#d5e8f7",
  },
  syncStatusLine: {
    margin: 0,
    fontSize: 12,
    color: "rgba(213, 232, 247, 0.78)",
    lineHeight: 1.4,
  },
  cloudNote: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(232, 220, 208, 0.6)",
  },
  integrityBox: {
    margin: 0,
    padding: "10px 12px",
    border: "1px solid rgba(201, 123, 132, 0.35)",
    borderRadius: 10,
    background: "rgba(201, 123, 132, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  integrityText: {
    margin: 0,
    color: "#ffd4c9",
    fontSize: 13,
    lineHeight: 1.45,
  },
  integrityButton: {
    border: "1px solid rgba(201, 123, 132, 0.5)",
    background: "transparent",
    color: "#ffd9cf",
    borderRadius: 999,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  integrityActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  issueBox: {
    border: "1px solid rgba(217, 166, 122, 0.28)",
    background: "rgba(217, 166, 122, 0.08)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "grid",
    gap: 6,
  },
  issueLine: {
    margin: 0,
    color: "#f7dcc8",
    fontSize: 12,
    lineHeight: 1.45,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 12,
  },
  card: {
    border: "1px solid rgba(232, 220, 208, 0.1)",
    borderRadius: 16,
    background: "rgba(26, 21, 18, 0.42)",
    backdropFilter: "blur(8px)",
    padding: 16,
    display: "grid",
    gap: 8,
  },
  cloudSection: {
    display: "grid",
    gap: 10,
  },
  cloudGroup: {
    display: "grid",
    gap: 8,
  },
  cloudGroupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cloudGroupTitle: {
    margin: 0,
    fontSize: 13,
    color: "rgba(232, 220, 208, 0.78)",
  },
  cloudToggleBtn: {
    border: "1px solid rgba(122, 163, 201, 0.35)",
    borderRadius: 999,
    background: "transparent",
    color: "#c8dbea",
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  cloudTitle: {
    margin: 0,
    fontSize: 13,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(232, 220, 208, 0.62)",
  },
  cloudCard: {
    border: "1px dashed rgba(122, 163, 201, 0.38)",
    borderRadius: 16,
    background: "rgba(22, 28, 34, 0.35)",
    padding: 16,
    display: "grid",
    gap: 8,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    color: sanctuaryTheme.inkSoft,
    fontSize: 12,
  },
  pinButton: {
    border: "1px solid rgba(196, 149, 106, 0.35)",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    color: sanctuaryTheme.cream,
  },
  preview: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.78)",
    lineHeight: 1.6,
  },
  primaryButton: {
    justifySelf: "start",
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    minHeight: 18,
    color: "rgba(248, 239, 231, 0.55)",
    fontSize: 13,
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
  },
};
