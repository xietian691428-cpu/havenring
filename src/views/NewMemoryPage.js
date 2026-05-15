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
import { useSealArmCountdown } from "../hooks/useSealArmCountdown";
import { getNewMemoryPageCopy } from "../content/havenCopy";

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 6;
const MAX_FILE_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_MB = 10;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const DRAFT_STORAGE_KEY = "haven.new_memory_draft";
const STORY_SOFT_MAX = 8000;
const SECURE_SAVE_UPSELL_KEY = "haven.newMemory.postSecureUpgradeNudge.v1";

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
 * Locale-aware copy for New Memory; English strings come from `havenCopy`.
 * @param {string} locale
 * @param {"ios"|"android"|"other"} platform
 * @param {Record<string, string>} t
 */
function buildNewMemoryPageCopy(locale, platform, t) {
  const en = getNewMemoryPageCopy(platform);
  if (locale === "en") return en;
  return {
    ...en,
    topBarTitle: t.navComposerTitle,
    topBarSealing: t.topBarSealing,
    heroTitle: t.heroSealTitle,
    heroSubtitle:
      platform === "ios"
        ? t.heroSealSubtitleIos
        : platform === "android"
          ? t.heroSealSubtitleAndroid
          : t.heroSealSubtitleOther,
    sealPrimaryCta: t.sealPrimaryShort,
    sealPrimaryCtaReady: t.sealPrimaryCtaReady,
    sealPrimaryCtaWaiting: t.sealPrimaryCtaWaiting,
    sealPrimaryHint:
      platform === "ios"
        ? t.sealPrimaryHintIos
        : platform === "android"
          ? t.sealPrimaryHintAndroid
          : t.sealPrimaryHintOther,
    saveSecureLink:
      platform === "ios"
        ? t.saveSecureLinkIos
        : platform === "android"
          ? t.saveSecureLinkAndroid
          : t.saveSecureLinkOther,
    footerNeedDraft: t.footerNeedDraft,
    footerSealInvite: t.footerSealInvite,
    footerReadySeal:
      platform === "ios"
        ? t.footerReadySealIos
        : platform === "android"
          ? t.footerReadySealAndroid
          : t.footerReadySeal,
    footerWaitingRing:
      platform === "ios"
        ? t.footerWaitingRingIos
        : platform === "android"
          ? t.footerWaitingRingAndroid
          : t.footerWaitingRing,
    footerOfflineSeal: t.footerOfflineSeal,
    cancelSealFlow: t.cancelSealFlow,
    sealWaitingBannerTitle: t.sealWaitingBannerTitle,
    sealWaitingBannerBody:
      platform === "ios"
        ? t.sealWaitingBannerBodyIos
        : platform === "android"
          ? t.sealWaitingBannerBodyAndroid
          : t.sealWaitingBannerBodyOther,
    secureSaveMessage: t.secureSaveToast,
    sealAfterSecureSaveCta: t.sealAfterSecureSaveCta,
    securityDeleteNote:
      platform === "ios"
        ? t.securityDeleteNoteIos
        : platform === "android"
          ? t.securityDeleteNoteAndroid
          : t.securityDeleteNoteOther,
    storyRequiredHint: t.storyRequiredHint,
    sealCountdownPrefix: t.sealCountdownPrefix,
    upgradeShort: en.upgradeShort,
    upgradeCta: en.upgradeCta,
    upgradeModalTitle: en.upgradeModalTitle,
    upgradeModalBody: en.upgradeModalBody,
    upgradeModalCloudDisclaimer: en.upgradeModalCloudDisclaimer,
    upgradeModalDismiss: en.upgradeModalDismiss,
    upgradeModalSubscribe: en.upgradeModalSubscribe,
    upgradeModalPricingHint: en.upgradeModalPricingHint,
  };
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
  onOpenSettings,
  locale = "en",
  userEntitlements = getFreeEntitlements(),
  initialEditMemory = null,
}) {
  const t = NEW_MEMORY_PAGE_CONTENT[locale] || NEW_MEMORY_PAGE_CONTENT.en;
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const pageCopy = useMemo(
    () => buildNewMemoryPageCopy(locale, platform, t),
    [locale, platform, t]
  );
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
  const [secureSaveToast, setSecureSaveToast] = useState(false);
  const [isFirstMemoryMode, setIsFirstMemoryMode] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine
  );
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const sealArmHadTimeRef = useRef(false);
  const { remainingMs: sealRemainingMs, remainingLabel: sealRemainingLabel } =
    useSealArmCountdown(sealPromptOpen);

  const storyTextareaRef = useRef(null);
  const photoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    // Hydrate composer once per memory id.
    const m = initialEditMemory;
    if (!m?.id) return undefined;
    queueMicrotask(() => {
      setTitle(String(m.title || ""));
      setStory(String(m.story || ""));
      const ra = Number(m.releaseAt || 0) || 0;
      setReleaseAtInput(ra ? new Date(ra).toISOString().slice(0, 16) : "");
      const ph = Array.isArray(m.photo) ? m.photo : m.photo ? [m.photo] : [];
      setPhotos(ph);
      setAttachments(Array.isArray(m.attachments) ? m.attachments : []);
      setEditingDraftId(String(m.id));
      setFeedback("");
    });
    return undefined;
  }, [initialEditMemory, initialEditMemory?.id]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item?.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      storyTextareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
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
    if (!secureSaveToast) return undefined;
    const timer = window.setTimeout(() => setSecureSaveToast(false), 7000);
    return () => window.clearTimeout(timer);
  }, [secureSaveToast]);

  useEffect(() => {
    if (sealPromptOpen && sealRemainingMs > 0) {
      sealArmHadTimeRef.current = true;
    }
    if (!sealPromptOpen) {
      sealArmHadTimeRef.current = false;
      return undefined;
    }
    if (sealRemainingMs > 0) return undefined;
    if (!sealArmHadTimeRef.current) return undefined;
    sealArmHadTimeRef.current = false;
    clearSealPrepState();
    setSealPromptOpen(false);
    setFeedbackNotice(t.sealArmExpired);
    return undefined;
  }, [sealPromptOpen, sealRemainingMs, t.sealArmExpired]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const id = "haven-nfc-pulse-keyframes";
    if (document.getElementById(id)) return undefined;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
@keyframes havenNfcPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 166, 122, 0.45), 0 10px 28px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 0 10px rgba(217, 166, 122, 0), 0 12px 32px rgba(0,0,0,0.4); }
}
@keyframes havenSealBtnSpin {
  to { transform: rotate(360deg); }
}`;
    document.head.appendChild(el);
    return undefined;
  }, []);

  useEffect(() => {
    const firstDone = isFirstMemoryCompleted();
    const timer = window.setTimeout(() => {
      setIsFirstMemoryMode(!firstDone);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initialEditMemory?.id) return;
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
  }, [t.feedbackDraftRestored, initialEditMemory?.id]);

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
    const { openSealPromptOnSuccess = false } = options;
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
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setSecureSaveToast(false);
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
        setSealPromptOpen(true);
        setFeedbackNotice(t.feedbackReadyToSeal);
      } else if (typeof onSaveMemory === "function") {
        setFeedback("");
        setSecureSaveToast(true);
        if (!canSealWithRing && typeof window !== "undefined") {
          try {
            if (!window.localStorage.getItem(SECURE_SAVE_UPSELL_KEY)) {
              window.localStorage.setItem(SECURE_SAVE_UPSELL_KEY, "1");
              window.setTimeout(() => setUpgradeModalOpen(true), 900);
            }
          } catch {
            /* ignore */
          }
        }
      } else {
        setFeedback(t.feedbackSaved);
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
    setSecureSaveToast(false);
    setUpgradeModalOpen(false);
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
      setUpgradeModalOpen(true);
      return;
    }
    const draftId = String(editingDraftId || "").trim();
    if (!draftId) {
      setFeedbackNotice(t.feedbackSealPrepNeedDraftSave);
      return;
    }
    setSaveDialog({ open: false, status: "saving", errorMessage: "" });
    setRingTapError("");
    primeSealPrepAfterDraftPersisted(draftId);
    setSealPromptOpen(true);
    setFeedbackNotice(t.feedbackReadyToSeal);
  }

  async function handleSealNow() {
    if (!canSealWithRing) {
      setSealPromptOpen(false);
      setUpgradeModalOpen(true);
      return;
    }
    await handleSave({ openSealPromptOnSuccess: true });
  }

  async function handleSaveSecurelyFallback() {
    await handleSave({ openSealPromptOnSuccess: false });
  }

  function handleCancelSeal() {
    clearSealPrepState();
    setSealPromptOpen(false);
    setRingTapError("");
    setFeedback("");
  }

  function handleHeroPrimaryClick() {
    if (saving || sealPromptOpen) return;
    if (!canSealWithRing) {
      setUpgradeModalOpen(true);
      return;
    }
    void handleSealNow();
  }

  function sealPrimaryLabel() {
    if (sealPromptOpen) return pageCopy.sealPrimaryCtaWaiting;
    if (editingDraftId) return pageCopy.sealPrimaryCtaReady;
    return pageCopy.sealPrimaryCta;
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

  function footerStatusLine() {
    if (saving) return t.footerSaving;
    if (sealPromptOpen) {
      return networkOnline ? pageCopy.footerWaitingRing : pageCopy.footerOfflineSeal;
    }
    if (secureSaveToast) {
      return canSealWithRing
        ? pageCopy.footerReadySeal
        : `${pageCopy.upgradeShort} ${pageCopy.upgradeCta}`;
    }
    if (!canSealWithRing) {
      if (hasDraftContent) return `${pageCopy.upgradeShort} ${pageCopy.upgradeCta}`;
      return "\u00a0";
    }
    if (editingDraftId) return pageCopy.footerReadySeal;
    if (hasDraftContent) return pageCopy.footerSealInvite;
    return "\u00a0";
  }

  return (
    <main style={styles.page}>
      <header style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.topBarBtn}>
          ← {t.back}
        </button>
        <h1 style={styles.topBarTitle}>
          {sealPromptOpen ? pageCopy.topBarSealing : pageCopy.topBarTitle}
        </h1>
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
        <section style={styles.heroSeal} aria-labelledby="haven-hero-seal-title">
          <h2 id="haven-hero-seal-title" style={styles.heroTitle}>
            {pageCopy.heroTitle}
          </h2>
          <p style={styles.heroSubtitle}>{pageCopy.heroSubtitle}</p>
          {sealPromptOpen ? (
            <div style={styles.sealInlineBanner} role="status" aria-live="polite">
              <p style={styles.sealInlineTitle}>{pageCopy.sealWaitingBannerTitle}</p>
              <p style={styles.sealInlineBody}>{pageCopy.sealWaitingBannerBody}</p>
              {sealPromptOpen && sealRemainingMs > 0 ? (
                <p style={styles.sealInlineMeta}>
                  {pageCopy.sealCountdownPrefix} <strong>{sealRemainingLabel}</strong>
                </p>
              ) : null}
              {!networkOnline ? <p style={styles.hint}>{pageCopy.footerOfflineSeal}</p> : null}
              {ringTapError ? <p style={styles.error}>{ringTapError}</p> : null}
              <button type="button" onClick={handleCancelSeal} style={styles.cancelSealBtn}>
                {pageCopy.cancelSealFlow}
              </button>
            </div>
          ) : null}
          {secureSaveToast ? (
            <div style={styles.secureToastStack} role="status" aria-live="polite">
              <p style={styles.secureToastBanner}>{pageCopy.secureSaveMessage}</p>
              <button
                type="button"
                onClick={() => {
                  if (!canSealWithRing) {
                    setUpgradeModalOpen(true);
                    return;
                  }
                  void handleSealNow();
                }}
                disabled={saving || sealPromptOpen}
                style={styles.secureToastSealBtn}
              >
                {pageCopy.sealAfterSecureSaveCta}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleHeroPrimaryClick}
            disabled={saving || sealPromptOpen}
            aria-busy={saving || sealPromptOpen}
            aria-label={`${sealPrimaryLabel()}. ${pageCopy.sealPrimaryHint}`}
            style={{
              ...styles.heroSealButton,
              ...(sealPromptOpen
                ? styles.heroSealButtonBusy
                : canSealWithRing
                  ? styles.heroSealButtonActive
                  : {
                      ...styles.heroSealButtonMuted,
                      cursor: "pointer",
                      opacity: 0.82,
                    }),
            }}
          >
            {sealPromptOpen ? <span style={styles.heroSealSpinner} aria-hidden /> : null}
            {sealPrimaryLabel()}
          </button>
          <p style={styles.heroSealHint}>{pageCopy.sealPrimaryHint}</p>
          {!canSealWithRing ? (
            <p style={styles.heroUpgrade}>
              {pageCopy.upgradeShort} {pageCopy.upgradeCta}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveSecurelyFallback()}
            disabled={saving}
            style={styles.saveSecureLink}
          >
            {pageCopy.saveSecureLink}
          </button>
        </section>

        <section style={styles.editorSection} aria-labelledby="haven-editor-heading">
          <h3 id="haven-editor-heading" style={styles.editorHeading}>
            {t.editorSectionTitle}
          </h3>
          <label style={styles.srOnly} htmlFor="haven-memory-story">
            {t.storyLabel}
          </label>
          <p style={styles.storyRequiredNote}>{pageCopy.storyRequiredHint}</p>
          <textarea
            ref={storyTextareaRef}
            id="haven-memory-story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={8}
            placeholder={t.storyPlaceholder}
            style={styles.textareaEditor}
          />
          <p style={styles.charCount}>
            {t.storyCharCount.replace("{n}", String(story.length))}
            {story.length > STORY_SOFT_MAX ? ` — ${t.storyCharSoftMaxWarn}` : ""}
          </p>

          <p style={styles.feedbackInline}>{feedback || "\u00a0"}</p>

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
        </section>
      </div>

      <footer style={styles.statusFooter}>
        <p style={styles.statusFooterText} role="status" aria-live="polite">
          {footerStatusLine()}
        </p>
        {!sealPromptOpen && !saving ? (
          <p style={styles.footerSecurityNote}>{pageCopy.securityDeleteNote}</p>
        ) : null}
      </footer>

      {upgradeModalOpen ? (
        <div
          style={styles.upgradeModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="haven-upgrade-seal-title"
          onClick={() => setUpgradeModalOpen(false)}
        >
          <section
            style={styles.upgradeModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="haven-upgrade-seal-title" style={styles.upgradeModalTitle}>
              {pageCopy.upgradeModalTitle}
            </h2>
            <p style={styles.upgradeModalBody}>{pageCopy.upgradeModalBody}</p>
            <p style={styles.upgradeModalCloud}>{pageCopy.upgradeModalCloudDisclaimer}</p>
            <p style={styles.upgradeModalPricing}>{pageCopy.upgradeModalPricingHint}</p>
            <div style={styles.upgradeModalActions}>
              <button
                type="button"
                onClick={() => {
                  setUpgradeModalOpen(false);
                  onOpenSettings?.();
                }}
                style={styles.upgradeModalSubscribe}
              >
                {pageCopy.upgradeModalSubscribe}
              </button>
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                style={styles.upgradeModalDismiss}
              >
                {pageCopy.upgradeModalDismiss}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {saveDialog.open && saveDialog.status === "error" ? (
        <SaveToHavenDialog
          locale={locale}
          open
          status="error"
          errorMessage={saveDialog.errorMessage}
          onSealNow={canSealWithRing ? handleOpenSealPrompt : () => setUpgradeModalOpen(true)}
          onCreateAnother={handleCreateAnother}
        />
      ) : null}
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
    minHeight: 44,
    boxSizing: "border-box",
    padding: "6px 12px 8px",
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
  heroSeal: {
    display: "grid",
    gap: 12,
    padding: "18px 16px 20px",
    borderRadius: 18,
    border: "1px solid rgba(90, 72, 62, 0.55)",
    background: "linear-gradient(165deg, rgba(48, 36, 30, 0.55), rgba(18, 14, 12, 0.92))",
    textAlign: "center",
  },
  heroTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    color: "#faf6f1",
  },
  heroSubtitle: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(232, 216, 206, 0.88)",
    maxWidth: 420,
    justifySelf: "center",
  },
  sealInlineBanner: {
    display: "grid",
    gap: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(217, 166, 122, 0.4)",
    background: "rgba(40, 30, 24, 0.65)",
    textAlign: "left",
  },
  sealInlineTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 650,
    color: "#faf6f1",
  },
  sealInlineBody: {
    margin: 0,
    fontSize: 13,
    color: "#d9c9bf",
    lineHeight: 1.45,
  },
  sealInlineMeta: {
    margin: 0,
    fontSize: 12,
    color: "rgba(210, 200, 192, 0.92)",
  },
  cancelSealBtn: {
    marginTop: 4,
    alignSelf: "start",
    border: "1px solid rgba(120, 100, 90, 0.75)",
    background: "rgba(28, 22, 18, 0.5)",
    color: "#e8d8ce",
    borderRadius: 10,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    WebkitTapHighlightColor: "transparent",
  },
  secureToastBanner: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(96, 140, 110, 0.22)",
    border: "1px solid rgba(140, 190, 150, 0.35)",
    color: "#d8eedc",
    fontSize: 14,
    lineHeight: 1.45,
    textAlign: "center",
  },
  secureToastStack: {
    display: "grid",
    gap: 10,
    justifyItems: "center",
    width: "100%",
  },
  secureToastSealBtn: {
    border: "1px solid rgba(140, 190, 150, 0.55)",
    background: "rgba(40, 56, 44, 0.65)",
    color: "#eaf6ec",
    borderRadius: 12,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 650,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  heroSealButton: {
    width: "100%",
    maxWidth: 400,
    justifySelf: "center",
    borderRadius: 18,
    minHeight: 56,
    padding: "16px 20px",
    fontWeight: 800,
    fontSize: 18,
    lineHeight: 1.2,
    cursor: "pointer",
    border: "1px solid rgba(90, 72, 62, 0.95)",
    WebkitTapHighlightColor: "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSealButtonActive: {
    background: "linear-gradient(180deg, #e8b892, #c7976a)",
    color: "#1a1411",
    animation: "havenNfcPulse 2.2s ease-in-out infinite",
  },
  heroSealButtonMuted: {
    background: "rgba(40, 34, 30, 0.95)",
    color: "rgba(232, 216, 206, 0.55)",
    cursor: "not-allowed",
  },
  heroSealButtonBusy: {
    background: "rgba(52, 42, 36, 0.96)",
    color: "rgba(248, 239, 231, 0.92)",
    cursor: "wait",
  },
  heroSealSpinner: {
    display: "inline-block",
    width: 18,
    height: 18,
    marginRight: 10,
    flexShrink: 0,
    borderRadius: "50%",
    border: "2px solid rgba(248, 239, 231, 0.25)",
    borderTopColor: "rgba(248, 239, 231, 0.95)",
    animation: "havenSealBtnSpin 650ms linear infinite",
  },
  heroSealHint: {
    margin: 0,
    fontSize: 13,
    color: "rgba(210, 196, 186, 0.75)",
  },
  heroUpgrade: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(224, 206, 194, 0.78)",
  },
  saveSecureLink: {
    margin: "4px auto 0",
    border: "none",
    background: "transparent",
    color: "rgba(200, 188, 178, 0.82)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    WebkitTapHighlightColor: "transparent",
  },
  editorSection: {
    display: "grid",
    gap: 12,
    paddingTop: 8,
  },
  editorHeading: {
    margin: 0,
    fontSize: 13,
    fontWeight: 650,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "rgba(224, 206, 194, 0.65)",
  },
  storyRequiredNote: {
    margin: "-2px 0 6px",
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(200, 188, 178, 0.72)",
    textAlign: "left",
  },
  textareaEditor: {
    width: "100%",
    minHeight: 160,
    boxSizing: "border-box",
    border: "1px solid rgba(72, 58, 50, 0.95)",
    borderRadius: 16,
    background: "rgba(22, 18, 16, 0.92)",
    color: "#f8efe7",
    padding: "14px 14px",
    fontSize: 16,
    lineHeight: 1.55,
    resize: "vertical",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  charCount: {
    margin: 0,
    fontSize: 12,
    color: "rgba(200, 188, 178, 0.65)",
    textAlign: "right",
  },
  scrollBody: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 96px",
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
  statusFooter: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    display: "grid",
    gap: 4,
    padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))",
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    borderTop: "1px solid rgba(55, 44, 38, 0.9)",
    background: "linear-gradient(180deg, rgba(22, 18, 16, 0.88), rgba(14, 12, 11, 0.98))",
    backdropFilter: "blur(10px)",
  },
  statusFooterText: {
    margin: 0,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(224, 206, 194, 0.88)",
  },
  footerSecurityNote: {
    margin: 0,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 1.4,
    color: "rgba(190, 178, 168, 0.62)",
  },
  upgradeModalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 45,
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "rgba(6, 5, 5, 0.55)",
    backdropFilter: "blur(6px)",
  },
  upgradeModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    border: "1px solid rgba(90, 72, 62, 0.85)",
    background: "rgba(20, 16, 14, 0.98)",
    padding: 20,
    display: "grid",
    gap: 12,
    boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
  },
  upgradeModalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 650,
    color: "#faf6f1",
  },
  upgradeModalBody: {
    margin: "0 0 8px",
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(224, 206, 194, 0.9)",
  },
  upgradeModalCloud: {
    margin: "0 0 10px",
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(190, 178, 168, 0.82)",
  },
  upgradeModalPricing: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(190, 178, 168, 0.75)",
  },
  upgradeModalActions: {
    display: "grid",
    gap: 10,
    marginTop: 4,
  },
  upgradeModalSubscribe: {
    borderRadius: 12,
    border: "1px solid rgba(196, 149, 106, 0.85)",
    background: "linear-gradient(180deg, #e8b892, #c7976a)",
    color: "#1a1411",
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    justifySelf: "stretch",
    WebkitTapHighlightColor: "transparent",
  },
  upgradeModalDismiss: {
    marginTop: 0,
    borderRadius: 12,
    border: "1px solid rgba(120, 100, 90, 0.75)",
    background: "rgba(36, 28, 24, 0.85)",
    color: "#f0e4dc",
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    justifySelf: "stretch",
    WebkitTapHighlightColor: "transparent",
  },
};
