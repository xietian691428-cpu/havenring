import { useMemo, useRef, useState } from "react";
import { createMemory } from "../services/localStorageService";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { SaveToHavenDialog } from "../components/SaveToHavenDialog";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { NEW_MEMORY_PAGE_CONTENT } from "../content/newMemoryPageContent";

const MAX_RECORD_SECONDS = 45;
const MAX_PHOTOS = 6;

/**
 * New Memory Page
 * - Title
 * - Multi-photo upload with compression
 * - Story editor
 * - Timed voice recording
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
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { soundEnabled, hapticEnabled, soundScope, updateFeedbackPrefs } =
    useFeedbackPrefs();
  const [saveDialog, setSaveDialog] = useState({
    open: false,
    status: "saving",
    errorMessage: "",
  });

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const photoInputRef = useRef(null);

  const voicePreviewUrl = useMemo(
    () => (voiceBlob ? URL.createObjectURL(voiceBlob) : ""),
    [voiceBlob]
  );

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

  async function startRecording() {
    setFeedback("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setRecordSeconds(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        cleanupRecordingResources();
        setFeedback(t.feedbackVoiceCaptured);
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev + 1 >= MAX_RECORD_SECONDS) {
            stopRecording();
            return MAX_RECORD_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      setFeedback(t.feedbackMicUnavailable);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }

  function cleanupRecordingResources() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  async function handleSave() {
    if (!title.trim() && !story.trim() && photos.length === 0 && !voiceBlob) {
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
        voice: voiceBlob ? await blobToDataUrl(voiceBlob, t) : null,
        encryptVoice: true,
        tags: [],
      };
      if (typeof onSaveMemory === "function") {
        await onSaveMemory(payload);
      } else {
        await createMemory(payload);
      }

      setFeedback(t.feedbackSaved);
      setSaveDialog({ open: true, status: "success", errorMessage: "" });
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
    setTitle("");
    setStory("");
    setPhotos([]);
    setVoiceBlob(null);
    setFeedback(t.feedbackReadyNext);
  }

  function handleViewTimeline() {
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    onViewTimeline?.();
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

        <section style={styles.voiceBox}>
          <p style={styles.voiceTitle}>
            {t.voiceTitlePrefix}
            {MAX_RECORD_SECONDS}
            {t.voiceTitleSuffix}
          </p>
          <div style={styles.voiceActions}>
            {!isRecording ? (
              <button type="button" onClick={startRecording} style={styles.secondaryButton}>
                {t.record}
              </button>
            ) : (
              <button type="button" onClick={stopRecording} style={styles.secondaryButton}>
                {t.stopPrefix}
                {recordSeconds}
                {t.stopSuffix}
              </button>
            )}
            {voiceBlob ? (
              <button
                type="button"
                onClick={() => setVoiceBlob(null)}
                style={styles.clearButton}
              >
                {t.removeVoice}
              </button>
            ) : null}
          </div>
          {voicePreviewUrl ? <audio controls src={voicePreviewUrl} style={{ width: "100%" }} /> : null}
        </section>

        <button type="button" onClick={handleSave} disabled={saving} style={styles.primaryButton}>
          {saving ? t.saving : t.save}
        </button>

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
        onViewTimeline={handleViewTimeline}
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
  voiceBox: {
    border: "1px solid #3a2d28",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
    background: "#1b1512",
  },
  voiceTitle: {
    margin: 0,
    color: "#d9c3b3",
  },
  voiceActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
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
