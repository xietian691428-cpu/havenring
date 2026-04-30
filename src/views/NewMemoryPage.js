import { useEffect, useRef, useState } from "react";
import { createMemory } from "../services/localStorageService";
import {
  listDraftItems,
  removeDraftItem,
  saveDraftItem,
} from "../services/draftBoxService";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { SaveToHavenDialog } from "../components/SaveToHavenDialog";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { NEW_MEMORY_PAGE_CONTENT } from "../content/newMemoryPageContent";
import {
  getApiErrorCode,
  getUserFriendlyMessage,
} from "../utils/userFriendlyApiErrors";
import {
  isFirstMemoryCompleted,
  markFirstMemoryCompleted,
  trackFirstRunEvent,
} from "../services/firstRunTelemetryService";
import { armSealFlow, clearSealFlowArm } from "../../lib/seal-flow";
import { readNfcScanFull } from "../services/nfcRingService";
import { normalizeNfcUidInput } from "../../lib/nfc-uid-browser";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { getSecuritySummary, verifyAndTrustCurrentDevice } from "../services/deviceTrustService";

const MAX_PHOTOS = 6;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const DRAFT_STORAGE_KEY = "haven.new_memory_draft";
const SEAL_UNDO_WINDOW_MS = 6000;

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
  const [releaseAtInput, setReleaseAtInput] = useState("");
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
  const [isIosLikeDevice, setIsIosLikeDevice] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState([]);
  const [editingDraftId, setEditingDraftId] = useState("");
  const [pendingSealIds, setPendingSealIds] = useState([]);
  const [sealTicket, setSealTicket] = useState("");
  const [ringTapBusy, setRingTapBusy] = useState(false);
  const [ringTapError, setRingTapError] = useState("");
  const [secureSaveBusy, setSecureSaveBusy] = useState(false);
  const [securePassword, setSecurePassword] = useState("");
  const [secureRecoveryCode, setSecureRecoveryCode] = useState("");
  const [sealSuccessToast, setSealSuccessToast] = useState("");
  const [isFirstMemoryMode, setIsFirstMemoryMode] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const sealTimerRef = useRef(null);

  const photoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

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

  function celebrateSealSuccess() {
    triggerSuccessFeedback({
      soundEnabled,
      hapticEnabled,
      allowSound: true,
    });
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([60, 40, 90, 40, 120]);
    }
    setSealSuccessToast(t.sealSuccessWarm);
    window.setTimeout(() => setSealSuccessToast(""), 2200);
  }

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes("macintosh") && "ontouchend" in window);
    setIsIosLikeDevice(isIos);
  }, []);

  useEffect(() => {
    const firstDone = isFirstMemoryCompleted();
    setIsFirstMemoryMode(!firstDone);
    setShowAdvancedDetails(firstDone);
  }, []);

  useEffect(() => {
    void loadDraftBox();
  }, []);

  useEffect(() => {
    return () => {
      if (sealTimerRef.current) {
        window.clearTimeout(sealTimerRef.current);
      }
    };
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
      await loadDraftBox();
      if (openSealPromptOnSuccess) {
        setPendingSealIds([savedDraft.id]);
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
          setShowAdvancedDetails(true);
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

  async function loadDraftBox() {
    const rows = await listDraftItems();
    setDraftItems(rows);
    setSelectedDraftIds((prev) => prev.filter((id) => rows.some((d) => d.id === id)));
  }

  async function sealDraftItems(ids = []) {
    if (!ids.length) return;
    if (sealTimerRef.current) return;
    setSaving(true);
    try {
      setPendingSealIds(ids);
      setSelectedDraftIds([]);
      setFeedbackNotice(
        t.feedbackUndoWindow.replace("{n}", String(ids.length))
      );
      sealTimerRef.current = window.setTimeout(async () => {
        try {
          await loadDraftBox();
          setSealPromptOpen(true);
          armSealFlow();
          setFeedbackNotice(t.feedbackReadyToSeal);
        } catch {
          setFeedback(t.feedbackSaveFailed);
        } finally {
          sealTimerRef.current = null;
          setPendingSealIds([]);
          setSaving(false);
        }
      }, SEAL_UNDO_WINDOW_MS);
    } catch {
      setFeedback(t.feedbackSaveFailed);
      setSaving(false);
    }
  }

  function undoPendingSeal() {
    if (!sealTimerRef.current) return;
    window.clearTimeout(sealTimerRef.current);
    sealTimerRef.current = null;
    setPendingSealIds([]);
    setSaving(false);
    setFeedbackNotice(t.feedbackUndoDone);
  }

  function editDraftItem(item) {
    setEditingDraftId(item.id);
    setTitle(item.title || "");
    setStory(item.story || "");
    setReleaseAtInput(
      item.releaseAt ? new Date(item.releaseAt).toISOString().slice(0, 16) : ""
    );
    setPhotos(Array.isArray(item.photo) ? item.photo : []);
    setAttachments(
      Array.isArray(item.attachments)
        ? item.attachments.map((row) => ({
            ...row,
            file: null,
          }))
        : []
    );
    setFeedbackNotice(t.feedbackDraftRestored);
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
    setSealTicket("");
    setRingTapError("");
    setSecurePassword("");
    setSecureRecoveryCode("");
    setFeedback(t.feedbackReadyNext);
    clearSealFlowArm();
    clearDraftSnapshot();
  }

  function handleViewTimeline() {
    void finalizePendingSealsAndExit();
  }

  function handleOpenSealPrompt() {
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setSealPromptOpen(true);
    setSealTicket("");
    setRingTapError("");
    armSealFlow();
    setFeedbackNotice(t.feedbackReadyToSeal);
  }

  async function handleSealNow() {
    await handleSave({ openSealPromptOnSuccess: true, showDialogOnSuccess: false });
  }

  function collectPendingSealPayloads() {
    const payloads = [];
    for (const id of pendingSealIds) {
      const item = draftItems.find((row) => row.id === id);
      if (!item) continue;
      payloads.push({
        id,
        title: item.title || t.untitled,
        story: item.story || "",
        photo: Array.isArray(item.photo) ? item.photo : [],
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
        releaseAt: Number(item.releaseAt || 0) || 0,
      });
    }
    return payloads;
  }

  async function cacheSealedMemoriesLocally(payloads = []) {
    for (const item of payloads) {
      const localPayload = {
        id: item.id,
        title: item.title || t.untitled,
        story: item.story || "",
        photo: Array.isArray(item.photo) ? item.photo : [],
        voice: null,
        attachments: Array.isArray(item.attachments) ? item.attachments : [],
        releaseAt: Number(item.releaseAt || 0) || 0,
        tags: [],
      };
      if (typeof onSaveMemory === "function") {
        await onSaveMemory(localPayload);
      } else {
        await createMemory(localPayload);
      }
    }
  }

  async function requestSealTicketFromRingTap() {
    if (!pendingSealIds.length) return;
    setRingTapBusy(true);
    setRingTapError("");
    try {
      const scan = await readNfcScanFull();
      const rawUid = scan?.serialNumber || scan?.text || "";
      const uid = normalizeNfcUidInput(rawUid);
      if (!uid) {
        throw new Error(t.sealRingReadFailed);
      }
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token || "";
      if (!accessToken) {
        throw new Error(t.sealNeedSignIn);
      }
      const res = await fetch("/api/seal/ring-tap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nfc_uid: uid,
          draft_ids: pendingSealIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.seal_ticket) {
        const errorCode = getApiErrorCode(json, res.status);
        throw new Error(getUserFriendlyMessage(errorCode, t));
      }
      setSealTicket(String(json.seal_ticket));
      setFeedbackNotice(t.sealTicketReady);
    } catch (error) {
      setSealTicket("");
      setRingTapError(
        error instanceof Error ? error.message : t.errGenericWarmFallback
      );
    } finally {
      setRingTapBusy(false);
    }
  }

  async function finalizePendingSealsAndExit() {
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    if (!pendingSealIds.length) {
      setSealPromptOpen(false);
      clearSealFlowArm();
      onViewTimeline?.();
      return;
    }
    if (!sealTicket) {
      setFeedback(t.feedbackMissingVerifiedTap);
      return;
    }
    setSaving(true);
    try {
      const draftPayloads = collectPendingSealPayloads();
      if (!draftPayloads.length) {
        throw new Error(t.feedbackSaveFailed);
      }
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token || "";
      if (!accessToken) {
        throw new Error(t.sealNeedSignIn);
      }
      const precheckRes = await fetch("/api/seal/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          seal_ticket: sealTicket,
          draft_ids: pendingSealIds,
          mode: "precheck",
        }),
      });
      const precheckJson = await precheckRes.json().catch(() => ({}));
      if (!precheckRes.ok || !precheckJson?.ok) {
        const errorCode = getApiErrorCode(precheckJson, precheckRes.status);
        throw new Error(getUserFriendlyMessage(errorCode, t));
      }
      const commitRes = await fetch("/api/seal/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          seal_ticket: sealTicket,
          draft_ids: pendingSealIds,
          mode: "commit",
          draft_payloads: draftPayloads,
        }),
      });
      const commitJson = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || !commitJson?.ok) {
        const errorCode = getApiErrorCode(commitJson, commitRes.status);
        throw new Error(getUserFriendlyMessage(errorCode, t));
      }
      await cacheSealedMemoriesLocally(draftPayloads);
      for (const id of pendingSealIds) {
        await removeDraftItem(id);
      }
      await loadDraftBox();
      clearDraftSnapshot();
      setPendingSealIds([]);
      setSealTicket("");
      setSealPromptOpen(false);
      clearSealFlowArm();
      celebrateSealSuccess();
      if (isFirstMemoryMode) {
        markFirstMemoryCompleted();
        setIsFirstMemoryMode(false);
        setShowAdvancedDetails(true);
        void trackFirstRunEvent("first_memory_saved", {
          locale,
          metadata: { mode: "seal_commit" },
        });
      }
      onSaved?.();
      onViewTimeline?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.errGenericWarmFallback;
      setFeedback(message);
      setRingTapError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSecureSave() {
    if (!pendingSealIds.length) return;
    setSecureSaveBusy(true);
    setRingTapError("");
    try {
      const summary = getSecuritySummary();
      if (summary.initialized) {
        await verifyAndTrustCurrentDevice({
          password: securePassword,
          recoveryCode: secureRecoveryCode,
        });
      }
      await persistPendingSeals();
      await loadDraftBox();
      clearDraftSnapshot();
      setPendingSealIds([]);
      setSealTicket("");
      setSealPromptOpen(false);
      clearSealFlowArm();
      celebrateSealSuccess();
      if (isFirstMemoryMode) {
        markFirstMemoryCompleted();
        setIsFirstMemoryMode(false);
        setShowAdvancedDetails(true);
        void trackFirstRunEvent("first_memory_saved", {
          locale,
          metadata: { mode: "secure_save" },
        });
      }
      onSaved?.();
      onViewTimeline?.();
    } catch (error) {
      setRingTapError(error instanceof Error ? error.message : t.errGenericWarmFallback);
    } finally {
      setSecureSaveBusy(false);
    }
  }

  const visibleDraftItems = draftItems.filter(
    (item) => !pendingSealIds.includes(item.id)
  );

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
        {isFirstMemoryMode ? (
          <section style={styles.noticeBox}>
            <p style={styles.noticeTitle}>{t.firstMemoryQuickTitle}</p>
            <p style={styles.hint}>{t.firstMemoryQuickBody}</p>
            {!showAdvancedDetails ? (
              <button
                type="button"
                onClick={() => setShowAdvancedDetails(true)}
                style={styles.secondaryButton}
              >
                {t.firstMemoryShowAdvanced}
              </button>
            ) : null}
          </section>
        ) : null}

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

        {showAdvancedDetails ? (
          <label style={styles.label}>
            {t.timeCapsuleLabel}
            <input
              type="datetime-local"
              value={releaseAtInput}
              onChange={(e) => setReleaseAtInput(e.target.value)}
              style={styles.input}
            />
            <small style={styles.hint}>{t.timeCapsuleHint}</small>
          </label>
        ) : null}

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

        {showAdvancedDetails ? (
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
        ) : null}

        <button type="button" onClick={handleSave} disabled={saving} style={styles.primaryButton}>
          {saving ? t.saving : t.save}
        </button>
        <button type="button" onClick={handleSealNow} disabled={saving} style={styles.secondaryButton}>
          {t.sealNow}
        </button>
        <section style={styles.backlogBox}>
          <p style={styles.backlogTitle}>{t.draftBoxTitle}</p>
          {!visibleDraftItems.length ? (
            <p style={styles.hint}>{t.draftBoxEmpty}</p>
          ) : (
            <>
              <div style={styles.voiceActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  disabled={saving || !selectedDraftIds.length}
                  onClick={() => void sealDraftItems(selectedDraftIds)}
                >
                  {t.draftSealSelected.replace("{n}", String(selectedDraftIds.length))}
                </button>
              </div>
              <ul style={styles.attachmentList}>
                {visibleDraftItems.map((item) => (
                  <li key={item.id} style={styles.attachmentItem}>
                    <label style={styles.toggleLabel}>
                      <input
                        type="checkbox"
                        checked={selectedDraftIds.includes(item.id)}
                        onChange={(e) => {
                          setSelectedDraftIds((prev) =>
                            e.target.checked
                              ? [...prev, item.id]
                              : prev.filter((id) => id !== item.id)
                          );
                        }}
                      />
                      {item.title || t.untitled}
                    </label>
                    <div style={styles.voiceActions}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => editDraftItem(item)}
                      >
                        {t.draftEdit}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => void sealDraftItems([item.id])}
                      >
                        {t.draftSealNow}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {sealPromptOpen ? (
          <section style={styles.sealPromptBox}>
            <p style={styles.sealPromptTitle}>{t.sealPromptTitle}</p>
            <p style={styles.sealPromptBody}>{t.sealPromptBody}</p>
            {sealTicket ? (
              <p style={styles.hint}>{t.sealTicketReady}</p>
            ) : (
              <p style={styles.hint}>{t.sealTouchInstruction}</p>
            )}
            {ringTapError ? <p style={styles.error}>{ringTapError}</p> : null}
            {isIosLikeDevice ? (
              <p style={styles.hint}>{t.sealPromptIosHint}</p>
            ) : null}
            <div style={styles.voiceActions}>
              <button
                type="button"
                onClick={() => void requestSealTicketFromRingTap()}
                style={styles.primaryButton}
                disabled={ringTapBusy || saving || secureSaveBusy}
              >
                {ringTapBusy ? t.sealTouchWorking : t.sealTouchRetry}
              </button>
              <button
                type="button"
                onClick={handleViewTimeline}
                style={styles.primaryButton}
                disabled={!sealTicket || saving || ringTapBusy || secureSaveBusy}
              >
                {t.sealConfirmButton}
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
            <div style={styles.noticeBox}>
              <p style={styles.noticeTitle}>{t.sealFallbackTitle}</p>
              <p style={styles.hint}>{t.sealFallbackBody}</p>
              <input
                type="password"
                placeholder={t.sealFallbackPassword}
                value={securePassword}
                onChange={(e) => setSecurePassword(e.target.value)}
                style={styles.input}
              />
              <input
                type="text"
                placeholder={t.sealFallbackRecovery}
                value={secureRecoveryCode}
                onChange={(e) => setSecureRecoveryCode(e.target.value)}
                style={styles.input}
              />
              <button
                type="button"
                onClick={() => void handleSecureSave()}
                style={styles.secondaryButton}
                disabled={secureSaveBusy || saving || ringTapBusy}
              >
                {secureSaveBusy ? t.sealFallbackWorking : t.sealFallbackAction}
              </button>
            </div>
          </section>
        ) : null}
        {sealSuccessToast ? (
          <section style={styles.successToast} role="status">
            <p style={styles.successToastText}>{sealSuccessToast}</p>
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
        {pendingSealIds.length ? (
          <div style={styles.voiceActions}>
            <button
              type="button"
              onClick={undoPendingSeal}
              style={styles.secondaryButton}
            >
              {t.undoSealAction}
            </button>
          </div>
        ) : null}
        <p style={styles.hint}>
          {t.privacyHint}
        </p>
        <section style={styles.backlogBox}>
          <p style={styles.backlogTitle}>{t.backlogTitle}</p>
          <ul style={styles.backlogList}>
            <li>{t.backlogTimeCapsule}</li>
            <li>{t.backlogTags}</li>
            <li>{t.backlogGeo}</li>
          </ul>
        </section>
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
  noticeBox: {
    border: "1px solid #5a3b30",
    borderRadius: 10,
    padding: 10,
    display: "grid",
    gap: 8,
    background: "rgba(26, 21, 18, 0.45)",
  },
  noticeTitle: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 13,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
    fontSize: 13,
  },
  successToast: {
    border: "1px solid rgba(125, 158, 133, 0.45)",
    borderRadius: 12,
    background: "rgba(28, 45, 34, 0.52)",
    padding: "10px 12px",
  },
  successToastText: {
    margin: 0,
    color: "#d4f0dc",
    fontSize: 13,
    lineHeight: 1.45,
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
  backlogBox: {
    marginTop: 2,
    border: "1px dashed #5a3b30",
    borderRadius: 10,
    padding: "10px 12px",
    background: "rgba(26, 21, 18, 0.38)",
    display: "grid",
    gap: 6,
  },
  backlogTitle: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  backlogList: {
    margin: 0,
    paddingLeft: 18,
    color: "#d9c3b3",
    fontSize: 12,
    lineHeight: 1.5,
    display: "grid",
    gap: 4,
  },
};
