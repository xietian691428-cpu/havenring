import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RINGS_PAGE_CONTENT } from "../content/ringsPageContent";
import {
  getBoundRings,
  pruneStaleLocalRingsFromCloud,
  RING_COLOR_OPTIONS,
  updateRingCloudMetadata,
} from "../services/ringRegistryService";
import { sanctuaryTheme } from "../theme/sanctuaryTheme";
import { APP_PAGE_PADDING } from "../theme/pageLayout";
import {
  canUseFeature,
} from "../features/subscription";
import { getFreeEntitlements } from "../services/subscriptionService";
import { PartnerInvitePanel } from "../components/PartnerInvitePanel";
import { setPairSharingEnabled } from "../services/pairSharingService";
import { consumeOpenPartnerInviteOnRings } from "@/lib/partner-invite-ui";

export function RingsPage({
  locale = "en",
  userEntitlements = getFreeEntitlements(),
  onOpenRingSetup,
  onOpenHelp,
}) {
  const t = RINGS_PAGE_CONTENT[locale] || RINGS_PAGE_CONTENT.en;
  const [localRings, setLocalRings] = useState(() => getBoundRings());
  const [cloudRings, setCloudRings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [havens, setHavens] = useState([]);
  const [serverPairActive, setServerPairActive] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);

  const rings = useMemo(() => {
    const local = localRings || [];
    const cloud = cloudRings || [];
    const partnerLabel = t.partnerRingLabel || "Partner's ring";
    const yourLabel = t.yourRingLabel || "Your ring";

    // Logged-in: server list is authoritative once loaded (even when empty).
    if (!loading && !syncError) {
      if (cloud.length === 0) {
        return [];
      }
      const rows = cloud.map((c) => {
        const localMatch = local.find((ring) => ring.cloudRingId === c.id);
        const ownedByYou = Boolean(c.ownedByYou);
        const defaultLabel = ownedByYou ? yourLabel : partnerLabel;
        return {
          uidKey: localMatch?.uidKey || c.nfc_uid_hash || c.id,
          cloudRingId: c.id,
          havenId: c.haven_id || null,
          cloudBoundAt: c.bound_at || null,
          cloudLastUsedAt: c.last_used_at || null,
          nickname: c.nickname || localMatch?.label || defaultLabel,
          label: c.nickname || localMatch?.label || defaultLabel,
          colorKey: ownedByYou ? localMatch?.colorKey || "gold" : "rose",
          icon: localMatch?.icon || "ring",
          ownedByYou,
          createdAt: localMatch?.createdAt || null,
        };
      });
      return rows.sort((a, b) => {
        const da = Date.parse(a.cloudBoundAt || "") || a.createdAt || 0;
        const db = Date.parse(b.cloudBoundAt || "") || b.createdAt || 0;
        return db - da;
      });
    }

    if (cloud.length > 0) {
      const rows = cloud.map((c) => {
        const localMatch = local.find((ring) => ring.cloudRingId === c.id);
        const ownedByYou = Boolean(c.ownedByYou);
        const defaultLabel = ownedByYou ? yourLabel : partnerLabel;
        return {
          uidKey: localMatch?.uidKey || c.nfc_uid_hash || c.id,
          cloudRingId: c.id,
          havenId: c.haven_id || null,
          cloudBoundAt: c.bound_at || null,
          cloudLastUsedAt: c.last_used_at || null,
          nickname: c.nickname || localMatch?.label || defaultLabel,
          label: c.nickname || localMatch?.label || defaultLabel,
          colorKey: ownedByYou ? localMatch?.colorKey || "gold" : "rose",
          icon: localMatch?.icon || "ring",
          ownedByYou,
          createdAt: localMatch?.createdAt || null,
        };
      });
      return rows.sort((a, b) => {
        const da = Date.parse(a.cloudBoundAt || "") || a.createdAt || 0;
        const db = Date.parse(b.cloudBoundAt || "") || b.createdAt || 0;
        return db - da;
      });
    }

    return local.map((ring) => ({
      ...ring,
      ownedByYou: ring.ownedByYou !== false,
      nickname: ring.nickname || ring.label,
    }));
  }, [localRings, cloudRings, loading, syncError, t.partnerRingLabel, t.yourRingLabel]);

  function colorHex(key) {
    return RING_COLOR_OPTIONS.find((c) => c.key === key)?.hex ?? sanctuaryTheme.accent;
  }

  async function loadCloudRings(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setSyncError("");
    try {
      const sb = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.access_token) {
        setCloudRings([]);
        setHavens([]);
        setServerPairActive(false);
        return;
      }

      const listRes = await fetch("/api/nfc/list", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const listPayload = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        throw new Error(listPayload.error || "list_failed");
      }
      const cloudRows = Array.isArray(listPayload.rings) ? listPayload.rings : [];
      pruneStaleLocalRingsFromCloud(cloudRows);
      setCloudRings(cloudRows);
      setHavens(Array.isArray(listPayload.havens) ? listPayload.havens : []);
      setServerPairActive(Boolean(listPayload.pairActive));

      const localNow = getBoundRings();
      for (const ring of localNow) {
        if (!ring?.cloudRingId) continue;
        const match = cloudRows.find((row) => row.id === ring.cloudRingId);
        if (!match) continue;
        updateRingCloudMetadata(ring.uidKey, {
          cloudRingId: match.id,
          havenId: match.haven_id || null,
          cloudBoundAt: match.bound_at || null,
          cloudLastUsedAt: match.last_used_at || null,
        });
      }
      setLocalRings(getBoundRings());
    } catch (error) {
      setCloudRings([]);
      const msg = error instanceof Error ? error.message : "";
      setSyncError(msg || "list_failed");
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (consumeOpenPartnerInviteOnRings()) {
      setInvitePanelOpen(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCloudRings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (serverPairActive) {
      setPairSharingEnabled(true);
    }
  }, [serverPairActive]);

  function handleRenameRing(ring) {
    const current = String(ring?.nickname || ring?.label || "").trim();
    const next = window.prompt(t.renamePrompt || "Rename this ring", current);
    if (!next || !next.trim() || next.trim() === current) return;
    updateRingCloudMetadata(ring.uidKey, {
      nickname: next.trim(),
    });
    setLocalRings(getBoundRings());
  }

  function openInvitePanel() {
    setInvitePanelOpen(true);
  }

  function closeInvitePanel() {
    setInvitePanelOpen(false);
    void loadCloudRings();
  }

  const inviteHavenId =
    rings.find((ring) => ring.havenId)?.havenId || havens[0]?.haven_id || "";

  const ringLimitReached = !canUseFeature(userEntitlements, "expand_ring_slots", {
    currentRingCount: cloudRings.length > 0 ? cloudRings.length : rings.length,
  });
  const ownedCloudRingCount = rings.filter((ring) => ring.cloudRingId && ring.ownedByYou).length;
  const canLinkPartner = ownedCloudRingCount === 1 && !serverPairActive && !ringLimitReached;
  const pairActive = serverPairActive;
  const needsAutoRefresh =
    !loading && !pairActive && (cloudRings.length >= 2 || (syncError && localRings.length >= 2));

  useEffect(() => {
    if (!needsAutoRefresh) return undefined;
    const id = window.setInterval(() => {
      void loadCloudRings({ silent: true });
    }, 6000);
    return () => window.clearInterval(id);
  }, [needsAutoRefresh]);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerTitleBlock}>
            <h1 style={styles.title}>{t.title}</h1>
          </div>
          {rings.length === 0 && !loading ? (
            <button
              type="button"
              onClick={onOpenRingSetup}
              style={styles.headerAddBtn}
              disabled={ringLimitReached}
            >
              {t.bindFirstRingCta}
            </button>
          ) : null}
        </header>

        {loading ? <p style={styles.note}>{t.syncLoading}</p> : null}
        {refreshing ? <p style={styles.note}>{t.syncingRings}</p> : null}

        {!loading && pairActive ? (
          <div style={styles.partnerStatusLinked} role="status">
            {t.linkedWithPartnerStatus}
          </div>
        ) : null}

        {!loading && canLinkPartner ? (
          <button type="button" style={styles.linkPartnerBtn} onClick={openInvitePanel}>
            {t.linkWithPartnerCta}
          </button>
        ) : null}

        {syncError ? (
          <p style={styles.note}>
            {t.syncFailed}{" "}
            <button type="button" style={styles.inlineLink} onClick={() => void loadCloudRings()}>
              {t.retrySync}
            </button>
          </p>
        ) : null}

        {rings.length === 0 && !loading ? (
          <article style={styles.emptyCard}>
            <p style={styles.emptyBody}>{t.emptyBody}</p>
          </article>
        ) : (
          <ul style={styles.grid}>
            {rings.map((ring) => (
              <li
                key={ring.uidKey}
                style={{
                  ...styles.ringCard,
                  borderColor: `${colorHex(ring.colorKey)}55`,
                }}
              >
                <div
                  style={{
                    ...styles.iconBubble,
                    background: `${colorHex(ring.colorKey)}28`,
                  }}
                  aria-hidden
                >
                  <span style={styles.iconEmoji}>{ring.icon || "💍"}</span>
                </div>
                <div style={styles.ringText}>
                  <p style={styles.ringName}>{ring.nickname || ring.label}</p>
                  <p style={styles.ringMeta}>
                    {ring.ownedByYou ? t.yourRingLabel : t.partnerRingLabel}
                  </p>
                </div>
                {ring.cloudRingId && ring.ownedByYou ? (
                  <button
                    type="button"
                    style={styles.renameBtn}
                    onClick={() => handleRenameRing(ring)}
                  >
                    {t.rename}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {onOpenHelp ? (
          <button type="button" onClick={() => onOpenHelp?.()} style={styles.ghostBtn}>
            {t.ringsFooterHelpCta}
          </button>
        ) : null}
      </section>

      {invitePanelOpen ? (
        <PartnerInvitePanel
          localeContent={t}
          havenId={inviteHavenId}
          onClose={closeInvitePanel}
          onPartnerJoined={() => void loadCloudRings()}
          onRefreshRings={() => void loadCloudRings()}
        />
      ) : null}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "min-content",
    padding: APP_PAGE_PADDING,
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerTitleBlock: {
    minWidth: 0,
    flex: 1,
  },
  headerAddBtn: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  },
  linkPartnerBtn: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "16px 20px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 17,
    minHeight: 52,
    width: "100%",
    WebkitTapHighlightColor: "transparent",
  },
  partnerStatusLinked: {
    padding: "14px 18px",
    borderRadius: 14,
    border: "1px solid rgba(120, 200, 160, 0.45)",
    background: "rgba(28, 48, 36, 0.45)",
    color: "#b7f7c8",
    fontSize: 16,
    fontWeight: 650,
    textAlign: "center",
  },
  renameBtn: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 4,
  },
  inlineLink: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  brand: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: sanctuaryTheme.accentSoft,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 28,
    fontWeight: 500,
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 15,
    lineHeight: 1.5,
    color: "rgba(248, 239, 231, 0.72)",
    maxWidth: 520,
  },
  meta: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.06em",
    color: sanctuaryTheme.inkSoft,
  },
  privacyNote: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(232, 220, 208, 0.55)",
    maxWidth: 520,
  },
  note: {
    margin: 0,
    fontSize: 12,
    color: sanctuaryTheme.inkSoft,
  },
  guideCard: {
    border: "1px solid rgba(232, 220, 208, 0.16)",
    borderRadius: 14,
    background: "rgba(26, 21, 18, 0.44)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  guideTitle: {
    margin: 0,
    fontSize: 16,
    color: sanctuaryTheme.cream,
    fontWeight: 650,
  },
  guideBody: {
    margin: 0,
    fontSize: 13,
    color: sanctuaryTheme.inkSoft,
    lineHeight: 1.55,
  },
  guideBullet: {
    margin: 0,
    fontSize: 12,
    color: sanctuaryTheme.inkSoft,
    lineHeight: 1.5,
  },
  guideOneLine: {
    margin: 0,
    fontSize: 12,
    color: sanctuaryTheme.accentSoft,
    lineHeight: 1.5,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 560,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: sanctuaryTheme.accentSoft,
    borderBottom: "1px solid rgba(232, 220, 208, 0.22)",
    padding: "8px 10px",
  },
  td: {
    fontSize: 12,
    color: sanctuaryTheme.inkSoft,
    borderBottom: "1px solid rgba(232, 220, 208, 0.12)",
    padding: "8px 10px",
    lineHeight: 1.4,
    verticalAlign: "top",
  },
  howToggleRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  coreLineStandalone: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(232, 220, 208, 0.78)",
  },
  legacyCard: {
    border: "1px dashed rgba(232, 220, 208, 0.18)",
    borderRadius: 14,
    background: "rgba(26, 21, 18, 0.22)",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  legacyTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 650,
    color: "rgba(232, 220, 208, 0.72)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  pairToggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "rgba(232, 220, 208, 0.88)",
    cursor: "pointer",
  },
  legacyBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(217, 195, 179, 0.78)",
  },
  footerEdu: {
    marginTop: 4,
    border: "1px solid rgba(232, 220, 208, 0.12)",
    borderRadius: 14,
    background: "rgba(26, 21, 18, 0.35)",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  footerEduTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 650,
    color: sanctuaryTheme.cream,
  },
  footerEduBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: sanctuaryTheme.inkSoft,
  },
  footerLinkRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  emptyTrial: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(196, 149, 106, 0.95)",
  },
  ringStatusLine: {
    margin: "6px 0 0",
  },
  ringStatusPill: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 650,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#c7e9ce",
    border: "1px solid rgba(140, 200, 160, 0.45)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  errorRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  error: {
    margin: 0,
    fontSize: 12,
    color: "#ffb8a3",
  },
  grid: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 12,
  },
  ringCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: sanctuaryTheme.radiusLg,
    border: "1px solid rgba(232, 220, 208, 0.14)",
    background: "rgba(44, 36, 31, 0.38)",
    backdropFilter: "blur(8px)",
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 26,
    lineHeight: 1,
  },
  ringText: {
    flex: 1,
    minWidth: 0,
  },
  ringName: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: sanctuaryTheme.cream,
  },
  ringMeta: {
    margin: "4px 0 0",
    fontSize: 13,
    color: sanctuaryTheme.inkSoft,
  },
  ringActions: {
    display: "grid",
    gap: 6,
    justifyItems: "end",
  },
  revokeBtn: {
    border: "1px solid rgba(201, 123, 132, 0.55)",
    background: "transparent",
    color: "#ffd4c9",
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  emptyCard: {
    borderRadius: sanctuaryTheme.radiusLg,
    border: "1px dashed rgba(196, 149, 106, 0.35)",
    padding: 24,
    textAlign: "center",
    display: "grid",
    gap: 12,
    background: "rgba(26, 21, 18, 0.4)",
    justifyItems: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
  },
  emptyBody: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.78)",
  },
  primaryBtn: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "12px 20px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
    justifySelf: "center",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  secondaryBtn: {
    border: "1px solid rgba(196, 149, 106, 0.45)",
    background: "transparent",
    color: sanctuaryTheme.creamMuted,
    borderRadius: sanctuaryTheme.radiusPill,
    padding: "10px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  ghostBtn: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.inkSoft,
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
    padding: "10px 8px",
  },
  verifyBox: {
    marginTop: 8,
    border: "1px solid rgba(201, 123, 132, 0.35)",
    borderRadius: 14,
    background: "rgba(44, 30, 29, 0.42)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  verifyTitle: {
    margin: 0,
    fontSize: 15,
    color: "#ffe3dd",
    fontWeight: 600,
  },
  verifyHint: {
    margin: 0,
    fontSize: 13,
    color: "rgba(255, 226, 217, 0.82)",
    lineHeight: 1.45,
  },
  verifyWarn: {
    margin: 0,
    fontSize: 12,
    color: "rgba(255, 210, 201, 0.88)",
    lineHeight: 1.45,
  },
  input: {
    border: "1px solid rgba(201, 123, 132, 0.4)",
    borderRadius: 10,
    background: "rgba(18, 13, 13, 0.45)",
    color: sanctuaryTheme.cream,
    padding: "10px 12px",
  },
};
