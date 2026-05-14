import { useEffect, useMemo, useRef, useState } from "react";
import { saveDraftItem } from "../services/draftBoxService";
import { SaveToHavenDialog } from "../components/SaveToHavenDialog";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { NEW_MEMORY_PAGE_CONTENT } from "../content/newMemoryPageContent";
import {
  isFirstMemoryCompleted,
  markFirstMemoryCompleted,
  trackFirstRunEvent,
} from "../services/firstRunTelemetryService";
import {
  clearSealPrepState,
  gateSealWithRingAccess,
  primeSealPrepAfterDraftPersisted,
} from "../features/seal";
import { getFreeEntitlements } from "../services/subscriptionService";
import { resolvePlatformTarget } from "../hooks/usePlatformTarget";

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 6;
const MAX_FILE_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const DRAFT_STORAGE_KEY = "haven.new_memory_draft";

function isVideoMime(mime) {
  return String(mime || "")
    .toLowerCase()
    .startsWith("video/");
}

function countVideoAttachments(items) {
  return items.filter((a) => isVideoMime(a?.mimeType)).length;
}

function clearDraftSnapshot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}

/**
 * New Memory Page
 * - Title
 * - Multi-photo upload with compression
 * - Story editor
 * - File attachments (audio/video/documents)
 * - Save locally (no ring write)
 */
