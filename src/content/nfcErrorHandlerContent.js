const EN = {
  title: "Let's fix this together",
  tryAgain: "Try Again",
  showFullGuide: "Show Full Guide",
  dismiss: "Close",
  fallback:
    "Please keep the ring still near the top back of your phone for 5 seconds, then try once more.",
  genericTitle: "We couldn't complete the tap",
  errors: {
    connection_lost: {
      title: "Connection was interrupted",
      help: "Please keep the ring completely still against the upper back of your phone for 5 seconds, then try again.",
    },
    stack_error: {
      title: "The ring moved during tap",
      help: "This is usually caused by movement. Hold steady and tap again one more time.",
    },
    session_invalidated: {
      title: "The tap session ended",
      help: "No worries. Start a new tap and keep your phone unlocked until it finishes.",
    },
    not_supported: {
      title: "NFC is not ready on this phone",
      help: "Make sure your phone supports NFC and that NFC is turned on, then try again.",
    },
    permission_denied: {
      title: "Permission was not granted",
      help: "Please allow NFC access when asked, then tap the ring again near the camera area.",
    },
  },
};

export const NFC_ERROR_HANDLER_CONTENT = {
  en: EN,
  fr: {
    ...EN,
    title: "On va le resoudre ensemble",
    tryAgain: "Reessayer",
    showFullGuide: "Voir le guide complet",
    dismiss: "Fermer",
    fallback:
      "Gardez la bague immobile pres du haut arriere du telephone pendant 5 secondes, puis reessayez.",
  },
  es: {
    ...EN,
    title: "Vamos a resolverlo juntos",
    tryAgain: "Intentar de nuevo",
    showFullGuide: "Ver guia completa",
    dismiss: "Cerrar",
    fallback:
      "Manten el anillo quieto cerca de la parte superior trasera del telefono durante 5 segundos y vuelve a intentar.",
  },
  de: {
    ...EN,
    title: "Wir losen das gemeinsam",
    tryAgain: "Erneut versuchen",
    showFullGuide: "Vollstandige Anleitung",
    dismiss: "Schliessen",
    fallback:
      "Halte den Ring 5 Sekunden ruhig am oberen Rucken des Telefons und versuche es erneut.",
  },
  it: {
    ...EN,
    title: "Risolviamolo insieme",
    tryAgain: "Riprova",
    showFullGuide: "Mostra guida completa",
    dismiss: "Chiudi",
    fallback:
      "Tieni l'anello fermo vicino alla parte alta posteriore del telefono per 5 secondi, poi riprova.",
  },
};
