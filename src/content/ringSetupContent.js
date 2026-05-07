const EN = {
  kicker: "One-time setup",
  title: "Set up your magic keys",
  introBody:
    "Add NFC rings for faster sign-in. You can link 1 to 5 rings, and every ring works the same way. No master ring. Your memories always stay with your account.",
  ctaAddRing: "Add NFC ring",
  ctaSkip: "Skip for now",
  scanTitle: "Hold your ring to the phone",
  scanBody:
    "Rest the ring on the upper back of your phone and keep it still for a few seconds.",
  scanCta: "Start scanning",
  scanWorking: "Listening for NFC…",
  scanRetry: "Try again",
  statusBindingTitle: "New ring binding",
  statusBindingScanning: "Waiting for a ring touch. Keep the ring still near your phone.",
  statusBindingDetected:
    "Ring touch received. This is a new ring setup flow; confirm it is you, then name the ring.",
  iosNfcTitle: "NFC setup on iPhone",
  iosNfcBody:
    "Your ring has been pre-configured to open this sanctuary. We will now connect it to your account.",
  installRecommendedTitle: "Better full-screen experience from Home Screen",
  installRecommendedBody:
    "iOS needs manual Add to Home Screen. Once added, Haven feels much closer to a native app and is more stable for daily use.",
  continueInBrowserCta: "Continue in browser anyway",
  installNowCta: "Install to Home Screen now",
  installDoneHint: "Install prompt shown. Return here after adding Haven to your Home Screen.",
  installConsentTitle: "Before installing to Home Screen",
  installConsentBody:
    "This action creates a Haven icon on your phone Home Screen so you can open Haven directly in full-screen mode, without first opening the browser.",
  installConsentRevoke:
    "You can revoke this anytime by removing the Haven icon from your Home Screen. This does not delete your account or cloud data.",
  installConsentConfirm: "I understand, continue install",
  installConsentCancel: "Cancel",
  installSuppressConfirmLabel: "Do not show this install confirmation again on this device",
  installSuccessNotice:
    "Haven was added to your Home Screen. Next time, open Haven directly from the Home Screen icon for a smoother app-like flow.",
  iosInstallGuideCta: "How to add to Home Screen",
  iosInstallGuideTitle: "Add Haven to Home Screen (iOS)",
  iosInstallGuideTone:
    "iOS requires a manual step here. This is normal and safe.",
  iosInstallGuideStep1: "Tap the top-right Share button in Safari.",
  iosInstallGuideStep2: "Select Add to Home Screen.",
  iosInstallGuideStep3: "Confirm Add.",
  iosInstallGuideStep4: "Tap Add, then open Haven from the new Home Screen icon.",
  iosInstallGuideScreenshotHint1:
    "Screenshot hint: look for Safari Share sheet with 'Add to Home Screen'.",
  iosInstallGuideScreenshotHint2:
    "Screenshot hint: after adding, confirm Haven icon appears on Home Screen.",
  useOpenedRingLinkCta: "Use this opened ring link",
  useOpenedRingLinkHint:
    "If this page was opened by tapping your ring, continue directly with this ring link.",
  noOpenedRingLinkHint:
    "If your ring opens Haven with a unique link, open Haven from that ring first, then tap this button.",
  installStateReady: "Install state: ready to add to Home Screen on this device.",
  installStateManual:
    "Install state: manual add required (open in Safari and use Share → Add to Home Screen).",
  installPreparingTimeout:
    "Install setup is preparing. If it takes too long, you can add to Home Screen later from Settings.",
  installReadyAfterDelay:
    "Install setup is now ready. You can continue installing from this page.",
  ringLinkDetected:
    "Good news: this page was opened by your ring. Tap 'Use this opened ring link' to continue.",
  ringLinkNotDetected:
    "This page was not opened by your ring yet. Tap your ring to open Haven first, then come back and continue.",
  iosInstallSafetyTitle: "Why this is safe",
  iosInstallSafetyBrief:
    "Adding to Home Screen is a shortcut only. It does not grant extra permissions.",
  iosInstallSafetyBody:
    "Adding to Home Screen only creates a shortcut icon. It does not grant new phone permissions, does not expose your contacts/photos, and does not change your account security settings.",
  iosInstallSafetyPrivacy:
    "During ring setup, Haven stores only a secure ring fingerprint for login checks, never the raw ring UID.",
  iosInstallSafetyExpand: "Show details",
  iosInstallSafetyCollapse: "Hide details",
  iosInstallGuideSteps:
    "On iPhone Safari:\n1) Tap the Share button.\n2) Choose 'Add to Home Screen'.\n3) Confirm Add.\n4) Return to Home Screen and open Haven from the new icon.\n\nSafety note:\n- This only creates a shortcut icon.\n- It does not grant extra device permissions.\n- You can remove the icon anytime.",
  copyLinkCta: "Copy site link",
  copyLinkDone: "Site link copied. Paste it in Safari, then Add to Home Screen.",
  copyLinkFailed: "Could not copy link automatically. Please copy the URL from your browser.",
  androidOk: "Got it",
  verifyTitle: "Confirm it's you",
  verifyBody:
    "To protect your account, confirm with your device password or recovery code. On supported devices, your platform may use Face ID, Touch ID, or a passkey with this step when enabled.",
  verifyPassword: "Device password",
  verifyRecovery: "Or recovery code",
  verifyCta: "Confirm",
  verifyWorking: "Verifying…",
  verifyError: "Verification failed. Check your password or code.",
  needSecurityTitle: "Device protection required",
  needSecurityBody:
    "Set a device password in Settings first. We use it to confirm sensitive steps like linking a ring — your ring alone is not enough.",
  goSettings: "Open Settings",
  nameTitle: "Name this ring",
  nameBody: "A short label helps you tell rings apart. You can change this later.",
  namePlaceholder: "e.g. Daily carry, Backup vault, Travel",
  colorLabel: "Color",
  iconLabel: "Icon",
  nameCta: "Save and finish",
  rewriteTitle: "Advanced: Rewrite ring link (Android)",
  rewriteBody:
    "Optional for Android users. You can rewrite this ring to another trusted HTTPS link.",
  rewriteAction: "Rewrite Ring URL",
  rewriteWorking: "Rewriting ring link...",
  rewriteDone: "Ring link updated.",
  rewriteVerified: "Rewrite verified. The ring now opens the updated link.",
  rewriteInvalidUrl: "Please enter a valid HTTPS URL.",
  rewriteVerifyFailed:
    "Write finished, but read-back verification did not match. Please try once more.",
  rewriteFailed: "Could not rewrite ring link. Hold still and try again.",
  successTitle: "Ring linked",
  successBody:
    "This ring is now linked to your account for quick sign-in and optional sealing. Any linked ring can bring you back to Haven.",
  successEncourage:
    "Tip: add a second ring as backup. If one ring is lost, your memories are still safe in your account.",
  factoryStartLinkReadyIos:
    "Factory setup note: this ring should already open https://havenring.me/start. On iPhone, no rewrite is needed during setup.",
  factoryStartLinkReadyAndroid:
    "Factory setup note: this ring should already open https://havenring.me/start. If needed, you can rewrite the link later in Settings on Android.",
  addAnother: "Add another ring",
  doneToHaven: "Go to my memory space",
  duplicateError: "This ring is already in your list.",
  limitTitle: "Ring limit reached",
  limitBody:
    "You can link up to five rings. Remove or revoke one from Settings or your account tools before adding another.",
  limitCta: "Close",
  readError: "Could not read the ring. Hold it steady and try again.",
  cloudSignInRequired:
    "Sign in to your account (e.g. enable cloud backup in Settings) before linking this ring to the server.",
  cloudAccountRequired:
    "Link a permanent sign-in (not a guest session) in Settings, then add your ring again.",
  cloudBindFailed: "Could not link the ring to your account. Please try again.",
  privacyBindNotice:
    "By registering a ring, you agree we store a secure fingerprint of the tag (not the raw UID) for login and limits — see our Privacy Policy.",
  privacyPolicyLink: "Privacy Policy",
  noNfcTitle: "NFC not available in this browser",
  noNfcBody:
    "This browser cannot access NFC right now. Please install Haven to your Home Screen and open it from there on this same phone, then try again.",
};