export function NewMemoryPage({
  onBack,
  onSaved,
  onSaveMemory,
  onOpenHelp,
  locale = "en",
  userEntitlements = getFreeEntitlements(),
}) {
  const t = NEW_MEMORY_PAGE_CONTENT[locale] || NEW_MEMORY_PAGE_CONTENT.en;
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const canSealWithRing = gateSealWithRingAccess(userEntitlements).ok;
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [releaseAtInput, setReleaseAtInput] = useState("");
  const [photos, setPhotos] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const { videoItems, fileItems } = useMemo(() => {
    const videos = [];
    const files = [];
    for (const item of attachments) {
      if (isVideoMime(item.mimeType)) {
        videos.push(item);
      } else {
        files.push(item);
      }
    }
    return { videoItems: videos, fileItems: files };
  }, [attachments]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { soundEnabled, hapticEnabled, soundScope } = useFeedbackPrefs();
  const [saveDialog, setSaveDialog] = useState({
    open: false,
    status: "saving",
    errorMessage: "",
  });
  const [sealPromptOpen, setSealPromptOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState("");
  const [ringTapError, setRingTapError] = useState("");
  const [isFirstMemoryMode, setIsFirstMemoryMode] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine
  );

  const photoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item?.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const hasDraftContent = Boolean(
    title.trim() ||
      story.trim() ||
      releaseAtInput ||
      photos.length > 0 ||
      attachments.length > 0
  );

  function setFeedbackNotice(message) {
    setFeedback("");
    window.setTimeout(() => setFeedback(message), 0);
  }

  useEffect(() => {
    if (!sealPromptOpen) return undefined;
    const sync = () => setNetworkOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [sealPromptOpen]);

  useEffect(() => {
    const firstDone = isFirstMemoryCompleted();
    const timer = window.setTimeout(() => {
      setIsFirstMemoryMode(!firstDone);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      queueMicrotask(() => {
        if (draft?.title) setTitle(String(draft.title));
        if (draft?.story) setStory(String(draft.story));
        if (draft?.releaseAtInput) setReleaseAtInput(String(draft.releaseAtInput));
        if (Array.isArray(draft?.photos)) setPhotos(draft.photos);
        if (
          draft?.title ||
          draft?.story ||
          (Array.isArray(draft?.photos) && draft.photos.length)
        ) {
          setFeedbackNotice(t.feedbackDraftRestored);
        }
      });
    } catch {
      // Ignore malformed draft snapshots.
    }
  }, [t.feedbackDraftRestored]);

  useEffect(() => {
    if (!hasDraftContent) {
      clearDraftSnapshot();
      return;
    }
    try {
      // Keep draft snapshots small and resilient.
      // Attachments can be large binary payloads and must NOT be written to localStorage.
      const payload = JSON.stringify({
        title,
        story,
        releaseAtInput,
        photos,
      });
      window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    } catch {
      // Quota exceeded or serialization issue should not break editing flow.
    }
  }, [title, story, releaseAtInput, photos, hasDraftContent]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!hasDraftContent) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraftContent]);

  async function handlePhotosSelected(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remainingSlots = Math.max(0, MAX_PHOTOS - photos.length);
    if (remainingSlots === 0) {
      setFeedback(`${t.feedbackMaxPhotosPrefix}${MAX_PHOTOS}${t.feedbackMaxPhotosSuffix}`);
      event.target.value = "";
      return;
    }

    const allowedFiles = files.slice(0, remainingSlots);
    setFeedback(t.feedbackCompressing);

    try {
      const compressed = await Promise.all(
        allowedFiles.map((file) => compressImage(file, 1600, 0.78, t))
      );
      const newPhotos = await Promise.all(
        compressed.map(async (blob, index) => ({
          id: `${Date.now()}-${index}`,
          mimeType: blob.type || "image/jpeg",
          dataUrl: await blobToDataUrl(blob, t),
        }))
      );
      setPhotos((prev) => [...prev, ...newPhotos]);
      const overLimit = files.length > allowedFiles.length;
      setFeedback(
        overLimit
          ? `${t.feedbackAddedPhotosPrefix}${newPhotos.length}${t.feedbackAddedPhotosSuffix} ${t.feedbackMaxPhotosPrefix}${MAX_PHOTOS}${t.feedbackMaxPhotosSuffix}`
          : `${t.feedbackAddedPhotosPrefix}${newPhotos.length}${t.feedbackAddedPhotosSuffix}`
      );
    } catch {
      setFeedback(t.feedbackPhotoError);
    } finally {
      event.target.value = "";
    }
  }

  async function handleAttachmentsSelected(event, opts = {}) {
    const { preferVideo = false } = opts;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const selected = [];
      const tooLargeNames = [];
      const wrongPickerVideos = [];
      let skippedOverVideoCap = 0;
      let skippedOverFileCap = 0;

      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          tooLargeNames.push(file.name || "file");
          continue;
        }

        const cand = fileToAttachmentCandidate(file, { preferVideo });
        const isVideo = isVideoMime(cand.mimeType);

        if (preferVideo && !isVideo) {
          continue;
        }
        if (!preferVideo && isVideo) {
          wrongPickerVideos.push(file.name || "video");
          continue;
        }

        const vidSel = countVideoAttachments(selected);
        const fileSel = selected.length - vidSel;
        const baseVideos = countVideoAttachments(attachments);
        const baseFiles = attachments.length - baseVideos;

        if (isVideo) {
          if (baseVideos + vidSel >= MAX_VIDEOS) {
            skippedOverVideoCap += 1;
            continue;
          }
        } else if (baseFiles + fileSel >= MAX_FILE_ATTACHMENTS) {
          skippedOverFileCap += 1;
          continue;
        }

        selected.push(cand);
      }

      if (selected.length) {
        setAttachments((prev) => [...prev, ...selected]);
      }

      const messages = [];
      if (selected.length) {
        messages.push(
          `${t.feedbackAttachmentAddedPrefix}${selected.length}${t.feedbackAttachmentAddedSuffix}`
        );
      }
      if (tooLargeNames.length) {
        const preview = tooLargeNames.slice(0, 2).join(", ");
        messages.push(
          `${t.feedbackAttachmentTooLargeManyPrefix}${tooLargeNames.length}${t.feedbackAttachmentTooLargeManyMiddle}${MAX_ATTACHMENT_SIZE_MB}${t.feedbackAttachmentTooLargeManySuffix}${preview}`
        );
      }
      if (wrongPickerVideos.length) {
        const preview = wrongPickerVideos.slice(0, 2).join(", ");
        messages.push(
          `${t.feedbackWrongPickerVideosPrefix}${preview}${t.feedbackWrongPickerVideosSuffix}`
        );
      }
      if (skippedOverVideoCap > 0) {
        messages.push(
          t.feedbackSkippedVideoClips
            .replace("{n}", String(skippedOverVideoCap))
            .replace("{max}", String(MAX_VIDEOS))
            .replace("{mb}", String(MAX_ATTACHMENT_SIZE_MB))
        );
      }
      if (skippedOverFileCap > 0) {
        messages.push(
          t.feedbackSkippedFileAttachments
            .replace("{n}", String(skippedOverFileCap))
            .replace("{max}", String(MAX_FILE_ATTACHMENTS))
            .replace("{mb}", String(MAX_ATTACHMENT_SIZE_MB))
        );
      }
      if (messages.length) {
        setFeedback(messages.join(" "));
      }
    } catch {
      setFeedback(t.feedbackAttachmentError);
    } finally {
      event.target.value = "";
    }
  }

  async function handleSave(options = {}) {
    const { openSealPromptOnSuccess = false, showDialogOnSuccess = true } = options;
    if (
      !title.trim() &&
      !story.trim() &&
      photos.length === 0 &&
      attachments.length === 0
    ) {
      setFeedback(t.feedbackNeedContent);
      return;
    }

    setSaving(true);
    setFeedback(t.feedbackSavingLocal);
    setSaveDialog({ open: true, status: "saving", errorMessage: "" });
    try {
      const draftAttachments = await prepareAttachmentsForSave(attachments, t);
      const releaseAt = releaseAtInput ? Date.parse(releaseAtInput) : 0;
      const savedDraft = await saveDraftItem({
        id: editingDraftId || undefined,
        title: title.trim() || t.untitled,
        story: story.trim(),
        photo: photos,
        attachments: draftAttachments,
        releaseAt,
      });
      setEditingDraftId(savedDraft.id);
      if (!openSealPromptOnSuccess && typeof onSaveMemory === "function") {
        setFeedback(t.feedbackSavingTimeline);
        await onSaveMemory({
          id: savedDraft.id,
          title: title.trim() || t.untitled,
          story: story.trim(),
          photo: photos.length > 0 ? photos : [],
          attachments: draftAttachments,
          releaseAt,
          timelineAt: Date.now(),
        });
      }
      if (openSealPromptOnSuccess) {
        primeSealPrepAfterDraftPersisted(savedDraft.id);
      }
      setFeedback(
        openSealPromptOnSuccess
          ? t.feedbackSaved
          : typeof onSaveMemory === "function"
            ? t.feedbackSavedTimeline
            : t.feedbackSaved
      );
      setSaveDialog(
        showDialogOnSuccess
          ? { open: true, status: "success", errorMessage: "" }
          : { open: false, status: "saving", errorMessage: "" }
      );
      if (openSealPromptOnSuccess) {
        setSealPromptOpen(true);
        setFeedbackNotice(t.feedbackReadyToSeal);
      }
      // Keep the compose snapshot only for explicit draft saves.
      // Seal flow now requires a verified ring event before formal persistence.
      if (!openSealPromptOnSuccess) {
        clearDraftSnapshot();
      }
      triggerSuccessFeedback({
        soundEnabled,
        hapticEnabled,
        allowSound:
          soundScope === "all_success" || soundScope === "save_only",
      });
      if (!openSealPromptOnSuccess) {
        onSaved?.();
        if (isFirstMemoryMode) {
          markFirstMemoryCompleted();
          setIsFirstMemoryMode(false);
          void trackFirstRunEvent("first_memory_saved", {
            locale,
            metadata: { mode: "draft_save" },
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t.feedbackSaveFailed;
      setFeedback(message);
      setSaveDialog({ open: true, status: "error", errorMessage: message });
    } finally {
      setSaving(false);
    }
  }

  function handleCreateAnother() {
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setSealPromptOpen(false);
    setTitle("");
    setStory("");
    setReleaseAtInput("");
    setPhotos([]);
    setAttachments([]);
    setEditingDraftId("");
    setRingTapError("");
    setFeedback(t.feedbackReadyNext);
    clearSealPrepState();
    clearDraftSnapshot();
  }

  function handleOpenSealPrompt() {
    if (!canSealWithRing) {
      setFeedbackNotice(t.upgradeSealWithRing);
      return;
    }
    const draftId = String(editingDraftId || "").trim();
    if (!draftId) {
      setFeedbackNotice(t.feedbackSealPrepNeedDraftSave);
      return;
    }
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setSealPromptOpen(true);
    setRingTapError("");
    primeSealPrepAfterDraftPersisted(draftId);
    setFeedbackNotice(t.feedbackReadyToSeal);
  }

  async function handleSealNow() {
    if (!canSealWithRing) {
      setSealPromptOpen(false);
      setFeedbackNotice(t.upgradeSealWithRing);
      return;
    }
    await handleSave({ openSealPromptOnSuccess: true, showDialogOnSuccess: false });
  }

  async function handleSaveSecurelyFallback() {
    await handleSave({ openSealPromptOnSuccess: false });
  }

  function removeAttachmentById(id) {
    setAttachments((prev) => {
      const removed = prev.find((it) => it.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  }

  function removePhotoById(id) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main style={styles.page}>
      <header style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.topBarBtn}>
          ← {t.back}
        </button>
        <h1 style={styles.topBarTitle}>{t.title}</h1>
        <button
          type="button"
          onClick={() => onOpenHelp?.()}
          style={{ ...styles.topBarBtn, justifySelf: "end" }}
          aria-label={t.helpAriaLabel}
        >
          ?
        </button>
      </header>

      <div style={styles.scrollBody}>
        <label style={styles.srOnly} htmlFor="haven-memory-story">
          {t.storyLabel}
        </label>
        <textarea
          id="haven-memory-story"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={10}
          placeholder={t.storyPlaceholder}
          style={styles.textareaHero}
        />

        <p style={styles.feedbackInline}>{feedback || "\u00A0"}</p>

        <section style={styles.mediaZone} aria-label={t.mediaZoneAria}>
          <p style={styles.mediaLimitsSummary}>{t.mediaLimitsSummary}</p>

          <div style={styles.mediaRow}>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={styles.mediaBtn}
            >
              📸 {t.addPhotosCta}
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              style={styles.mediaBtn}
            >
              🎥 {t.addVideoCta}
            </button>
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              style={styles.mediaBtn}
            >
              📎 {t.addFilesCta}
            </button>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosSelected}
            style={styles.hiddenFileInput}
          />
          <input
            ref={attachmentInputRef}
            type="file"
            accept="audio/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.zip,.rar,.7z,application/pdf"
            multiple
            onChange={(e) => void handleAttachmentsSelected(e, { preferVideo: false })}
            style={styles.hiddenFileInput}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => void handleAttachmentsSelected(e, { preferVideo: true })}
            style={styles.hiddenFileInput}
          />

          {photos.length > 0 ? (
            <>
              <p style={styles.mediaSubLabel}>
                {t.photosSectionHeading} · {photos.length}/{MAX_PHOTOS}
              </p>
              <div style={styles.photoGrid}>
                {photos.map((photo) => (
                  <div key={photo.id} style={styles.mediaThumbWrap}>
                    <img src={photo.dataUrl} alt="" style={styles.photoThumb} />
                    <button
                      type="button"
                      onClick={() => removePhotoById(photo.id)}
                      style={styles.mediaRemoveOverlay}
                      aria-label={t.removePhotoAria}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {videoItems.length > 0 ? (
            <>
              <p style={styles.mediaSubLabel}>
                {t.videosSectionHeading} · {videoItems.length}/{MAX_VIDEOS}
              </p>
              <div style={styles.photoGrid} role="group" aria-label={t.videoAttachmentsLabel}>
                {videoItems.map((item) => {
                  const src = item.previewUrl || item.dataUrl || "";
                  return (
                    <div key={item.id} style={styles.mediaThumbWrap}>
                      {src ? (
                        <video
                          src={src}
                          controls
                          playsInline
                          preload="metadata"
                          style={styles.mediaCellVideo}
                        />
                      ) : (
                        <div style={styles.videoPlaceholderCompact}>{t.videoPreviewPending}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachmentById(item.id)}
                        style={styles.mediaRemoveOverlay}
                        aria-label={t.removeVideoAria}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {fileItems.length > 0 ? (
            <>
              <p style={styles.mediaSubLabel}>
                {t.filesSectionHeading} · {fileItems.length}/{MAX_FILE_ATTACHMENTS}
              </p>
              <ul style={styles.attachmentList}>
                {fileItems.map((item) => (
                  <li key={item.id} style={styles.attachmentItem}>
                    <span style={styles.attachmentName}>
                      {item.name}
                      <span style={styles.attachmentSize}> ({formatAttachmentSize(item.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachmentById(item.id)}
                      style={styles.clearButton}
                    >
                      {t.removeAttachment}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <button type="button" onClick={() => setDetailsOpen((v) => !v)} style={styles.optionalToggle}>
          {detailsOpen ? t.optionalDetailsHide : t.optionalDetailsToggle}
        </button>
        {detailsOpen ? (
          <div style={styles.optionalBlock}>
            <label style={styles.label}>
              {t.titleLabel}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              {t.timeCapsuleLabel}
              <input
                type="datetime-local"
                value={releaseAtInput}
                onChange={(e) => setReleaseAtInput(e.target.value)}
                style={styles.input}
              />
            </label>
          </div>
        ) : null}

        <p style={styles.freePlanLine}>{t.freePlanOneLiner}</p>
        {platform === "ios" ? <p style={styles.iosHint}>{t.iosComposeHint}</p> : null}
        {platform === "android" ? <p style={styles.iosHint}>{t.androidComposeHint}</p> : null}
      </div>

      <footer style={styles.fixedFooter}>
        {sealPromptOpen ? (
          <section style={styles.sealPromptCompact}>
            <p style={styles.sealPromptTitle}>{t.sealPromptTitle}</p>
            <div style={styles.statusBanner} role="status" aria-live="polite">
              <p style={styles.sealPromptBody}>{t.sealStatusWaiting}</p>
            </div>
            {!networkOnline ? <p style={styles.hint}>{t.sealNeedsNetworkHint}</p> : null}
            {ringTapError ? <p style={styles.error}>{ringTapError}</p> : null}
          </section>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSealNow()}
          disabled={saving}
          style={{
            ...styles.footerPrimary,
            ...(canSealWithRing ? {} : styles.footerPrimaryMuted),
          }}
        >
          {t.sealNow}
        </button>
        <button
          type="button"
          onClick={() => void handleSaveSecurelyFallback()}
          disabled={saving}
          style={styles.footerSecondary}
        >
          {t.sealSecureQuickAction || t.sealFallbackAction}
        </button>
      </footer>

      <SaveToHavenDialog
        locale={locale}
        open={saveDialog.open}
        status={saveDialog.status}
        errorMessage={saveDialog.errorMessage}
        onSealNow={
          canSealWithRing ? handleOpenSealPrompt : () => setFeedbackNotice(t.upgradeSealWithRing)
        }
        onCreateAnother={handleCreateAnother}
      />
    </main>
  );
}

async function compressImage(file, maxSize, quality, t) {
  const img = await loadImageFromFile(file, t);
  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t.canvasUnavailable);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(t.compressionFailed))),
      "image/jpeg",
      quality
    );
  });
}

function loadImageFromFile(file, t) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t.invalidImage));
    };
    img.src = url;
  });
}

function blobToDataUrl(blob, t) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(t.readBinaryFailed));
    reader.readAsDataURL(blob);
  });
}

function fileToAttachmentCandidate(file, opts = {}) {
  const { preferVideo = false } = opts;
  let mimeType = String(file.type || "").trim();
  if (!mimeType && preferVideo) {
    mimeType = "video/mp4";
  }
  if (!mimeType) {
    mimeType = "application/octet-stream";
  }
  const isVideo = isVideoMime(mimeType);
  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || (isVideo ? "Video" : "attachment"),
    mimeType,
    size: file.size || 0,
    file,
  };
  if (isVideo && typeof URL !== "undefined" && file) {
    base.previewUrl = URL.createObjectURL(file);
  }
  return base;
}

function formatAttachmentSize(size = 0) {
  const mb = Number(size || 0) / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

async function prepareAttachmentsForSave(attachments, t) {
  const prepared = [];
  for (const item of attachments) {
    if (item?.dataUrl) {
      prepared.push(item);
      continue;
    }
    if (!item?.file) continue;
    prepared.push({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      dataUrl: await blobToDataUrl(item.file, t),
    });
  }
  return prepared;
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "radial-gradient(circle at 50% 0%, #2a211c 0%, #151210 45%, #0e0c0b 100%)",
    color: "#f3ece6",
    fontFamily: "Inter, system-ui, sans-serif",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(0,2.4fr) minmax(0,1fr)",
    alignItems: "center",
    gap: 6,
    padding: "10px 12px 12px",
    borderBottom: "1px solid rgba(55, 44, 38, 0.85)",
    flexShrink: 0,
    background: "rgba(18, 14, 12, 0.92)",
  },
  topBarBtn: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#e8d8ce",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    justifySelf: "start",
  },
  topBarTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    textAlign: "center",
    color: "#faf6f1",
  },
  scrollBody: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 168px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  textareaHero: {
    width: "100%",
    minHeight: 200,
    boxSizing: "border-box",
    border: "1px solid rgba(72, 58, 50, 0.95)",
    borderRadius: 16,
    background: "rgba(22, 18, 16, 0.92)",
    color: "#f8efe7",
    padding: "16px 16px",
    fontSize: 17,
    lineHeight: 1.55,
    resize: "vertical",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  feedbackInline: {
    margin: 0,
    minHeight: 16,
    color: "rgba(232, 216, 206, 0.82)",
    fontSize: 12,
    lineHeight: 1.45,
  },
  mediaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  mediaZone: {
    display: "grid",
    gap: 12,
  },
  mediaLimitsSummary: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(212, 198, 188, 0.82)",
  },
  mediaSubLabel: {
    margin: "4px 0 0",
    fontSize: 11,
    fontWeight: 650,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(224, 206, 194, 0.68)",
  },
  mediaBtn: {
    border: "1px solid rgba(90, 72, 62, 0.9)",
    borderRadius: 12,
    background: "rgba(30, 24, 21, 0.95)",
    color: "#f3ece6",
    padding: "11px 14px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    WebkitTapHighlightColor: "transparent",
  },
  hiddenFileInput: {
    display: "none",
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
    gap: 8,
  },
  mediaThumbWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(55, 44, 38, 0.9)",
    aspectRatio: "1 / 1",
    background: "rgba(0,0,0,0.25)",
  },
  mediaRemoveOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.4)",
    background: "rgba(14, 12, 11, 0.75)",
    color: "#faf6f1",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    padding: 0,
    WebkitTapHighlightColor: "transparent",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  mediaCellVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    background: "#000",
  },
  videoPlaceholderCompact: {
    width: "100%",
    height: "100%",
    minHeight: 72,
    display: "grid",
    placeItems: "center",
    padding: 8,
    textAlign: "center",
    fontSize: 12,
    color: "rgba(232, 216, 206, 0.72)",
  },
  attachmentList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 6,
  },
  attachmentItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(55, 44, 38, 0.75)",
    background: "rgba(20, 17, 15, 0.6)",
  },
  attachmentName: {
    color: "#d9c9bf",
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  attachmentSize: {
    color: "rgba(217, 201, 191, 0.7)",
    fontSize: 12,
  },
  clearButton: {
    border: "1px solid rgba(90, 72, 62, 0.85)",
    borderRadius: 999,
    background: "transparent",
    color: "#f0c9a8",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
  },
  optionalToggle: {
    alignSelf: "flex-start",
    border: "none",
    background: "transparent",
    color: "rgba(224, 206, 194, 0.75)",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
    textUnderlineOffset: 3,
    padding: 0,
  },
  optionalBlock: {
    display: "grid",
    gap: 12,
    paddingTop: 4,
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#e8dcd4",
    fontWeight: 600,
    fontSize: 13,
  },
  input: {
    border: "1px solid rgba(72, 58, 50, 0.95)",
    borderRadius: 12,
    background: "rgba(22, 18, 16, 0.92)",
    color: "#f8efe7",
    padding: "10px 12px",
    fontSize: 15,
  },
  freePlanLine: {
    margin: "4px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(210, 196, 186, 0.72)",
  },
  iosHint: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.45,
    color: "rgba(200, 188, 178, 0.65)",
  },
  fixedFooter: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
    display: "grid",
    gap: 10,
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    borderTop: "1px solid rgba(55, 44, 38, 0.9)",
    background: "linear-gradient(180deg, rgba(22, 18, 16, 0.72), rgba(14, 12, 11, 0.96))",
    backdropFilter: "blur(10px)",
  },
  sealPromptCompact: {
    display: "grid",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(217, 166, 122, 0.35)",
    background: "rgba(40, 30, 24, 0.55)",
  },
  sealPromptTitle: {
    margin: 0,
    color: "#faf6f1",
    fontSize: 14,
    fontWeight: 600,
  },
  sealPromptBody: {
    margin: 0,
    color: "#d9c9bf",
    lineHeight: 1.45,
    fontSize: 13,
  },
  statusBanner: {
    border: "1px solid rgba(217, 166, 122, 0.28)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(217, 166, 122, 0.08)",
  },
  hint: {
    margin: 0,
    color: "rgba(210, 196, 186, 0.75)",
    fontSize: 12,
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
    fontSize: 12,
  },
  footerPrimary: {
    border: "1px solid #c99a6e",
    background: "linear-gradient(180deg, #e2b189, #c7976a)",
    color: "#1a1411",
    borderRadius: 16,
    padding: "16px 18px",
    fontWeight: 750,
    fontSize: 16,
    lineHeight: 1.25,
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
  },
  footerPrimaryMuted: {
    opacity: 0.55,
  },
  footerSecondary: {
    border: "1px solid rgba(90, 72, 62, 0.95)",
    background: "rgba(26, 22, 20, 0.9)",
    color: "#e8d8ce",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
};
