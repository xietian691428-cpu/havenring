import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestStoragePersistenceFromUserGesture } from "../../lib/requestStoragePersistence";
import { verifyAndTrustCurrentDevice } from "../services/deviceTrustService";
import { getMemoryDetailUiCopy } from "../content/memoryDetailPageContent";
import { usePlatformTarget } from "../hooks/usePlatformTarget";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

function isVideoMime(mime) {
  return String(mime || "")
    .toLowerCase()
    .startsWith("video/");
}

function isSealedMemory(memory) {
  return Boolean(memory?.is_sealed || memory?.ring_id);
}

function formatLongDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Short stable reference derived from memory id (support / debugging). */
function shortReferenceId(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function formatStoryRichText(text) {
  const raw = String(text || "");
  const lines = raw.split("\n");
  return lines.map((line, idx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const nodes = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${idx}-${j}`} style={{ fontWeight: 650 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${idx}-${j}`}>{part}</span>;
    });
    return (
      <p key={idx} style={{ margin: "0 0 0.75em", lineHeight: 1.75 }}>
        {nodes.length ? nodes : "\u00a0"}
      </p>
    );
  });
}

/**
 * Memory detail — sealed-memory viewing, metadata, and protected actions.
 * Copy: `havenCopy` → `getMemoryDetailPageCopy` / `getMemoryDetailUiCopy`.
 */
