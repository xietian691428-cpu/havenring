import {
  HAVEN_EN_LAYERED_CORE_LINE,
  HAVEN_EN_HOW_HAVEN_WORKS_ROWS,
  HAVEN_EN_QUICK_GUIDE_ONE_LINE,
  HAVEN_EN_QUICK_GUIDE_SUMMARY_LINES,
  havenCopy,
  mapHowHavenRowsToRingsQuickGuide,
} from "./havenCopy";

const EN = {
  brand: "Haven",
  title: "My Rings",
  subtitle:
    "Manage your rings and how they work with Face ID. Your ring is a fast ritual key — not the only way to keep your account safe.",
  layeredCoreLine: HAVEN_EN_LAYERED_CORE_LINE,
  emptyTitle: "No rings yet",
  emptyBody:
    "Link a Haven NFC ring to unlock the seal ritual on Haven Plus, or keep using Save Securely without a ring.",
  emptyTrialHint:
    "Link your first ring to start a 30-day Haven Plus trial where offered — Seal with Ring is included during the trial.",
  bindFirstRingCta: "Bind your first ring",
  addAnotherRingSecondary: "Add another ring",
  howHavenToggleShow: "How your ring works with Face ID",
  howHavenToggleHide: "Hide guide",
  addRing: "Add a ring",
  maxRings: "Up to five rings per device registry.",
  limitReachedHint:
    "Ring limit reached (5). Revoke one ring before adding another.",
  ringSince: "Added on",
  boundAt: "Bound at",
  lastUsedAt: "Last used",
  linkedMemories: "Linked memories",
  ringStatusActive: "Active",
  neverUsed: "Never used yet",
  revoke: "Revoke ring",
  rename: "Rename",
  renamePrompt: "Rename this ring",
  revoking: "Revoking…",
  syncLoading: "Loading cloud ring bindings…",
  syncFailed: "Could not load cloud ring data. Check sign-in/network and retry.",
  retrySync: "Retry",
  verifyTitle: "Secondary verification required",
  verifyHint:
    "Before revoking, confirm with your device password or a recovery code. This matches how Haven protects other high-risk actions.",
  verifyPassword: "Device password",
  verifyRecovery: "Recovery code",
  verifyConfirm: "Verify and revoke",
  verifyCancel: "Cancel",
  verifyError: "Verification failed. Check password/code and retry.",
  revokePrepTitle: "Revoke this ring?",
  revokePrepBody:
    "This ring will stop working for login and sealing right away. Your memories stay encrypted in your account; sealed items remain available as securely saved memories without this ring.",
  revokePrepContinue: "Continue to verification",
  revokePrepCancel: "Cancel",
  revokeWarning:
    "You are about to complete revoke after verification. This ring will no longer unlock Haven or finish new seals.",
  revokeDone: "Ring revoked successfully.",
  revokeFailed: "Could not revoke this ring.",
  cloudSignInRequired: "Sign in first to manage cloud-linked rings.",
  cloudSignInAction: "Open Settings to sign in",
  unknownDate: "—",
  addRingHeaderCta: "+ Add Ring",
  openSetup: "+ Add Ring",
  settingsLink: "Privacy & backup",
  ringsFooterTitle: "Lost a ring?",
  ringsFooterBody:
    "From any signed-in device, open My Rings and revoke the ring after Face ID or your device lock. Your memories stay encrypted in your account.",
  ringsFooterHelpCta: "Open full Help guide",
  privacyNote:
    "Every trusted ring is equal: any one can be used for quick login and sealing. Your account stays the owner of all memories.",
  iosUsageHint:
    "Touch your ring to quickly access your sanctuary. Advanced option: ring link rewrite is available on Android devices.",
  androidUsageHint: "You can also rewrite the ring link here when needed.",
  rewriteLinkAction: "Rewrite ring link",
  ringRequiredLabel: "Ring Required:",
  recommendedLabel: "Recommended:",
  actionLabel: "What you want to do",
  quickGuideTitle: havenCopy.rings.howHavenWorksTitle,
  quickGuideIntro: HAVEN_EN_LAYERED_CORE_LINE,
  quickGuideSummaryLines: [...HAVEN_EN_QUICK_GUIDE_SUMMARY_LINES],
  quickGuideLearnMore: "Learn more",
  quickGuideShowLess: "Show less",
  quickGuideOneLine: HAVEN_EN_QUICK_GUIDE_ONE_LINE,
  quickGuideRows: mapHowHavenRowsToRingsQuickGuide(HAVEN_EN_HOW_HAVEN_WORKS_ROWS),
};

