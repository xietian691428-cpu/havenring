import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RINGS_PAGE_CONTENT } from "../content/ringsPageContent";
import {
  getBoundRings,
  MAX_BOUND_RINGS,
  RING_COLOR_OPTIONS,
  removeBoundRingByCloudId,
  updateRingCloudMetadata,
} from "../services/ringRegistryService";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";
import { verifyAndTrustCurrentDevice } from "../services/deviceTrustService";

export function RingsPage({
  locale = "en",
  onOpenRingSetup,
  onOpenSettings,
}) {
  const t = RINGS_PAGE_CONTENT[locale] || RINGS_PAGE_CONTENT.en;
  const [localRings, setLocalRings] = useState(() => getBoundRings());
  const [cloudRings, setCloudRings] = useState([]);
  const [memoryCountByRingId, setMemoryCountByRingId] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [status, setStatus] = useState("");
  const [busyCloudRingId, setBusyCloudRingId] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyRecovery, setVerifyRecovery] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState(null);

  const rings = useMemo(() => {
    const local = localRings || [];
    const cloud = cloudRings || [];
    const byCloudId = new Map(cloud.map((row) => [row.id, row]));
    const rows = local.map((ring) => {
      const c = ring.cloudRingId ? byCloudId.get(ring.cloudRingId) : null;
      return {
        ...ring,
        cloudRingId: ring.cloudRingId || c?.id || null,
        cloudBoundAt: c?.bound_at || ring.cloudBoundAt || null,
        cloudLastUsedAt: c?.last_used_at || ring.cloudLastUsedAt || null,
        nickname: c?.nickname || ring.label,
      };
    });
    return rows.sort((a, b) => {
      const da = Date.parse(a.cloudBoundAt || "") || a.createdAt || 0;
      const db = Date.parse(b.cloudBoundAt || "") || b.createdAt || 0;
      return db - da;
    });
  }, [localRings, cloudRings]);

  function colorHex(key) {
    return RING_COLOR_OPTIONS.find((c) => c.key === key)?.hex ?? sanctuaryTheme.accent;
  }

  function fmtDate(ts) {
    if (!ts) return t.unknownDate;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return t.unknownDate;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  async function loadCloudRings() {
    setLoading(true);
    setSyncError("");
    try {
      const sb = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.access_token) {
        setSyncError(t.cloudSignInRequired);
        setCloudRings([]);
        setMemoryCountByRingId({});
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
      setCloudRings(cloudRows);

      const localNow = getBoundRings();
      for (const ring of localNow) {
        if (!ring?.cloudRingId) continue;
        const match = cloudRows.find((row) => row.id === ring.cloudRingId);
        if (!match) continue;
        updateRingCloudMetadata(ring.uidKey, {
          cloudRingId: match.id,
          cloudBoundAt: match.bound_at || null,
          cloudLastUsedAt: match.last_used_at || null,
        });
      }
      setLocalRings(getBoundRings());

      const cloudRingIds = cloudRows.map((row) => row.id).filter(Boolean);
      if (!cloudRingIds.length) {
        setMemoryCountByRingId({});
        return;
      }
      const { data: mRows, error: mErr } = await sb
        .from("moments")
        .select("id, ring_id")
        .in("ring_id", cloudRingIds);
      if (mErr) {
        setMemoryCountByRingId({});
        return;
      }
      const countMap = {};
      for (const row of mRows || []) {
        const key = row.ring_id;
        if (!key) continue;
        countMap[key] = (countMap[key] || 0) + 1;
      }
      setMemoryCountByRingId(countMap);
    } catch {
      setSyncError(t.syncFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCloudRings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function askRevoke(ring) {
    if (!ring?.cloudRingId) return;
    const confirmed = window.confirm(t.revokeWarning);
    if (!confirmed) return;
    setPendingRevoke(ring);
    setVerifyPassword("");
    setVerifyRecovery("");
    setVerifyError("");
    setVerifyOpen(true);
  }

  async function handleConfirmRevoke() {
    if (!pendingRevoke?.cloudRingId) return;
    setVerifyError("");
    try {
      await verifyAndTrustCurrentDevice({
        password: verifyPassword,
        recoveryCode: verifyRecovery,
      });

      const sb = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.access_token) {
        setVerifyError(t.cloudSignInRequired);
        return;
      }

      setBusyCloudRingId(pendingRevoke.cloudRingId);
      const res = await fetch("/api/nfc/revoke", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "X-Haven-Secondary-Verified": "1",
        },
        body: JSON.stringify({
          ring_id: pendingRevoke.cloudRingId,
          privacy_acknowledged: true,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyError(payload.error || t.revokeFailed);
        return;
      }

      removeBoundRingByCloudId(pendingRevoke.cloudRingId);
      setLocalRings(getBoundRings());
      setStatus(t.revokeDone);
      setVerifyOpen(false);
      setPendingRevoke(null);
      await loadCloudRings();
    } catch {
      setVerifyError(t.verifyError);
    } finally {
      setBusyCloudRingId("");
    }
  }

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{t.brand}</p>
            <h1 style={styles.title}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        <p style={styles.meta}>
          {rings.length}/{MAX_BOUND_RINGS} · {t.maxRings}
        </p>
        {rings.length >= MAX_BOUND_RINGS ? (
          <p style={styles.note}>{t.limitReachedHint}</p>
        ) : null}
        <p style={styles.privacyNote}>{t.privacyNote}</p>
        {loading ? <p style={styles.note}>{t.syncLoading}</p> : null}
        {syncError ? (
          <div style={styles.errorRow}>
            <p style={styles.error}>{syncError}</p>
            <button type="button" style={styles.secondaryBtn} onClick={() => void loadCloudRings()}>
              {t.retrySync}
            </button>
            {syncError === t.cloudSignInRequired ? (
              <button type="button" style={styles.ghostBtn} onClick={onOpenSettings}>
                {t.cloudSignInAction}
              </button>
            ) : null}
          </div>
        ) : null}
        {status ? <p style={styles.success}>{status}</p> : null}

        {rings.length === 0 ? (
          <article style={styles.emptyCard}>
            <p style={styles.emptyTitle}>{t.emptyTitle}</p>
            <p style={styles.emptyBody}>{t.emptyBody}</p>
            <button type="button" onClick={onOpenRingSetup} style={styles.primaryBtn}>
              {t.addRing}
            </button>
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
                    {t.boundAt}: {fmtDate(ring.cloudBoundAt || ring.createdAt)}
                  </p>
                  <p style={styles.ringMeta}>
                    {t.lastUsedAt}: {ring.cloudLastUsedAt ? fmtDate(ring.cloudLastUsedAt) : t.neverUsed}
                  </p>
                  <p style={styles.ringMeta}>
                    {t.linkedMemories}: {memoryCountByRingId[ring.cloudRingId] || 0}
                  </p>
                </div>
                {ring.cloudRingId ? (
                  <button
                    type="button"
                    style={styles.revokeBtn}
                    onClick={() => askRevoke(ring)}
                    disabled={busyCloudRingId === ring.cloudRingId}
                  >
                    {busyCloudRingId === ring.cloudRingId ? t.revoking : t.revoke}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div style={styles.actions}>
          <button type="button" onClick={onOpenRingSetup} style={styles.secondaryBtn}>
            {t.openSetup}
          </button>
          <button type="button" onClick={onOpenSettings} style={styles.ghostBtn}>
            {t.settingsLink}
          </button>
        </div>

        {verifyOpen ? (
          <section style={styles.verifyBox}>
            <p style={styles.verifyTitle}>{t.verifyTitle}</p>
            <p style={styles.verifyHint}>{t.verifyHint}</p>
            <p style={styles.verifyWarn}>{t.revokeWarning}</p>
            <input
              type="password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              placeholder={t.verifyPassword}
              style={styles.input}
              autoComplete="current-password"
            />
            <input
              type="text"
              value={verifyRecovery}
              onChange={(e) => setVerifyRecovery(e.target.value)}
              placeholder={t.verifyRecovery}
              style={styles.input}
            />
            {verifyError ? <p style={styles.error}>{verifyError}</p> : null}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => void handleConfirmRevoke()}
                style={styles.revokeBtn}
                disabled={Boolean(busyCloudRingId)}
              >
                {t.verifyConfirm}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerifyOpen(false);
                  setPendingRevoke(null);
                }}
                style={styles.secondaryBtn}
                disabled={Boolean(busyCloudRingId)}
              >
                {t.verifyCancel}
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "20px 20px calc(28px + env(safe-area-inset-bottom, 0px))",
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
  success: {
    margin: 0,
    fontSize: 12,
    color: "#c7e9ce",
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
