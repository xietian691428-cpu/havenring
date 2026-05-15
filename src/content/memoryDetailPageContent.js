import { getMemoryDetailPageCopy } from "./havenCopy";

/**
 * Locale bundles: non-EN overrides for legacy keys only.
 * English memory-detail copy is fully defined in `havenCopy` (`HAVEN_MEMORY_DETAIL_EN` + `getMemoryDetailPageCopy`).
 */

const EN = {
  brand: "Memory",
  defaultTitle: "Memory details",
  back: "Back to timeline",
  loading: "Loading memory...",
  noMemory: "Memory not found.",
  previous: "Previous",
  next: "Next",
  noPhotos: "No photos in this memory.",
  storyTitle: "Story",
  noStory: "No written story.",
  attachmentsTitle: "Attachments",
  noAttachments: "No attachments.",
  downloadAttachment: "Download file",
  untitledAttachment: "Attachment",
  capsuleLockedTitle: "Time capsule is still locked",
  capsuleLockedBody: "This capsule unlocks at {time}. Please come back then.",
  capsuleTypeTime: "Time capsule",
  capsuleTypeNormal: "Normal memory",
};

export const MEMORY_DETAIL_PAGE_CONTENT = {
  en: EN,
  fr: { ...EN, brand: "Souvenir", defaultTitle: "Details du souvenir", back: "Retour a la timeline", loading: "Chargement du souvenir...", noMemory: "Souvenir introuvable.", previous: "Precedent", next: "Suivant", noPhotos: "Aucune photo dans ce souvenir.", storyTitle: "Histoire", noStory: "Aucun texte ecrit." },
  es: { ...EN, brand: "Recuerdo", defaultTitle: "Detalles del recuerdo", back: "Volver a la timeline", loading: "Cargando recuerdo...", noMemory: "Recuerdo no encontrado.", previous: "Anterior", next: "Siguiente", noPhotos: "No hay fotos en este recuerdo.", storyTitle: "Historia", noStory: "Sin historia escrita." },
  de: { ...EN, brand: "Erinnerung", defaultTitle: "Erinnerungsdetails", back: "Zuruck zur Timeline", loading: "Erinnerung wird geladen...", noMemory: "Erinnerung nicht gefunden.", previous: "Zuruck", next: "Weiter", noPhotos: "Keine Fotos in dieser Erinnerung.", storyTitle: "Geschichte", noStory: "Keine geschriebene Geschichte." },
  it: { ...EN, brand: "Ricordo", defaultTitle: "Dettagli del ricordo", back: "Torna alla timeline", loading: "Caricamento ricordo...", noMemory: "Ricordo non trovato.", previous: "Precedente", next: "Successivo", noPhotos: "Nessuna foto in questo ricordo.", storyTitle: "Storia", noStory: "Nessuna storia scritta." },
};

/**
 * @param {string} locale
 * @param {"ios"|"android"|"other"} platform
 */
export function getMemoryDetailUiCopy(locale, platform) {
  const base = getMemoryDetailPageCopy(platform);
  if (!locale || locale === "en") return { ...base, back: base.topBackLabel };
  const loc = MEMORY_DETAIL_PAGE_CONTENT[locale] || MEMORY_DETAIL_PAGE_CONTENT.en;
  return {
    ...base,
    ...loc,
    topBackLabel: loc.back || base.topBackLabel,
    defaultTitle: loc.defaultTitle || base.defaultTitle,
    loading: loc.loading || base.loading,
    noMemory: loc.noMemory || base.noMemory,
    previous: loc.previous || base.previous,
    next: loc.next || base.next,
    noPhotos: loc.noPhotos || base.noPhotos,
    storyHeading: loc.storyTitle || base.storyHeading,
    noStory: loc.noStory || base.noStory,
    attachmentsTitle: loc.attachmentsTitle || base.attachmentsTitle,
    noAttachments: loc.noAttachments || base.noAttachments,
    downloadAttachment: loc.downloadAttachment || base.downloadAttachment,
    untitledAttachment: loc.untitledAttachment || base.untitledAttachment,
    capsuleLockedTitle: loc.capsuleLockedTitle || base.capsuleLockedTitle,
    capsuleLockedBody: loc.capsuleLockedBody || base.capsuleLockedBody,
    capsuleTypeTime: loc.capsuleTypeTime || base.capsuleTypeTime,
    metaSealed: loc.metaSealed || base.metaSealed,
    metaSealedViaRing: loc.metaSealedViaRing || base.metaSealedViaRing,
    metaSealedOther: loc.metaSealedOther || base.metaSealedOther,
    deleteConfirmTitle: loc.deleteConfirmTitle || base.deleteConfirmTitle,
    deleteConfirmBody: loc.deleteConfirmBody || base.deleteConfirmBody,
    deleteConfirmConfirm: loc.deleteConfirmConfirm || base.deleteConfirmConfirm,
    deleteConfirmCancel: loc.deleteConfirmCancel || base.deleteConfirmCancel,
    exportChooseFormatTitle: loc.exportChooseFormatTitle || base.exportChooseFormatTitle,
    exportFormatJsonFull: loc.exportFormatJsonFull || base.exportFormatJsonFull,
    exportFormatJsonLite: loc.exportFormatJsonLite || base.exportFormatJsonLite,
    exportContinueToVerify: loc.exportContinueToVerify || base.exportContinueToVerify,
    exportPreparing: loc.exportPreparing || base.exportPreparing,
    exportSuccess: loc.exportSuccess || base.exportSuccess,
    e2eeFooter: loc.e2eeFooter || base.e2eeFooter,
    footerDeleteHint: loc.footerDeleteHint || base.footerDeleteHint,
    sealedOn: loc.sealedOn || base.sealedOn,
    capsuleTypeNormal: loc.capsuleTypeNormal || base.capsuleTypeNormal,
  };
}