export const RINGS_PAGE_CONTENT = {
  en: EN,
  fr: {
    ...EN,
    title: "Mes bagues",
    subtitle: "Cles d'acces rapide. Chaque bague est egale.",
    emptyTitle: "Aucune bague enregistree",
    emptyBody: "Ajoutez vos bagues NFC. Au moins deux sont recommandees.",
    addRing: "Ajouter une bague",
    openSetup: "+ Ajouter une bague",
    settingsLink: "Confidentialite et sauvegarde",
    ringRequiredLabel: "Bague requise :",
    recommendedLabel: "Recommandé :",
    actionLabel: "Ce que vous voulez faire",
    quickGuideTitle: "Comment Haven fonctionne",
    quickGuideIntro:
      "Face ID protège votre compte. Votre bague vous offre un accès rapide et un rituel spécial pour vos souvenirs les plus précieux.",
    quickGuideSummaryLines: [
      "Ouverture quotidienne : touchez votre bague pour le chemin le plus rapide, ou utilisez Face ID.",
      "Notes rapides et brouillons : commencez simplement à écrire.",
      "Sceller : seule une bague de confiance peut compléter le rituel.",
    ],
    quickGuideLearnMore: "En savoir plus",
    quickGuideShowLess: "Afficher moins",
    quickGuideOneLine:
      "La bague est votre clé magique pour la vitesse et le rituel. Face ID protège tout.",
    quickGuideRows: [
      {
        action: "Ouvrir l'application au quotidien",
        required: "Non (fortement recommandé)",
        way: "Touchez votre bague (le plus rapide) ou utilisez Face ID",
      },
      {
        action: "Notes rapides et brouillons",
        required: "Non",
        way: "Commencez simplement à écrire",
      },
      {
        action: "Sceller un souvenir important",
        required: "Oui",
        way: "Seal with Ring (requis)",
      },
      {
        action: "Ajouter ou retirer une bague",
        required: "Oui",
        way: "Confirmation Face ID",
      },
      {
        action: "Exporter des données",
        required: "Oui",
        way: "Confirmation Face ID",
      },
      {
        action: "Supprimer des souvenirs scellés",
        required: "Oui",
        way: "Face ID + confirmation supplémentaire",
      },
      {
        action: "Gérer une bague perdue",
        required: "Non",
        way: "Révoquez depuis tout appareil connecté",
      },
    ],
  },
  es: {
    ...EN,
    title: "Mis anillos",
    subtitle: "Accesos rapidos. Cada anillo vale igual.",
    emptyTitle: "Sin anillos registrados",
    addRing: "Anadir anillo",
    openSetup: "+ Añadir anillo",
    settingsLink: "Privacidad y copia",
    ringRequiredLabel: "¿Anillo requerido?:",
    recommendedLabel: "Recomendado:",
    actionLabel: "Qué quieres hacer",
    quickGuideTitle: "Cómo funciona Haven",
    quickGuideIntro:
      "Face ID protege tu cuenta. Tu anillo te da acceso rápido y un ritual especial para tus recuerdos más valiosos.",
    quickGuideSummaryLines: [
      "A diario: toca el anillo para el camino más rápido, o usa Face ID.",
      "Notas rápidas y borradores: empieza a escribir.",
      "Sellar: solo un anillo de confianza puede completar el ritual.",
    ],
    quickGuideLearnMore: "Saber más",
    quickGuideShowLess: "Mostrar menos",
    quickGuideOneLine:
      "El anillo es tu llave mágica para velocidad y ceremonia. Face ID lo mantiene seguro.",
    quickGuideRows: [
      {
        action: "Abrir la app a diario",
        required: "No (muy recomendado)",
        way: "Toca tu anillo (más rápido) o usa Face ID",
      },
      {
        action: "Notas rápidas y borradores",
        required: "No",
        way: "Empieza a escribir",
      },
      {
        action: "Sellar un recuerdo importante",
        required: "Sí",
        way: "Seal with Ring (requerido)",
      },
      {
        action: "Añadir o quitar un anillo",
        required: "Sí",
        way: "Confirmación con Face ID",
      },
      {
        action: "Exportar datos",
        required: "Sí",
        way: "Confirmación con Face ID",
      },
      {
        action: "Eliminar recuerdos sellados",
        required: "Sí",
        way: "Face ID + confirmación extra",
      },
      {
        action: "Gestionar un anillo perdido",
        required: "No",
        way: "Revoca desde cualquier dispositivo con sesión activa",
      },
    ],
  },
  de: {
    ...EN,
    title: "Meine Ringe",
    subtitle: "Schnellzugriff. Jeder Ring ist gleich.",
    emptyTitle: "Noch keine Ringe",
    addRing: "Ring hinzufugen",
    openSetup: "+ Ring hinzufügen",
    settingsLink: "Datenschutz & Backup",
    ringRequiredLabel: "Ring erforderlich:",
    recommendedLabel: "Empfohlen:",
    actionLabel: "Was du tun möchtest",
    quickGuideTitle: "So funktioniert Haven",
    quickGuideIntro:
      "Face ID schützt dein Konto. Dein Ring gibt dir schnellen Zugriff und ein besonderes Ritual für deine wertvollsten Erinnerungen.",
    quickGuideSummaryLines: [
      "Täglich öffnen: Ring berühren für den schnellsten Weg, oder Face ID verwenden.",
      "Schnelle Notizen und Entwürfe: einfach losschreiben.",
      "Versiegeln: Nur ein vertrauenswürdiger Ring kann das Ritual abschließen.",
    ],
    quickGuideLearnMore: "Mehr erfahren",
    quickGuideShowLess: "Weniger anzeigen",
    quickGuideOneLine:
      "Der Ring ist dein magischer Schlüssel für Tempo und Zeremonie. Face ID hält alles sicher.",
    quickGuideRows: [
      {
        action: "App täglich öffnen",
        required: "Nein (dringend empfohlen)",
        way: "Ring berühren (am schnellsten) oder Face ID verwenden",
      },
      {
        action: "Schnelle Notizen und Entwürfe",
        required: "Nein",
        way: "Einfach losschreiben",
      },
      {
        action: "Wichtige Erinnerung versiegeln",
        required: "Ja",
        way: "Seal with Ring (erforderlich)",
      },
      {
        action: "Ring hinzufügen oder entfernen",
        required: "Ja",
        way: "Face ID-Bestätigung",
      },
      {
        action: "Daten exportieren",
        required: "Ja",
        way: "Face ID-Bestätigung",
      },
      {
        action: "Versiegelte Inhalte löschen",
        required: "Ja",
        way: "Face ID + zusätzliche Bestätigung",
      },
      {
        action: "Verlorenen Ring handhaben",
        required: "Nein",
        way: "Von jedem angemeldeten Gerät widerrufen",
      },
    ],
  },
  it: {
    ...EN,
    title: "I miei anelli",
    subtitle: "Accesso rapido. Ogni anello e uguale.",
    emptyTitle: "Nessun anello registrato",
    addRing: "Aggiungi anello",
    openSetup: "+ Aggiungi anello",
    settingsLink: "Privacy e backup",
    ringRequiredLabel: "Anello richiesto:",
    recommendedLabel: "Consigliato:",
    actionLabel: "Cosa vuoi fare",
    quickGuideTitle: "Come funziona Haven",
    quickGuideIntro:
      "Face ID protegge il tuo account. Il tuo anello ti dà accesso rapido e un rituale speciale per i tuoi ricordi più preziosi.",
    quickGuideSummaryLines: [
      "Ogni giorno: tocca l'anello per il percorso più rapido, oppure usa Face ID.",
      "Note veloci e bozze: inizia semplicemente a scrivere.",
      "Sigillare: solo un anello fidato può completare il rituale.",
    ],
    quickGuideLearnMore: "Scopri di più",
    quickGuideShowLess: "Mostra meno",
    quickGuideOneLine:
      "L'anello è la tua chiave magica per velocità e cerimonia. Face ID mantiene tutto al sicuro.",
    quickGuideRows: [
      {
        action: "Aprire l'app ogni giorno",
        required: "No (fortemente consigliato)",
        way: "Tocca l'anello (più rapido) o usa Face ID",
      },
      {
        action: "Note veloci e bozze",
        required: "No",
        way: "Inizia semplicemente a scrivere",
      },
      {
        action: "Sigillare un ricordo importante",
        required: "Sì",
        way: "Seal with Ring (richiesto)",
      },
      {
        action: "Aggiungere o rimuovere un anello",
        required: "Sì",
        way: "Conferma con Face ID",
      },
      {
        action: "Esportare dati",
        required: "Sì",
        way: "Conferma con Face ID",
      },
      {
        action: "Eliminare ricordi sigillati",
        required: "Sì",
        way: "Face ID + conferma extra",
      },
      {
        action: "Gestire un anello smarrito",
        required: "No",
        way: "Revoca da qualsiasi dispositivo con accesso attivo",
      },
    ],
  },
};
