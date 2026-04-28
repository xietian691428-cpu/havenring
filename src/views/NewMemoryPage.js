import { useEffect, useRef, useState } from "react";
import { createMemory } from "../services/localStorageService";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { SaveToHavenDialog } from "../components/SaveToHavenDialog";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { NEW_MEMORY_PAGE_CONTENT } from "../content/newMemoryPageContent";
import { armSealFlow, clearSealFlowArm } from "../../lib/seal-flow";

const MAX_PHOTOS = 6;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const DRAFT_STORAGE_KEY = "haven.new_memory_draft";

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
  onViewTimeline,
  locale = "en",
}) {
  const t = NEW_MEMORY_PAGE_CONTENT[locale] || NEW_MEMORY_PAGE_CONTENT.en;
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { soundEnabled, hapticEnabled, soundScope, updateFeedbackPrefs } =
    useFeedbackPrefs();
  const [saveDialog, setSaveDialog] = useState({
    open: false,
    status: "saving",
    errorMessage: "",
  });
  const [sealPromptOpen, setSealPromptOpen] = useState(false);

  const photoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const hasDraftContent = Boolean(
    title.trim() || story.trim() || photos.length > 0 || attachments.length > 0
  );

  function setFeedbackNotice(message) {
    setFeedback("");
    window.setTimeout(() => setFeedback(message), 0);
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.title) setTitle(String(draft.title));
      if (draft?.story) setStory(String(draft.story));
      if (Array.isArray(draft?.photos)) setPhotos(draft.photos);
      if (
        draft?.title ||
        draft?.story ||
        (Array.isArray(draft?.photos) && draft.photos.length)
      ) {
        setFeedbackNotice(t.feedbackDraftRestored);
      }
    } catch {
      // Ignore malformed draft snapshots.
    }
  }, []);

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
        photos,
      });
      window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    } catch {
      // Quota exceeded or serialization issue should not break editing flow.
    }
  }, [title, story, photos, hasDraftContent]);

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
    } catch (error) {
      setFeedback(t.feedbackPhotoError);
    } finally {
      event.target.value = "";
    }
  }

  async function handleAttachmentsSelected(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remainingSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (remainingSlots === 0) {
      setFeedback(
        `${t.feedbackMaxAttachmentsPrefix}${MAX_ATTACHMENTS}${t.feedbackMaxAttachmentsSuffix}`
      );
      event.target.value = "";
      return;
    }

    const allowedFiles = files.slice(0, remainingSlots);
    try {
      const selected = [];
      for (const file of allowedFiles) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setFeedback(
            `${t.feedbackAttachmentTooLargePrefix}${file.name}${t.feedbackAttachmentTooLargeSuffix}`
          );
          continue;
        }
        selected.push(fileToAttachmentCandidate(file));
      }
      if (!selected.length) {
        event.target.value = "";
        return;
      }
      setAttachments((prev) => [...prev, ...selected]);
      setFeedback(
        `${t.feedbackAttachmentAddedPrefix}${selected.length}${t.feedbackAttachmentAddedSuffix}`
      );
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
      const payload = {
        title: title.trim() || t.untitled,
        story: story.trim(),
        photo: photos,
        voice: null,
        attachments: await prepareAttachmentsForSave(attachments, t),
        tags: [],
      };
      if (typeof onSaveMemory === "function") {
        await onSaveMemory(payload);
      } else {
        await createMemory(payload);
      }

      setFeedback(t.feedbackSaved);
      setSaveDialog(
        showDialogOnSuccess
          ? { open: true, status: "success", errorMessage: "" }
          : { open: false, status: "saving", errorMessage: "" }
      );
      if (openSealPromptOnSuccess) {
        setSealPromptOpen(true);
        armSealFlow();
        setFeedbackNotice(t.feedbackReadyToSeal);
      }
      // A saved memory must not be restored as "editing draft".
      clearDraftSnapshot();
      triggerSuccessFeedback({
        soundEnabled,
        hapticEnabled,
        allowSound:
          soundScope === "all_success" || soundScope === "save_only",
      });
      onSaved?.();
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
    setPhotos([]);
    setAttachments([]);
    setFeedback(t.feedbackReadyNext);
    clearSealFlowArm();
    clearDraftSnapshot();
  }

  function handleViewTimeline() {
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setSealPromptOpen(false);
    clearSealFlowArm();
    onViewTimeline?.();
  }

  function handleOpenSealPrompt() {
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setSealPromptOpen(true);
    armSealFlow();
    setFeedbackNotice(t.feedbackReadyToSeal);
  }

  async function handleSealNow() {
    await handleSave({ openSealPromptOnSuccess: true, showDialogOnSuccess: false });
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{t.brand}</p>
            <h1 style={styles.title}>{t.title}</h1>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>
        <p style={styles.sealGuidance}>{t.sealGuidance}</p>

        <button type="button" onClick={onBack} style={styles.backButton}>
          {t.back}
        </button>

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
          {t.storyLabel}
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={6}
            placeholder={t.storyPlaceholder}
            style={styles.textarea}
          />
        </label>

        <label style={styles.label}>
          {t.photosLabel}
          <div style={styles.filePickerRow}>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={styles.filePickerButton}
            >
              {t.choosePhotos}
            </button>
            <span style={styles.filePickerStatus}>
              {photos.length ? `${photos.length}${t.photosSelectedSuffix}` : t.noPhotosSelected}
              <span style={styles.filePickerMeta}>
                {t.photosCountPrefix}
                {photos.length}/{MAX_PHOTOS}
                {t.photosCountSuffix}
              </span>
            </span>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosSelected}
            style={styles.hiddenFileInput}
          />
          <small style={styles.hint}>{t.photosHint}</small>
        </label>

        {photos.length ? (
          <div style={styles.photoGrid}>
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.dataUrl}
                alt=""
                style={styles.photoThumb}
              />
            ))}
          </div>
        ) : null}

        <label style={styles.label}>
          {t.attachmentsLabel}
          <div style={styles.filePickerRow}>
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              style={styles.filePickerButton}
            >
              {t.chooseAttachments}
            </button>
            <span style={styles.filePickerStatus}>
              {attachments.length
                ? `${attachments.length}${t.attachmentsSelectedSuffix}`
                : t.noAttachmentsSelected}
            </span>
          </div>
          <input
            ref={attachmentInputRef}
            type="file"
            accept="audio/*,video/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.zip,.rar,.7z"
            multiple
            onChange={handleAttachmentsSelected}
            style={styles.hiddenFileInput}
          />
          <small style={styles.hint}>{t.attachmentsHint}</small>
          {attachments.length ? (
            <ul style={styles.attachmentList}>
              {attachments.map((item) => (
                <li key={item.id} style={styles.attachmentItem}>
                  <span style={styles.attachmentName}>{item.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((it) => it.id !== item.id))
                    }
                    style={styles.clearButton}
                  >
                    {t.removeAttachment}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>

        <button type="button" onClick={handleSave} disabled={saving} style={styles.primaryButton}>
          {saving ? t.saving : t.save}
        </button>
        <button type="button" onClick={handleSealNow} disabled={saving} style={styles.secondaryButton}>
          {t.sealNow}
        </button>
        {sealPromptOpen ? (
          <section style={styles.sealPromptBox}>
            <p style={styles.sealPromptTitle}>{t.sealPromptTitle}</p>
            <p style={styles.sealPromptBody}>{t.sealPromptBody}</p>
            <div style={styles.voiceActions}>
              <button type="button" onClick={handleViewTimeline} style={styles.primaryButton}>
                {t.sealPromptDone}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSealPromptOpen(false);
                  clearSealFlowArm();
                }}
                style={styles.secondaryButton}
              >
                {t.sealPromptClose}
              </button>
            </div>
          </section>
        ) : null}

        <div style={styles.feedbackToggles}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={hapticEnabled}
              onChange={(e) => {
                updateFeedbackPrefs({ hapticEnabled: e.target.checked });
              }}
            />
            {t.haptic}
          </label>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => {
                updateFeedbackPrefs({ soundEnabled: e.target.checked });
              }}
            />
            {t.sound}
          </label>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={soundScope === "save_only"}
              onChange={(e) => {
                updateFeedbackPrefs({
                  soundScope: e.target.checked ? "save_only" : "all_success",
                });
              }}
            />
            {t.soundSaveOnly}
          </label>
        </div>

        <p style={styles.feedback}>{feedback || "\u00A0"}</p>
        <p style={styles.hint}>
          {t.privacyHint}
        </p>
      </section>
      <SaveToHavenDialog
        locale={locale}
        open={saveDialog.open}
        status={saveDialog.status}
        errorMessage={saveDialog.errorMessage}
        onSealNow={handleOpenSealPrompt}
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

function fileToAttachmentCandidate(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    size: file.size || 0,
    file,
  };
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
    padding: 20,
    background: "radial-gradient(circle at top, #281d18 0%, #120f0e 56%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  shell: {
    maxWidth: 860,
    margin: "0 auto",
    border: "1px solid #3a2d28",
    borderRadius: 18,
    background: "#171210",
    padding: 16,
    display: "grid",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  brand: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 28,
    fontWeight: 500,
  },
  sealGuidance: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #5a3b30",
    background: "#1a1412",
    color: "#f0c29e",
    fontSize: 12,
    lineHeight: 1.6,
  },
  backButton: {
    justifySelf: "start",
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#f8efe7",
    fontWeight: 600,
  },
  input: {
    border: "1px solid #3a2d28",
    borderRadius: 10,
    background: "#1f1816",
    color: "#f8efe7",
    padding: "10px 12px",
  },
  textarea: {
    border: "1px solid #3a2d28",
    borderRadius: 10,
    background: "#1f1816",
    color: "#f8efe7",
    padding: "10px 12px",
    resize: "vertical",
  },
  hiddenFileInput: {
    display: "none",
  },
  filePickerRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  filePickerButton: {
    border: "1px dashed #5a3b30",
    borderRadius: 10,
    background: "#1f1816",
    color: "#f8efe7",
    padding: "8px 12px",
    cursor: "pointer",
  },
  filePickerStatus: {
    color: "#d9c3b3",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "baseline",
    gap: 10,
  },
  filePickerMeta: {
    color: "rgba(248, 239, 231, 0.65)",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.02em",
  },
  hint: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 12,
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))",
    gap: 8,
  },
  photoThumb: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid #3a2d28",
  },
  attachmentList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 6,
  },
  voiceActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  attachmentItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  attachmentName: {
    color: "#d9c3b3",
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #d9a67a",
    borderRadius: 999,
    background: "transparent",
    color: "#f0c29e",
    padding: "8px 12px",
    cursor: "pointer",
  },
  clearButton: {
    border: "1px solid #5a3b30",
    borderRadius: 999,
    background: "transparent",
    color: "#f3c6a5",
    padding: "8px 12px",
    cursor: "pointer",
  },
  sealPromptBox: {
    border: "1px solid #d9a67a",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
    background: "#1b1512",
  },
  sealPromptTitle: {
    margin: 0,
    color: "#f8efe7",
    fontSize: 16,
    fontWeight: 600,
  },
  sealPromptBody: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.6,
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    minHeight: 18,
    color: "#f2d8c5",
  },
  feedbackToggles: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
  },
  toggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#d9c3b3",
    fontSize: 12,
  },
};