export function MemoryDetailPage({
  memory,
  loading = false,
  error = "",
  onBack,
  onEdit,
  onDeleteMemory,
  locale = "en",
}) {
  const platform = usePlatformTarget();
  const t = useMemo(() => getMemoryDetailUiCopy(locale, platform), [locale, platform]);
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyRecovery, setVerifyRecovery] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [toast, setToast] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exportMemoryFormat, setExportMemoryFormat] = useState("full");
  const menuRef = useRef(null);

  const photos = useMemo(() => {
    if (!memory?.photo) return [];
    if (Array.isArray(memory.photo)) return memory.photo;
    return [memory.photo];
  }, [memory]);

  const attachments = useMemo(() => {
    const fromMemory = Array.isArray(memory?.attachments) ? memory.attachments : [];
    if (fromMemory.length) return fromMemory;
    if (memory?.voice) {
      return [
        {
          id: "legacy-voice",
          name: "voice-note.webm",
          mimeType: "audio/webm",
          dataUrl: memory.voice,
          size: 0,
        },
      ];
    }
    return [];
  }, [memory]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const currentPhoto = photos[index]?.dataUrl || photos[index] || "";
  const releaseAt = Number(memory?.releaseAt || 0) || 0;
  const isCapsuleLocked = releaseAt > now;
  const sealed = memory && !isCapsuleLocked ? isSealedMemory(memory) : false;

  const sealTs = memory
    ? Number(memory.timelineAt || memory.updatedAt || memory.createdAt || 0) || 0
    : 0;
  const sealDateLong = sealTs ? formatLongDate(sealTs) : "—";

  const centerLabel = useMemo(() => {
    if (!memory) return t.centerFallbackTitle;
    const short = String(memory.title || "").trim();
    if (short.length > 28) return `${short.slice(0, 26)}…`;
    if (short) return short;
    try {
      return new Date(memory.timelineAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return t.centerFallbackTitle;
    }
  }, [memory, t.centerFallbackTitle]);

  const sealedOnLine = useMemo(() => {
    if (!memory || isCapsuleLocked || !sealed) return "";
    return t.sealedOn.replace("{date}", sealDateLong);
  }, [memory, isCapsuleLocked, sealed, sealDateLong, t]);

  const sealSecondaryLine = useMemo(() => {
    if (!memory || isCapsuleLocked || !sealed) return "";
    if (memory.ring_id) return t.sealPlacementHint;
    if (memory.is_sealed) return t.sealedSecurely;
    return "";
  }, [memory, isCapsuleLocked, sealed, t]);

  const metaSealedValue = useMemo(() => {
    if (!memory || !sealed) return "";
    const d = sealDateLong;
    if (memory.ring_id) return t.metaSealedViaRing.replace("{date}", d);
    return t.metaSealedOther.replace("{date}", d);
  }, [memory, sealed, sealDateLong, t]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDocClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  function nextPhoto() {
    if (!photos.length) return;
    setIndex((prev) => (prev + 1) % photos.length);
  }

  function prevPhoto() {
    if (!photos.length) return;
    setIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }

  const openVerify = useCallback((action) => {
    setPendingAction(action);
    setVerifyPassword("");
    setVerifyRecovery("");
    setVerifyError("");
    setVerifyOpen(true);
    setMenuOpen(false);
  }, []);

  async function handleVerifySubmit() {
    setVerifyBusy(true);
    setVerifyError("");
    try {
      await verifyAndTrustCurrentDevice({
        password: verifyPassword,
        recoveryCode: verifyRecovery,
      });
      const action = pendingAction;
      setVerifyOpen(false);
      setPendingAction("");
      setVerifyPassword("");
      setVerifyRecovery("");
      if (action === "edit") {
        onEdit?.();
      } else if (action === "delete") {
        await onDeleteMemory?.(memory?.id);
      } else if (action === "export") {
        setToast(t.exportPreparing);
        let payload = memory;
        if (exportMemoryFormat === "lite" && memory) {
          payload = {
            ...memory,
            photo: null,
            voice: null,
            attachments: [],
          };
        }
        const blob = new Blob(
          [
            JSON.stringify(
              {
                exportedAt: Date.now(),
                type: "haven-memory-export-v1",
                format: exportMemoryFormat,
                memory: payload,
              },
              null,
              2
            ),
          ],
          { type: "application/json" }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `haven-memory-${exportMemoryFormat}-${memory?.id || "export"}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        requestStoragePersistenceFromUserGesture();
        setToast(t.exportSuccess);
      }
    } catch {
      setVerifyError(t.verifyActionFailed);
    } finally {
      setVerifyBusy(false);
    }
  }

  function handleTitleEditTap() {
    if (isCapsuleLocked) return;
    handleEditRequest();
  }

  function handleEditRequest() {
    openVerify("edit");
  }

  function handleDeleteMenuClick() {
    setDeleteDialogOpen(true);
    setMenuOpen(false);
  }

  function handleDeleteConfirmed() {
    setDeleteDialogOpen(false);
    openVerify("delete");
  }

  function handleExportMenuClick() {
    setExportPickerOpen(true);
    setMenuOpen(false);
  }

  function handleExportFormatContinue() {
    setExportPickerOpen(false);
    openVerify("export");
  }

  const shellGlow = sealed && !isCapsuleLocked ? styles.shellSealed : styles.shell;

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={shellGlow}>
        <nav style={styles.topBar} aria-label="Memory">
          <button type="button" onClick={onBack} style={styles.topBack} aria-label={t.topBackLabel}>
            ←
          </button>
          <p style={styles.topCenter} aria-live="polite">
            {centerLabel}
          </p>
          <div style={styles.menuWrap} ref={menuRef}>
            {!isCapsuleLocked && memory ? (
              <>
                <button
                  type="button"
                  style={styles.menuBtn}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label={t.menuOpenAria}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div style={styles.menuDropdown} role="menu">
                    <button type="button" role="menuitem" style={styles.menuItem} onClick={handleEditRequest}>
                      {t.menuEdit}
                    </button>
                    <button type="button" role="menuitem" style={styles.menuItem} onClick={handleExportMenuClick}>
                      {t.menuExport}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      style={{ ...styles.menuItem, opacity: 0.55, cursor: "not-allowed" }}
                      disabled
                      aria-disabled="true"
                    >
                      {t.menuShareLink}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      style={{ ...styles.menuItem, color: "#ffb8a3" }}
                      onClick={handleDeleteMenuClick}
                    >
                      {t.menuDelete}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <span style={styles.menuSpacer} aria-hidden />
            )}
          </div>
        </nav>

        {toast ? (
          <p style={styles.toast} role="status">
            {toast}
          </p>
        ) : null}

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {!loading && !error && !memory ? <p style={styles.error}>{t.noMemory}</p> : null}

        {!loading && memory ? (
          <>
            <header style={styles.hero}>
              <div style={styles.heroTitleRow}>
                {isCapsuleLocked ? (
                  <h1 style={styles.heroTitleStatic}>{memory.title || t.defaultTitle}</h1>
                ) : (
                  <button
                    type="button"
                    style={styles.heroTitleBtn}
                    onClick={handleTitleEditTap}
                    aria-label={t.menuEdit}
                  >
                    {memory.title || t.defaultTitle}
                  </button>
                )}
                {!isCapsuleLocked && sealed ? (
                  <span style={styles.sealBadge} aria-label={t.sealBadge}>
                    {t.sealBadge}
                  </span>
                ) : (
                  <span style={styles.typeBadge}>
                    {releaseAt ? t.capsuleTypeTime : t.capsuleTypeNormal}
                  </span>
                )}
              </div>
              {!isCapsuleLocked && sealedOnLine ? <p style={styles.sealLine}>{sealedOnLine}</p> : null}
              {!isCapsuleLocked && sealSecondaryLine ? <p style={styles.sealHint}>{sealSecondaryLine}</p> : null}
              <p style={styles.readOnlyHint}>{t.readOnlyBanner}</p>
            </header>

            {isCapsuleLocked ? (
              <section style={styles.card}>
                <p style={styles.empty}>
                  {t.capsuleLockedBody.replace("{time}", new Date(releaseAt).toLocaleString())}
                </p>
              </section>
            ) : null}

            {!isCapsuleLocked ? (
              <>
                {photos.length ? (
                  <section style={styles.card} aria-labelledby="haven-detail-photos">
                    <h2 id="haven-detail-photos" style={styles.sectionTitle}>
                      {t.photosHeading}
                    </h2>
                    <div style={styles.carousel}>
                      <img src={currentPhoto} alt="" style={styles.photo} />
                      {photos.length > 1 ? (
                        <>
                          <div style={styles.thumbStrip} role="tablist" aria-label={t.photosHeading}>
                            {photos.map((p, i) => {
                              const url = p?.dataUrl || p || "";
                              return (
                                <button
                                  key={url ? `${i}-${String(url).slice(0, 24)}` : i}
                                  type="button"
                                  role="tab"
                                  aria-selected={i === index}
                                  onClick={() => setIndex(i)}
                                  style={{
                                    ...styles.thumbBtn,
                                    outline: i === index ? `2px solid ${sanctuaryTheme.accent}` : "none",
                                  }}
                                >
                                  <img src={url} alt="" style={styles.thumbImg} />
                                </button>
                              );
                            })}
                          </div>
                          <div style={styles.carouselActions}>
                            <button type="button" onClick={prevPhoto} style={styles.carouselButton}>
                              {t.previous}
                            </button>
                            <span style={styles.carouselCount}>
                              {index + 1} / {photos.length}
                            </span>
                            <button type="button" onClick={nextPhoto} style={styles.carouselButton}>
                              {t.next}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <section style={styles.card} aria-labelledby="haven-detail-story">
                  <h2 id="haven-detail-story" style={styles.sectionTitle}>
                    {t.storyHeading}
                  </h2>
                  <div style={styles.storyBody}>
                    {memory.story?.trim() ? formatStoryRichText(memory.story) : <p style={styles.empty}>{t.noStory}</p>}
                  </div>
                </section>

                <section style={styles.card} aria-labelledby="haven-detail-media">
                  <h2 id="haven-detail-media" style={styles.sectionTitle}>
                    {t.mediaHeading}
                  </h2>
                  {attachments.length ? (
                    <ul style={styles.attachmentList}>
                      {attachments.map((item) => (
                        <li key={item.id || item.name} style={styles.attachmentItem}>
                          <p style={styles.attachmentName}>{item.name || t.untitledAttachment}</p>
                          {String(item.mimeType || "").startsWith("audio/") ? (
                            <audio controls src={item.dataUrl} style={{ width: "100%" }} />
                          ) : null}
                          {isVideoMime(item.mimeType) ? (
                            <video controls src={item.dataUrl} style={{ width: "100%", borderRadius: 10 }} />
                          ) : null}
                          {!String(item.mimeType || "").startsWith("audio/") && !isVideoMime(item.mimeType) ? (
                            <a href={item.dataUrl} download={item.name || "attachment"} style={styles.downloadLink}>
                              {t.downloadAttachment}
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : photos.length ? null : (
                    <p style={styles.empty}>{t.noAttachments}</p>
                  )}
                </section>

                <section style={styles.card}>
                  <button type="button" onClick={() => setMetaOpen((o) => !o)} style={styles.metaToggle}>
                    {metaOpen ? t.metaToggleHide : t.metaToggleShow} — {t.metaHeading}
                  </button>
                  {metaOpen ? (
                    <dl style={styles.metaGrid}>
                      <dt style={styles.metaDt}>{t.metaCreated}</dt>
                      <dd style={styles.metaDd}>
                        {memory.createdAt
                          ? new Date(memory.createdAt).toLocaleString()
                          : "—"}
                      </dd>
                      <dt style={styles.metaDt}>{t.metaUpdated}</dt>
                      <dd style={styles.metaDd}>{new Date(memory.updatedAt).toLocaleString()}</dd>
                      {sealed ? (
                        <>
                          <dt style={styles.metaDt}>{t.metaSealed}</dt>
                          <dd style={styles.metaDd}>{metaSealedValue}</dd>
                        </>
                      ) : null}
                      <dt style={styles.metaDt}>{t.metaReferenceId}</dt>
                      <dd style={styles.metaDdMono}>{shortReferenceId(memory.id)}</dd>
                    </dl>
                  ) : null}
                </section>
              </>
            ) : null}
          </>
        ) : null}

        {!loading && memory && !isCapsuleLocked && sealed ? (
          <footer style={styles.securityBar}>
            <p style={styles.securityLine}>{t.e2eeFooter}</p>
            <p style={styles.securitySub}>{t.footerDeleteHint}</p>
          </footer>
        ) : null}
      </section>

      {deleteDialogOpen ? (
        <div style={styles.verifyOverlay} role="dialog" aria-modal="true" aria-labelledby="haven-del-title">
          <div style={styles.verifyCard}>
            <p id="haven-del-title" style={styles.verifyTitle}>
              {t.deleteConfirmTitle}
            </p>
            <p style={styles.verifyBody}>{t.deleteConfirmBody}</p>
            <div style={styles.verifyActions}>
              <button type="button" onClick={handleDeleteConfirmed} style={styles.dangerSolidBtn}>
                {t.deleteConfirmConfirm}
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                style={styles.ghostBtn}
              >
                {t.deleteConfirmCancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportPickerOpen ? (
        <div style={styles.verifyOverlay} role="dialog" aria-modal="true" aria-labelledby="haven-exp-title">
          <div style={styles.verifyCard}>
            <p id="haven-exp-title" style={styles.verifyTitle}>
              {t.exportChooseFormatTitle}
            </p>
            <label style={styles.radioRow}>
              <input
                type="radio"
                name="memExportFmt"
                checked={exportMemoryFormat === "full"}
                onChange={() => setExportMemoryFormat("full")}
              />
              <span style={styles.verifyBody}>{t.exportFormatJsonFull}</span>
            </label>
            <label style={styles.radioRow}>
              <input
                type="radio"
                name="memExportFmt"
                checked={exportMemoryFormat === "lite"}
                onChange={() => setExportMemoryFormat("lite")}
              />
              <span style={styles.verifyBody}>{t.exportFormatJsonLite}</span>
            </label>
            <div style={styles.verifyActions}>
              <button type="button" onClick={handleExportFormatContinue} style={styles.primaryBtn}>
                {t.exportContinueToVerify}
              </button>
              <button type="button" onClick={() => setExportPickerOpen(false)} style={styles.ghostBtn}>
                {t.verifyActionCancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {verifyOpen ? (
        <div style={styles.verifyOverlay} role="dialog" aria-modal="true" aria-labelledby="haven-verify-title">
          <div style={styles.verifyCard}>
            <p id="haven-verify-title" style={styles.verifyTitle}>
              {pendingAction === "edit"
                ? t.editRequiresVerifyTitle
                : pendingAction === "export"
                  ? t.verifyModalTitle
                  : t.verifyModalTitle}
            </p>
            <p style={styles.verifyBody}>
              {pendingAction === "edit"
                ? t.editRequiresVerifyBody
                : pendingAction === "export"
                  ? t.verifyModalBody
                  : t.verifyModalBody}
            </p>
            <input
              type="password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              placeholder={t.verifyPasswordPlaceholder}
              style={styles.input}
              autoComplete="current-password"
            />
            <input
              type="text"
              value={verifyRecovery}
              onChange={(e) => setVerifyRecovery(e.target.value)}
              placeholder={t.verifyRecoveryPlaceholder}
              style={styles.input}
            />
            {verifyError ? <p style={styles.error}>{verifyError}</p> : null}
            <div style={styles.verifyActions}>
              <button
                type="button"
                disabled={verifyBusy}
                onClick={() => void handleVerifySubmit()}
                style={styles.primaryBtn}
              >
                {pendingAction === "edit" ? t.editContinue : t.verifyActionConfirm}
              </button>
              <button
                type="button"
                disabled={verifyBusy}
                onClick={() => {
                  setVerifyOpen(false);
                  setPendingAction("");
                  setVerifyError("");
                }}
                style={styles.ghostBtn}
              >
                {t.verifyActionCancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding:
      "8px 16px calc(96px + env(safe-area-inset-bottom, 0px))",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
    fontSize: "clamp(15px, 2.8vw, 17px)",
  },
  shell: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 14,
    borderRadius: 20,
    padding: "4px 0 0",
  },
  shellSealed: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 14,
    borderRadius: 20,
    padding: "4px 0 0",
    boxShadow:
      "0 0 0 1px rgba(200, 170, 255, 0.22), 0 0 40px rgba(120, 80, 180, 0.12)",
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    alignItems: "center",
    gap: 8,
    padding: "4px 0 8px",
  },
  topBack: {
    border: "1px solid rgba(232, 220, 208, 0.18)",
    background: "rgba(18, 14, 12, 0.45)",
    color: sanctuaryTheme.cream,
    borderRadius: 12,
    width: 44,
    height: 44,
    cursor: "pointer",
    fontSize: 20,
    lineHeight: 1,
  },
  topCenter: {
    margin: 0,
    textAlign: "center",
    fontSize: 15,
    fontWeight: 600,
    color: "rgba(248, 239, 231, 0.88)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  menuWrap: {
    position: "relative",
    justifySelf: "end",
  },
  menuSpacer: {
    width: 44,
    height: 44,
    display: "inline-block",
  },
  menuBtn: {
    border: "1px solid rgba(232, 220, 208, 0.18)",
    background: "rgba(18, 14, 12, 0.45)",
    color: sanctuaryTheme.cream,
    borderRadius: 12,
    width: 44,
    height: 44,
    cursor: "pointer",
    fontSize: 22,
    lineHeight: 1,
  },
  menuDropdown: {
    position: "absolute",
    right: 0,
    top: 48,
    minWidth: 220,
    borderRadius: 12,
    border: "1px solid rgba(232, 220, 208, 0.14)",
    background: "rgba(22, 18, 16, 0.96)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    padding: 6,
    zIndex: 20,
    display: "grid",
    gap: 2,
  },
  menuItem: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.cream,
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  toast: {
    margin: 0,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(36, 48, 32, 0.85)",
    border: "1px solid rgba(160, 200, 140, 0.35)",
    color: "rgba(230, 245, 220, 0.95)",
    fontSize: 14,
  },
  hero: {
    display: "grid",
    gap: 8,
    padding: "4px 2px 8px",
  },
  heroTitleRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 10,
  },
  heroTitleBtn: {
    margin: 0,
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: 650,
    lineHeight: 1.2,
    flex: "1 1 220px",
    textAlign: "left",
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.cream,
    cursor: "pointer",
    padding: 0,
  },
  heroTitleStatic: {
    margin: 0,
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: 650,
    lineHeight: 1.2,
    flex: "1 1 220px",
    color: sanctuaryTheme.cream,
  },
  sealBadge: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#f4e8ff",
    border: "1px solid rgba(210, 180, 255, 0.45)",
    borderRadius: 999,
    padding: "5px 10px",
    background: "linear-gradient(180deg, rgba(80, 50, 120, 0.35), rgba(40, 28, 60, 0.5))",
  },
  typeBadge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid rgba(196, 149, 106, 0.35)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    color: sanctuaryTheme.accentSoft,
    background: "rgba(240, 194, 158, 0.08)",
  },
  sealLine: {
    margin: 0,
    fontSize: 15,
    color: "rgba(232, 212, 255, 0.95)",
    fontWeight: 600,
  },
  sealHint: {
    margin: 0,
    fontSize: 13,
    color: "rgba(248, 239, 231, 0.62)",
    lineHeight: 1.5,
  },
  readOnlyHint: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "rgba(248, 239, 231, 0.5)",
    lineHeight: 1.45,
  },
  card: {
    border: "1px solid rgba(232, 220, 208, 0.1)",
    borderRadius: 16,
    background: "rgba(26, 21, 18, 0.42)",
    padding: 16,
    display: "grid",
    gap: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 650,
  },
  storyBody: {
    color: "rgba(248, 239, 231, 0.92)",
    fontSize: "clamp(15px, 2.6vw, 17px)",
  },
  carousel: {
    display: "grid",
    gap: 8,
  },
  photo: {
    width: "100%",
    maxHeight: 420,
    objectFit: "cover",
    borderRadius: 12,
    border: "1px solid rgba(232, 220, 208, 0.12)",
  },
  thumbStrip: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
    WebkitOverflowScrolling: "touch",
  },
  thumbBtn: {
    flex: "0 0 auto",
    border: "none",
    padding: 0,
    borderRadius: 8,
    cursor: "pointer",
    background: "rgba(0,0,0,0.2)",
  },
  thumbImg: {
    width: 56,
    height: 56,
    objectFit: "cover",
    borderRadius: 8,
    display: "block",
  },
  carouselActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  carouselButton: {
    border: "1px solid rgba(196, 149, 106, 0.4)",
    background: "transparent",
    color: sanctuaryTheme.cream,
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 13,
  },
  carouselCount: {
    color: "rgba(248, 239, 231, 0.55)",
    fontSize: 13,
  },
  empty: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.55)",
  },
  attachmentList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 10,
  },
  attachmentItem: {
    border: "1px solid rgba(232, 220, 208, 0.1)",
    borderRadius: 12,
    padding: 10,
    display: "grid",
    gap: 8,
  },
  attachmentName: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.65)",
    fontSize: 13,
  },
  downloadLink: {
    color: sanctuaryTheme.accentSoft,
    textDecoration: "underline",
    fontSize: 14,
  },
  feedback: {
    margin: 0,
    color: sanctuaryTheme.accentSoft,
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
  },
  metaToggle: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 14,
    fontWeight: 600,
    padding: 0,
    textDecoration: "underline",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: "6px 12px",
    margin: 0,
    fontSize: 13,
  },
  metaDt: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.5)",
    fontWeight: 600,
  },
  metaDd: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.85)",
  },
  metaDdMono: {
    margin: 0,
    color: "rgba(200, 190, 220, 0.9)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    wordBreak: "break-all",
  },
  securityBar: {
    position: "sticky",
    bottom: 0,
    marginTop: 8,
    padding: "14px 16px calc(14px + env(safe-area-inset-bottom, 0px))",
    borderRadius: 16,
    border: "1px solid rgba(120, 90, 160, 0.25)",
    background: "rgba(18, 14, 24, 0.75)",
    backdropFilter: "blur(10px)",
  },
  securityLine: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: "rgba(232, 218, 255, 0.95)",
  },
  securitySub: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(248, 239, 231, 0.62)",
  },
  verifyOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "grid",
    placeItems: "center",
    zIndex: 100,
    padding: 16,
  },
  verifyCard: {
    width: "min(400px, 100%)",
    borderRadius: 16,
    padding: 18,
    background: "rgba(26, 21, 18, 0.96)",
    border: "1px solid rgba(232, 220, 208, 0.14)",
    display: "grid",
    gap: 10,
  },
  verifyTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 650,
  },
  verifyBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.72)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid rgba(232, 220, 208, 0.14)",
    background: "rgba(18, 14, 12, 0.55)",
    color: sanctuaryTheme.cream,
    padding: "10px 12px",
    fontSize: 14,
  },
  verifyActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  dangerSolidBtn: {
    border: "1px solid rgba(255, 120, 100, 0.55)",
    background: "rgba(120, 40, 36, 0.65)",
    color: "#ffe8e4",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  ghostBtn: {
    border: "1px solid rgba(232, 220, 208, 0.2)",
    background: "transparent",
    color: sanctuaryTheme.cream,
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  radioRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    cursor: "pointer",
  },
};