export const RING_SETUP_CONTENT = {
  en: EN,
  fr: {
    ...EN,
    kicker: "Configuration unique",
    title: "Configurez vos cles magiques",
    introBody:
      "Ajoutez vos bagues NFC comme acces rapide a votre espace de souvenirs. Chaque bague agit de la meme facon — nous recommandons au moins deux : une au quotidien et une en secours.",
    ctaAddRing: "Ajouter une bague NFC",
    ctaSkip: "Passer pour l'instant",
    scanTitle: "Approchez la bague du telephone",
    scanBody:
      "Posez la bague en haut du dos du telephone et gardez-la immobile quelques secondes.",
    scanCta: "Demarrer la lecture",
    scanWorking: "Ecoute NFC…",
    scanRetry: "Reessayer",
    statusBindingTitle: "Liaison d'une nouvelle bague",
    statusBindingScanning:
      "En attente du toucher de bague. Gardez la bague immobile pres du telephone.",
    statusBindingDetected:
      "Bague detectee. Ceci est une configuration de nouvelle bague ; confirmez votre identite, puis nommez-la.",
    iosNfcTitle: "NFC sur iPhone",
    iosNfcBody:
      "Votre bague est preconfiguree pour ouvrir ce sanctuaire. Nous allons maintenant la connecter a votre compte.",
    verifyTitle: "Confirmez votre identite",
    verifyBody:
      "Pour proteger votre compte, confirmez avec le mot de passe appareil ou le code de recuperation.",
    nameTitle: "Nommez cette bague",
    namePlaceholder: "ex. Quotidien, Secours, Voyage",
    successTitle: "Bague liee",
    successBody:
      "Cette bague sert desormais pour l'acces rapide et le scellement. Touchez une bague liee pour revenir au Haven.",
    addAnother: "Ajouter une autre bague",
    doneToHaven: "Aller a mon espace souvenirs",
    limitTitle: "Limite de bagues",
    limitBody: "Jusqu'a cinq bagues. Retirez-en une avant d'en ajouter une nouvelle.",
  },
  es: {
    ...EN,
    kicker: "Configuracion inicial",
    title: "Configura tus llaves magicas",
    introBody:
      "Anade tus anillos NFC como acceso rapido a tu espacio privado. Cada anillo funciona igual — recomendamos al menos dos: uno diario y otro de respaldo.",
    ctaAddRing: "Anadir anillo NFC",
    ctaSkip: "Saltar por ahora",
    scanTitle: "Acerca el anillo al telefono",
    scanCta: "Empezar escaneo",
    scanWorking: "Buscando NFC…",
    statusBindingTitle: "Vinculando nuevo anillo",
    statusBindingScanning:
      "Esperando el toque del anillo. Manténlo quieto cerca del teléfono.",
    statusBindingDetected:
      "Anillo detectado. Este es el flujo para vincular un nuevo anillo; confirma tu identidad y ponle nombre.",
    iosNfcTitle: "NFC en iPhone",
    verifyTitle: "Confirma que eres tu",
    nameTitle: "Nombre del anillo",
    successTitle: "Anillo vinculado",
    addAnother: "Anadir otro anillo",
    doneToHaven: "Ir a mi espacio",
    limitTitle: "Limite de anillos",
    limitBody: "Hasta cinco anillos. Quita uno antes de anadir otro.",
  },
  de: {
    ...EN,
    kicker: "Einmalige Einrichtung",
    title: "Richte deine Schlussel ein",
    introBody:
      "Fu NFC-Ringe als Schnellzugriff fur deinen privaten Raum hinzu. Jeder Ring ist gleich — empfohlen sind mindestens zwei: einer fur jeden Tag und einer als Backup.",
    ctaAddRing: "NFC-Ring hinzufugen",
    ctaSkip: "Uberspringen",
    scanTitle: "Ring ans Telefon halten",
    scanCta: "Scan starten",
    scanWorking: "NFC wird gesucht…",
    statusBindingTitle: "Neuen Ring verknüpfen",
    statusBindingScanning:
      "Warte auf Ring-Berührung. Halte den Ring ruhig nahe ans Telefon.",
    statusBindingDetected:
      "Ring erkannt. Dies ist die Einrichtung eines neuen Rings; bestätige deine Identität und benenne ihn.",
    iosNfcTitle: "NFC auf dem iPhone",
    verifyTitle: "Bestatige deine Identitat",
    nameTitle: "Ring benennen",
    successTitle: "Ring verknupft",
    addAnother: "Weiteren Ring hinzufugen",
    doneToHaven: "Zu meinem Bereich",
    limitTitle: "Ring-Limit",
    limitBody: "Maximal funf Ringe. Entferne einen, bevor du einen neuen addierst.",
  },
  it: {
    ...EN,
    kicker: "Configurazione una tantum",
    title: "Imposta le tue chiavi magiche",
    introBody:
      "Aggiungi gli anelli NFC come accesso rapido al tuo spazio privato. Ogni anello e uguale — consigliati almeno due: uno per il giorno e uno di riserva.",
    ctaAddRing: "Aggiungi anello NFC",
    ctaSkip: "Salta per ora",
    scanTitle: "Avvicina l'anello al telefono",
    scanCta: "Avvia scansione",
    scanWorking: "Ascolto NFC…",
    statusBindingTitle: "Collegamento nuovo anello",
    statusBindingScanning:
      "In attesa del tocco dell'anello. Tienilo fermo vicino al telefono.",
    statusBindingDetected:
      "Anello rilevato. Questo è il flusso per collegare un nuovo anello; conferma la tua identità e dagli un nome.",
    iosNfcTitle: "NFC su iPhone",
    verifyTitle: "Conferma la tua identita",
    nameTitle: "Nome dell'anello",
    successTitle: "Anello collegato",
    addAnother: "Aggiungi un altro anello",
    doneToHaven: "Vai al mio spazio",
    limitTitle: "Limite anelli",
    limitBody: "Massimo cinque anelli. Rimuovine uno prima di aggiungerne un altro.",
  },
};
