export const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "it"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
const LOCALE_STORAGE_KEY = "haven.locale";

type Dictionary = Record<string, string>;

const MESSAGES: Record<Locale, Dictionary> = {
  en: {
    "common.return": "Return",
    "common.back": "Back",
    "common.leave": "Leave",
    "common.discard": "Discard",
    "common.continue": "Continue",
    "common.lang": "Lang",
    "common.language_aria": "Language",
    "common.high_contrast_on": "HIGH CONTRAST: ON",
    "common.high_contrast_off": "HIGH CONTRAST: OFF",
    "common.toggle_high_contrast_mode": "Toggle high contrast mode",
    "common.help": "Help",
    "home.title.line1": "Write one thing.",
    "home.title.line2": "Touch your ring to seal it.",
    "home.ring.linked": "Ring linked",
    "home.ring.unlinked": "No ring linked",
    "home.cta.prepare": "Prepare to seal",
    "home.cta.write_new": "Write new",
    "home.claim.hint": "Not linked yet?",
    "home.claim.cta": "Tap your ring to claim",
    "home.vault.hint":
      "Tap your ring anytime for quick access to your sealed moments. Your account—not the ring alone—protects everything.",
    "home.vault.cta": "Tap ring to open your Haven",
    "home.vault.open": "Open Haven history",
    "home.seal.hint":
      "Prepare to seal, then tap your ring to confirm. The ring is a shortcut; serious changes still need your account and this device checks.",
    "home.state.encrypting": "Encrypting...",
    "home.state.awaiting.title": "Touch your ring to seal",
    "home.state.awaiting.body":
      "This screen will wait. Leave the app open and hold your phone against the ring.",
    "home.error.title": "Something went wrong",
    "home.error.no_active_ring": "No active ring linked to this account.",
    "hub.error.title": "Could not read the ring",
    "hub.error.missing_token": "Missing token.",
    "hub.error.generic": "Unknown error.",
    "hub.error.ring_inactive":
      "Ring quick access is unavailable right now. Please continue with sign-in.",
    "claim.title": "Continue to Haven",
    "claim.subtitle": "Quick access",
    "claim.reason.ring_inactive":
      "This ring has not been activated for your account yet.",
    "claim.reason.nfc_unavailable":
      "NFC is not available on this device.",
    "claim.reason.permission_denied":
      "NFC permission is unavailable. Try another device.",
    "claim.reason.unknown": "We could not verify this ring yet.",
    "claim.next":
      "Continue with sign-in to unlock Haven on this phone.",
    "claim.cta.claim": "Continue",
    "claim.cta.claiming": "Continuing...",
    "claim.error.auth_required": "Please sign in to continue.",
    "claim.error.auth_upgrade_required":
      "This ring can only be claimed with a full Haven account. Please sign in with your account and try again.",
    "claim.error.missing_token": "Missing ring token.",
    "claim.error.generic": "Could not continue right now. Please try again.",
    "claim.error.owned_by_another":
      "Could not continue with ring quick access on this phone. Please sign in and try again.",
    "claim.error.revoked":
      "This ring cannot be used for quick access right now. Please sign in and continue.",
    "claim.error.token_not_found":
      "Ring quick access was unavailable. Please sign in and continue.",
    "claim.error.state_unsupported":
      "Ring quick access is temporarily unavailable. Please continue with sign-in.",
    "claim.success": "Done. Returning to home...",
    "help.title": "Rings, privacy, and your account",
    "help.local_only.title": "Local-first by default",
    "help.local_only.body":
      "Sealed content is encrypted on this device for speed and privacy. The ring is a quick-access shortcut, not a replacement for your account.",
    "help.recovery.title": "If something is lost or broken",
    "help.recovery.body":
      "Your account still holds your haven. For a ring or device issue, use recovery in the app to reissue or unlink a ring. Revoke a lost ring from a trusted device as soon as you can.",
    "help.optional_cloud.title": "Optional cross-device backup",
    "help.optional_cloud.body":
      "You can turn on optional Sign in with Apple or Google in Settings to sync backup across devices. Your account remains the source of trust—not the physical ring alone.",
  },
  fr: {
    "common.return": "Retour",
    "common.back": "Retour",
    "common.leave": "Quitter",
    "common.discard": "Abandonner",
    "common.continue": "Continuer",
    "common.lang": "Langue",
    "common.language_aria": "Langue",
    "common.high_contrast_on": "CONTRASTE ELEVE : ON",
    "common.high_contrast_off": "CONTRASTE ELEVE : OFF",
    "common.toggle_high_contrast_mode": "Activer ou desactiver le contraste eleve",
    "home.title.line1": "Écrivez une seule chose.",
    "home.title.line2": "Touchez votre bague pour la sceller.",
    "home.ring.linked": "Bague liée",
    "home.ring.unlinked": "Aucune bague liée",
    "home.cta.prepare": "Préparer le scellement",
    "home.cta.write_new": "Écrire",
    "home.claim.hint": "Pas encore liée ?",
    "home.claim.cta": "Touchez votre bague pour la lier",
    "home.vault.hint":
      "Touchez votre bague pour un acces rapide a vos moments scelles. C'est votre compte — pas la bague seule — qui protege le tout.",
    "home.vault.cta": "Touchez la bague pour ouvrir votre Haven",
    "home.vault.open": "Ouvrir l'historique Haven",
    "home.seal.hint":
      "Préparez le scellement, puis touchez la bague pour confirmer. La bague est un raccourci; les changements importants exigent compte et verifications sur cet appareil.",
    "home.state.encrypting": "Chiffrement...",
    "home.state.awaiting.title": "Touchez votre bague pour sceller",
    "home.state.awaiting.body":
      "Cet écran attendra. Laissez l'application ouverte et approchez votre téléphone de la bague.",
    "home.error.title": "Une erreur est survenue",
    "home.error.no_active_ring": "Aucune bague active liée à ce compte.",
    "hub.error.title": "Impossible de lire la bague",
    "hub.error.missing_token": "Jeton manquant.",
    "hub.error.generic": "Erreur inconnue.",
    "hub.error.ring_inactive":
      "Cette bague n'est pas encore active. Continuez la liaison.",
    "claim.title": "Lier cette bague",
    "claim.subtitle": "Configuration",
    "claim.reason.ring_inactive":
      "Cette bague n'est pas encore activée pour votre compte.",
    "claim.reason.nfc_unavailable":
      "Le NFC n'est pas disponible sur cet appareil.",
    "claim.reason.permission_denied":
      "L'autorisation NFC est indisponible. Essayez un autre appareil.",
    "claim.reason.unknown":
      "Nous n'avons pas encore pu vérifier cette bague.",
    "claim.next":
      "Continuez la liaison après connexion et vérification de propriété.",
    "claim.cta.claim": "Lier la bague",
    "claim.cta.claiming": "Association...",
    "claim.error.auth_required":
      "Connectez-vous avant d'associer cette bague.",
    "claim.error.missing_token": "Jeton de bague manquant.",
    "claim.error.generic":
      "Impossible d'associer cette bague pour le moment.",
    "claim.success": "Bague associée. Retour à l'accueil...",
    "help.title": "Bagues, confidentialite et compte",
    "help.local_only.title": "Local d'abord",
    "help.local_only.body":
      "Le contenu scelle est chiffre sur cet appareil. La bague est un raccourci d'acces, pas un remplacant de compte.",
    "help.recovery.title": "En cas de perte ou de panne",
    "help.recovery.body":
      "Votre compte conserve votre Haven. Pour un probleme de bague ou d'appareil, utilisez la recuperation pour reemettre ou retirer une bague. Revoguez une bague perdue depuis un appareil de confiance rapidement.",
    "help.optional_cloud.title": "Sauvegarde optionnelle multi-appareils",
    "help.optional_cloud.body":
      "Vous pouvez activer la connexion Apple ou Google dans les reglages pour une sauvegarde multi-appareils. Le compte reste la source de confiance, pas seulement la bague.",
  },
  es: {
    "common.return": "Volver",
    "common.back": "Atrás",
    "common.leave": "Salir",
    "common.discard": "Descartar",
    "common.continue": "Continuar",
    "common.lang": "Idioma",
    "common.language_aria": "Idioma",
    "common.high_contrast_on": "ALTO CONTRASTE: ON",
    "common.high_contrast_off": "ALTO CONTRASTE: OFF",
    "common.toggle_high_contrast_mode": "Alternar modo de alto contraste",
    "home.title.line1": "Escribe una sola cosa.",
    "home.title.line2": "Toca tu anillo para sellarla.",
    "home.ring.linked": "Anillo vinculado",
    "home.ring.unlinked": "Sin anillo vinculado",
    "home.cta.prepare": "Preparar sello",
    "home.cta.write_new": "Escribir",
    "home.claim.hint": "¿Aún no está vinculado?",
    "home.claim.cta": "Toca tu anillo para vincularlo",
    "home.vault.hint":
      "Toca el anillo para acceso rapido a tus momentos sellados. Tu cuenta — no solo el anillo — protege todo.",
    "home.vault.cta": "Toca el anillo para abrir tu Haven",
    "home.vault.open": "Abrir historial de Haven",
    "home.seal.hint":
      "Prepara el sellado y toca el anillo para confirmar. El anillo es un atajo; los cambios serios siguen pidiendo tu cuenta y comprobaciones en este dispositivo.",
    "home.state.encrypting": "Cifrando...",
    "home.state.awaiting.title": "Toca tu anillo para sellar",
    "home.state.awaiting.body":
      "Esta pantalla esperará. Deja la app abierta y acerca el teléfono al anillo.",
    "home.error.title": "Algo salió mal",
    "home.error.no_active_ring": "No hay un anillo activo vinculado a esta cuenta.",
    "hub.error.title": "No se pudo leer el anillo",
    "hub.error.missing_token": "Falta el token.",
    "hub.error.generic": "Error desconocido.",
    "hub.error.ring_inactive":
      "Este anillo aún no está activo. Continúa con la vinculación.",
    "claim.title": "Vincular este anillo",
    "claim.subtitle": "Configuración",
    "claim.reason.ring_inactive":
      "Este anillo aún no está activado para tu cuenta.",
    "claim.reason.nfc_unavailable":
      "NFC no está disponible en este dispositivo.",
    "claim.reason.permission_denied":
      "El permiso NFC no está disponible. Prueba con otro dispositivo.",
    "claim.reason.unknown":
      "Aún no pudimos verificar este anillo.",
    "claim.next":
      "Continúa la vinculación tras iniciar sesión y verificar la propiedad.",
    "claim.cta.claim": "Vincular anillo",
    "claim.cta.claiming": "Vinculando...",
    "claim.error.auth_required":
      "Inicia sesión antes de vincular este anillo.",
    "claim.error.missing_token": "Falta el token del anillo.",
    "claim.error.generic":
      "No se pudo vincular este anillo en este momento.",
    "claim.success": "Anillo vinculado. Volviendo al inicio...",
    "help.title": "Anillos, privacidad y tu cuenta",
    "help.local_only.title": "Local primero",
    "help.local_only.body":
      "El contenido sellado se cifra en este dispositivo. El anillo es un atajo, no sustituye a la cuenta.",
    "help.recovery.title": "Si pierdes o rompes algo",
    "help.recovery.body":
      "Tu cuenta sigue guardando tu Haven. Si falla anillo o dispositivo, usa recuperacion en la app para reemitir o desvincular. Revoca un anillo perdido desde un dispositivo de confianza en cuanto puedas.",
    "help.optional_cloud.title": "Copia de seguridad opcional",
    "help.optional_cloud.body":
      "Puedes activar inicio con Apple o Google en ajustes para copia entre dispositivos. La cuenta sigue siendo la base de confianza, no solo el anillo.",
  },
  de: {
    "common.return": "Zurück",
    "common.back": "Zurück",
    "common.leave": "Verlassen",
    "common.discard": "Verwerfen",
    "common.continue": "Weiter",
    "common.lang": "Sprache",
    "common.language_aria": "Sprache",
    "common.high_contrast_on": "HOHER KONTRAST: EIN",
    "common.high_contrast_off": "HOHER KONTRAST: AUS",
    "common.toggle_high_contrast_mode": "Modus hoher Kontrast umschalten",
    "home.title.line1": "Schreibe eine Sache.",
    "home.title.line2": "Berühre deinen Ring, um sie zu versiegeln.",
    "home.ring.linked": "Ring verbunden",
    "home.ring.unlinked": "Kein Ring verbunden",
    "home.cta.prepare": "Versiegeln vorbereiten",
    "home.cta.write_new": "Neu schreiben",
    "home.claim.hint": "Noch nicht verknüpft?",
    "home.claim.cta": "Berühre deinen Ring zum Verknüpfen",
    "home.vault.hint":
      "Beruhre den Ring fur schnellen Zugriff auf versiegelte Momente. Dein Konto — nicht der Ring allein — schutzt alles.",
    "home.vault.cta": "Ring berühren, um dein Haven zu öffnen",
    "home.vault.open": "Haven-Verlauf öffnen",
    "home.seal.hint":
      "Versiegelung vorbereiten, dann Ring beruhren. Der Ring ist ein Kurzbefehl; wichtige Anderungen brauchen Konto und Prufungen auf diesem Gerat.",
    "home.state.encrypting": "Verschlüsselung...",
    "home.state.awaiting.title": "Berühre deinen Ring zum Versiegeln",
    "home.state.awaiting.body":
      "Dieser Bildschirm wartet. Lass die App offen und halte dein Telefon an den Ring.",
    "home.error.title": "Etwas ist schiefgelaufen",
    "home.error.no_active_ring": "Kein aktiver Ring mit diesem Konto verknüpft.",
    "hub.error.title": "Ring konnte nicht gelesen werden",
    "hub.error.missing_token": "Token fehlt.",
    "hub.error.generic": "Unbekannter Fehler.",
    "hub.error.ring_inactive":
      "Dieser Ring ist noch nicht aktiv. Fahre mit der Verknüpfung fort.",
    "claim.title": "Diesen Ring verknüpfen",
    "claim.subtitle": "Einrichtung",
    "claim.reason.ring_inactive":
      "Dieser Ring ist für dein Konto noch nicht aktiviert.",
    "claim.reason.nfc_unavailable":
      "NFC ist auf diesem Gerät nicht verfügbar.",
    "claim.reason.permission_denied":
      "NFC-Berechtigung ist nicht verfügbar. Nutze ein anderes Gerät.",
    "claim.reason.unknown":
      "Dieser Ring konnte noch nicht verifiziert werden.",
    "claim.next":
      "Setze die Verknüpfung nach Anmeldung und Besitzprüfung fort.",
    "claim.cta.claim": "Ring verknüpfen",
    "claim.cta.claiming": "Verknüpfen...",
    "claim.error.auth_required":
      "Bitte melde dich an, bevor du diesen Ring verknüpfst.",
    "claim.error.missing_token": "Ring-Token fehlt.",
    "claim.error.generic":
      "Dieser Ring kann derzeit nicht verknüpft werden.",
    "claim.success": "Ring verknüpft. Zurück zur Startseite...",
    "help.title": "Ringe, Privatsphäre und Konto",
    "help.local_only.title": "Lokal zuerst",
    "help.local_only.body":
      "Versiegelter Inhalt ist auf diesem Gerat verschlusselt. Der Ring ist Kurzzugang, kein Ersatz furs Konto.",
    "help.recovery.title": "Bei Verlust oder Defekt",
    "help.recovery.body":
      "Dein Konto behalt dein Haven. Bei Ring- oder Gerateproblem nutze Wiederherstellung in der App fur neu ausstellen oder entknupfen. Verlorene Ringe schnell von einem vertrauten Gerat widerrufen.",
    "help.optional_cloud.title": "Optionales Backup mehrerer Gerate",
    "help.optional_cloud.body":
      "Apple- oder Google-Anmeldung in den Einstellungen fur gerateubergreifendes Backup. Vertrauen bleibt beim Konto, nicht allein am Ring.",
  },
  it: {
    "common.return": "Torna",
    "common.back": "Indietro",
    "common.leave": "Esci",
    "common.discard": "Scarta",
    "common.continue": "Continua",
    "common.lang": "Lingua",
    "common.language_aria": "Lingua",
    "common.high_contrast_on": "ALTO CONTRASTO: ON",
    "common.high_contrast_off": "ALTO CONTRASTO: OFF",
    "common.toggle_high_contrast_mode": "Attiva o disattiva alto contrasto",
    "home.title.line1": "Scrivi una sola cosa.",
    "home.title.line2": "Tocca l'anello per sigillarla.",
    "home.ring.linked": "Anello collegato",
    "home.ring.unlinked": "Nessun anello collegato",
    "home.cta.prepare": "Prepara sigillo",
    "home.cta.write_new": "Scrivi",
    "home.claim.hint": "Non ancora collegato?",
    "home.claim.cta": "Tocca l'anello per associarlo",
    "home.vault.hint":
      "Tocca l'anello per accesso rapido ai momenti sigillati. E il tuo account — non il solo anello — a proteggere tutto.",
    "home.vault.cta": "Tocca l'anello per aprire il tuo Haven",
    "home.vault.open": "Apri cronologia Haven",
    "home.seal.hint":
      "Prepara il sigillo, poi tocca l'anello. L'anello e una scorciatoia; le operazioni importanti restano con account e verifiche su questo dispositivo.",
    "home.state.encrypting": "Cifratura...",
    "home.state.awaiting.title": "Tocca l'anello per sigillare",
    "home.state.awaiting.body":
      "Questa schermata resterà in attesa. Lascia aperta l'app e avvicina il telefono all'anello.",
    "home.error.title": "Qualcosa è andato storto",
    "home.error.no_active_ring": "Nessun anello attivo collegato a questo account.",
    "hub.error.title": "Impossibile leggere l'anello",
    "hub.error.missing_token": "Token mancante.",
    "hub.error.generic": "Errore sconosciuto.",
    "hub.error.ring_inactive":
      "Questo anello non è ancora attivo. Continua con l'associazione.",
    "claim.title": "Associa questo anello",
    "claim.subtitle": "Configurazione",
    "claim.reason.ring_inactive":
      "Questo anello non è ancora attivo per il tuo account.",
    "claim.reason.nfc_unavailable":
      "NFC non disponibile su questo dispositivo.",
    "claim.reason.permission_denied":
      "Permesso NFC non disponibile. Prova con un altro dispositivo.",
    "claim.reason.unknown":
      "Non siamo ancora riusciti a verificare questo anello.",
    "claim.next":
      "Continua l'associazione dopo accesso e verifica di proprietà.",
    "claim.cta.claim": "Associa anello",
    "claim.cta.claiming": "Associazione...",
    "claim.error.auth_required":
      "Accedi prima di associare questo anello.",
    "claim.error.missing_token": "Token anello mancante.",
    "claim.error.generic":
      "Impossibile associare questo anello in questo momento.",
    "claim.success": "Anello associato. Ritorno alla home...",
    "help.title": "Anelli, privacy e account",
    "help.local_only.title": "Prima il locale",
    "help.local_only.body":
      "Il contenuto sigillato e cifrato su questo dispositivo. L'anello e una scorciatoia, non sostituisce l'account.",
    "help.recovery.title": "Se qualcosa si perde o si rompe",
    "help.recovery.body":
      "Il tuo account conserva il Haven. Per problemi ad anello o dispositivo usa il ripristino nell'app per riemettere o scollegare. Revoca un anello smarrito da un dispositivo fidato appena puoi.",
    "help.optional_cloud.title": "Backup opzionale tra dispositivi",
    "help.optional_cloud.body":
      "Puoi attivare accesso con Apple o Google nelle impostazioni per il backup tra dispositivi. La fiducia resta sull'account, non solo sull'anello fisico.",
  },
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value.toLowerCase());
}

export function getPreferredLocale(
  searchParams?: URLSearchParams | null
): Locale {
  const fromQuery = searchParams?.get("lang");
  if (isSupportedLocale(fromQuery)) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, fromQuery);
    }
    return fromQuery;
  }

  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) return saved;

    const langs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const lang of langs) {
      const base = lang.toLowerCase().split("-")[0];
      if (isSupportedLocale(base)) return base;
    }
  }
  return DEFAULT_LOCALE;
}

export function getTranslator(locale: Locale) {
  return (key: string) => MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
}

export function setPreferredLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
