import {
  HAVEN_EN_LAYERED_CORE_LINE,
  HAVEN_EN_HOW_HAVEN_WORKS_ROWS,
  HAVEN_EN_QUICK_GUIDE_ONE_LINE,
  HAVEN_HELP_CENTER_EN,
  mapHowHavenRowsToHelpRows,
} from "./havenCopy";

const EN = {
  ...HAVEN_HELP_CENTER_EN,
  brand: "Help Center",
  title: "Help & Support",
  subtitle:
    "You are not alone here. This page walks you through everything step by step, like a friend beside you.",
  layeredCoreLine: HAVEN_EN_LAYERED_CORE_LINE,
  back: "Back",
  quickTitle: "Quick Start Guide",
  quickBody: "New to Haven Ring? Start here for a calm, guided walkthrough.",
  quickCta: "Open First-Time Guide",
  tapTitle: "How to Tap Your Ring",
  tapBody:
    "See exactly where to place your ring and how long to hold for a reliable tap.",
  tapBodyByPlatform: {
    ios: "iPhone path: place ring near the upper back camera area and hold 3-5 seconds.",
    android:
      "Android path: start from upper-middle back area and hold steady 2-4 seconds.",
    other: "General path: start from upper back area, hold steady, then adjust slightly.",
  },
  tapCta: "Open NFC Tap Guide",
  troubleshootingTitle: "Troubleshooting",
  troubleshootingBody: "If something feels off, start with these quick fixes.",
  riskOpsTitle: "High-risk actions",
  riskOpsBody:
    "Ring management, sealed-memory deletion, and export or migration usually require strong secondary verification.",
  troubleshootingBodyByPlatform: {
    ios: "iPhone-focused quick fixes are shown first.",
    android: "Android-focused quick fixes are shown first.",
    other: "General quick fixes are shown first.",
  },
  faqTitle: "Common Questions",
  contactTitle: "Contact Support",
  contactBody: "Still stuck? Reach out and we will help you personally.",
  showDetails: "Show details",
  hideDetails: "Hide details",
  actionLabel: "What you want to do",
  ringRequiredLabel: "Ring Required:",
  recommendedLabel: "Recommended:",
  howHavenWorksTitle: "How Haven Works",
  howHavenWorksIntro: HAVEN_EN_LAYERED_CORE_LINE,
  howHavenWorksRows: mapHowHavenRowsToHelpRows(HAVEN_EN_HOW_HAVEN_WORKS_ROWS),
  howHavenWorksKeyPointsTitle: "Five Key Points",
  howHavenWorksKeyPoints: [
    "1. Your ring is a fast key and a ritual tool for precious memories (not the only credential).",
    "2. For daily use, touching your ring is recommended — Face ID is still available as a fallback.",
    "3. Important memories can only be sealed with a trusted ring.",
    "4. High-risk actions (add rings, export, delete sealed content) require secondary verification in normal conditions.",
    "5. Your memories are protected with strong encryption on supported flows and stored as sealed records on your devices (not casually editable).",
  ],
  howHavenWorksOneLine: HAVEN_EN_QUICK_GUIDE_ONE_LINE,
};

export const HELP_CENTER_CONTENT = {
  en: EN,
  fr: {
    ...EN,
    brand: "Centre d'aide",
    title: "Aide & Support",
    subtitle:
      "Vous n'êtes pas seul. Cette page vous accompagne pas à pas, comme un ami à vos côtés.",
    back: "Retour",
    quickTitle: "Guide de démarrage",
    quickBody: "Nouveau sur Haven Ring ? Commencez ici avec un guide simple.",
    quickCta: "Ouvrir le guide",
    tapTitle: "Comment toucher votre bague",
    tapBody: "Voyez exactement où placer la bague et combien de temps la maintenir.",
    tapBodyByPlatform: {
      ios: "Parcours iPhone : placez la bague pres de la camera arriere haute et gardez-la immobile 3-5 secondes.",
      android: "Parcours Android : commencez en zone milieu-haute et gardez-la immobile 2-4 secondes.",
      other: "Parcours general : commencez en zone arriere haute, gardez immobile, puis ajustez legerement.",
    },
    tapCta: "Ouvrir le guide NFC",
    troubleshootingTitle: "Dépannage",
    troubleshootingBody: "Si quelque chose ne va pas, commencez par ces solutions rapides.",
    troubleshootingBodyByPlatform: {
      ios: "Nous montrons d'abord les solutions iPhone, etape par etape.",
      android: "Nous montrons d'abord les solutions Android, etape par etape.",
      other: "Nous montrons d'abord les solutions generales, etape par etape.",
    },
    faqTitle: "Questions fréquentes",
    contactTitle: "Contacter le support",
    contactBody: "Toujours bloqué ? Écrivez-nous et nous vous aiderons.",
    showDetails: "Afficher les détails",
    hideDetails: "Masquer les détails",
    actionLabel: "Ce que vous voulez faire",
    ringRequiredLabel: "Bague requise :",
    recommendedLabel: "Recommandé :",
    howHavenWorksTitle: "Comment Haven fonctionne",
    howHavenWorksIntro:
      "Face ID protège votre compte. Votre bague vous offre un accès rapide et un rituel spécial pour vos souvenirs les plus précieux.",
    howHavenWorksRows: [
      {
        operation: "Ouvrir l'application au quotidien",
        ringRequired: "Non (fortement recommandé)",
        recommended: "Touchez votre bague (le plus rapide) ou utilisez Face ID",
      },
      {
        operation: "Notes rapides et brouillons",
        ringRequired: "Non",
        recommended: "Commencez simplement à écrire",
      },
      {
        operation: "Sceller un souvenir important",
        ringRequired: "Oui",
        recommended: "Seal with Ring (requis)",
      },
      {
        operation: "Ajouter ou retirer une bague",
        ringRequired: "Oui",
        recommended: "Confirmation Face ID",
      },
      {
        operation: "Exporter des données",
        ringRequired: "Oui",
        recommended: "Confirmation Face ID",
      },
      {
        operation: "Supprimer des souvenirs scellés",
        ringRequired: "Oui",
        recommended: "Face ID + confirmation supplémentaire",
      },
      {
        operation: "Gérer une bague perdue",
        ringRequired: "Non",
        recommended: "Révoquez depuis tout appareil connecté",
      },
    ],
    howHavenWorksKeyPointsTitle: "5 points clés",
    howHavenWorksKeyPoints: [
      "1. La bague est une clé rapide et un outil de rituel (pas l'unique preuve d'identité).",
      "2. Au quotidien, le toucher de la bague est recommandé — Face ID reste disponible en secours.",
      "3. Les souvenirs importants ne peuvent être scellés qu'avec une bague de confiance.",
      "4. Les actions à risque (ajouter des bagues, exporter, supprimer du contenu scellé) demandent en principe une vérification secondaire.",
      "5. Vos souvenirs sont chiffrés sur les parcours pris en charge et conservés comme enregistrements scellés sur vos appareils (non modifiables à la volée).",
    ],
    howHavenWorksOneLine:
      "La bague est votre clé magique pour la vitesse et le rituel. Face ID protège tout.",
  },
  es: {
    ...EN,
    brand: "Centro de ayuda",
    title: "Ayuda y soporte",
    subtitle:
      "No estás solo. Esta página te guía paso a paso, como un amigo a tu lado.",
    back: "Volver",
    quickTitle: "Guía de inicio rápido",
    quickBody: "¿Nuevo en Haven Ring? Empieza aquí con una guía tranquila.",
    quickCta: "Abrir guía inicial",
    tapTitle: "Cómo tocar tu anillo",
    tapBody: "Mira exactamente dónde colocar el anillo y cuánto mantenerlo.",
    tapBodyByPlatform: {
      ios: "Ruta iPhone: coloca el anillo cerca de la camara trasera superior y mantenlo inmovil 3-5 segundos.",
      android: "Ruta Android: empieza en la zona media superior y mantenlo inmovil 2-4 segundos.",
      other: "Ruta general: empieza en la zona superior trasera, manten inmovil y ajusta ligeramente.",
    },
    tapCta: "Abrir guía NFC",
    troubleshootingTitle: "Solución de problemas",
    troubleshootingBody: "Si algo falla, empieza con estas soluciones rápidas.",
    troubleshootingBodyByPlatform: {
      ios: "Mostramos primero las soluciones para iPhone, paso a paso.",
      android: "Mostramos primero las soluciones para Android, paso a paso.",
      other: "Mostramos primero las soluciones generales, paso a paso.",
    },
    faqTitle: "Preguntas comunes",
    contactTitle: "Contactar soporte",
    contactBody: "¿Sigues atascado? Escríbenos y te ayudamos.",
    showDetails: "Mostrar detalles",
    hideDetails: "Ocultar detalles",
    actionLabel: "Qué quieres hacer",
    ringRequiredLabel: "¿Anillo requerido?:",
    recommendedLabel: "Recomendado:",
    howHavenWorksTitle: "Cómo funciona Haven",
    howHavenWorksIntro:
      "Face ID protege tu cuenta. Tu anillo te da acceso rápido y un ritual especial para tus recuerdos más valiosos.",
    howHavenWorksRows: [
      {
        operation: "Abrir la app a diario",
        ringRequired: "No (muy recomendado)",
        recommended: "Toca tu anillo (más rápido) o usa Face ID",
      },
      {
        operation: "Notas rápidas y borradores",
        ringRequired: "No",
        recommended: "Empieza a escribir",
      },
      {
        operation: "Sellar un recuerdo importante",
        ringRequired: "Sí",
        recommended: "Seal with Ring (requerido)",
      },
      {
        operation: "Añadir o quitar un anillo",
        ringRequired: "Sí",
        recommended: "Confirmación con Face ID",
      },
      {
        operation: "Exportar datos",
        ringRequired: "Sí",
        recommended: "Confirmación con Face ID",
      },
      {
        operation: "Eliminar recuerdos sellados",
        ringRequired: "Sí",
        recommended: "Face ID + confirmación extra",
      },
      {
        operation: "Gestionar un anillo perdido",
        ringRequired: "No",
        recommended: "Revoca desde cualquier dispositivo con sesión activa",
      },
    ],
    howHavenWorksKeyPointsTitle: "5 puntos clave",
    howHavenWorksKeyPoints: [
      "1. El anillo es una llave rápida y una herramienta de ritual (no es la única credencial).",
      "2. Para el uso diario, se recomienda tocar el anillo — Face ID sigue disponible como alternativa.",
      "3. Los recuerdos importantes solo se pueden sellar con un anillo de confianza.",
      "4. Las acciones de alto riesgo (añadir anillos, exportar, borrar contenido sellado) suelen requerir verificación secundaria.",
      "5. Tus recuerdos están protegidos con cifrado fuerte en flujos compatibles y se guardan como registros sellados en tus dispositivos (no editables de forma casual).",
    ],
    howHavenWorksOneLine:
      "El anillo es tu llave mágica para velocidad y ceremonia. Face ID lo mantiene seguro.",
  },
  de: {
    ...EN,
    brand: "Hilfecenter",
    title: "Hilfe & Support",
    subtitle:
      "Du bist nicht allein. Diese Seite führt dich Schritt für Schritt wie ein Freund.",
    back: "Zurück",
    quickTitle: "Schnellstart",
    quickBody: "Neu bei Haven Ring? Starte hier mit einer ruhigen Einführung.",
    quickCta: "Startanleitung öffnen",
    tapTitle: "Ring richtig antippen",
    tapBody: "Sieh genau, wo der Ring liegt und wie lange du halten solltest.",
    tapBodyByPlatform: {
      ios: "iPhone-Pfad: Ring oben hinten nahe der Kamera platzieren und 3-5 Sekunden ganz ruhig halten.",
      android: "Android-Pfad: im oberen Mittelbereich starten und 2-4 Sekunden ganz ruhig halten.",
      other: "Allgemeiner Pfad: oben hinten starten, ganz ruhig halten und leicht anpassen.",
    },
    tapCta: "NFC-Anleitung öffnen",
    troubleshootingTitle: "Fehlerbehebung",
    troubleshootingBody: "Wenn etwas hakt, beginne mit diesen schnellen Lösungen.",
    troubleshootingBodyByPlatform: {
      ios: "Wir zeigen zuerst iPhone-Loesungen, Schritt fuer Schritt.",
      android: "Wir zeigen zuerst Android-Loesungen, Schritt fuer Schritt.",
      other: "Wir zeigen zuerst allgemeine Loesungen, Schritt fuer Schritt.",
    },
    faqTitle: "Häufige Fragen",
    contactTitle: "Support kontaktieren",
    contactBody: "Noch Probleme? Schreib uns, wir helfen dir.",
    showDetails: "Details anzeigen",
    hideDetails: "Details ausblenden",
    actionLabel: "Was du tun möchtest",
    ringRequiredLabel: "Ring erforderlich:",
    recommendedLabel: "Empfohlen:",
    howHavenWorksTitle: "So funktioniert Haven",
    howHavenWorksIntro:
      "Face ID schützt dein Konto. Dein Ring gibt dir schnellen Zugriff und ein besonderes Ritual für deine wertvollsten Erinnerungen.",
    howHavenWorksRows: [
      {
        operation: "App täglich öffnen",
        ringRequired: "Nein (dringend empfohlen)",
        recommended: "Ring berühren (am schnellsten) oder Face ID verwenden",
      },
      {
        operation: "Schnelle Notizen und Entwürfe",
        ringRequired: "Nein",
        recommended: "Einfach losschreiben",
      },
      {
        operation: "Wichtige Erinnerung versiegeln",
        ringRequired: "Ja",
        recommended: "Seal with Ring (erforderlich)",
      },
      {
        operation: "Ring hinzufügen oder entfernen",
        ringRequired: "Ja",
        recommended: "Face ID-Bestätigung",
      },
      {
        operation: "Daten exportieren",
        ringRequired: "Ja",
        recommended: "Face ID-Bestätigung",
      },
      {
        operation: "Versiegelte Inhalte löschen",
        ringRequired: "Ja",
        recommended: "Face ID + zusätzliche Bestätigung",
      },
      {
        operation: "Verlorenen Ring handhaben",
        ringRequired: "Nein",
        recommended: "Von jedem angemeldeten Gerät widerrufen",
      },
    ],
    howHavenWorksKeyPointsTitle: "5 Kernpunkte",
    howHavenWorksKeyPoints: [
      "1. Der Ring ist ein schneller Schlüssel und ein Ritual-Tool (nicht der einzige Nachweis).",
      "2. Für den Alltag wird Ring-Berührung empfohlen — Face ID bleibt als Alternative verfügbar.",
      "3. Wichtige Erinnerungen können nur mit einem vertrauenswürdigen Ring versiegelt werden.",
      "4. Risikoaktionen (Ringe hinzufügen, Export, versiegelte Inhalte löschen) erfordern in der Regel eine zweite Verifikation.",
      "5. Deine Erinnerungen sind auf unterstützten Wegen stark verschlüsselt und werden als versiegelte Datensätze auf deinen Geräten gespeichert (nicht beliebig editierbar).",
    ],
    howHavenWorksOneLine:
      "Der Ring ist dein magischer Schlüssel für Tempo und Zeremonie. Face ID hält alles sicher.",
  },
  it: {
    ...EN,
    brand: "Centro assistenza",
    title: "Aiuto e supporto",
    subtitle:
      "Non sei solo. Questa pagina ti guida passo dopo passo, come un amico al tuo fianco.",
    back: "Indietro",
    quickTitle: "Guida rapida",
    quickBody: "Nuovo su Haven Ring? Inizia qui con una guida semplice.",
    quickCta: "Apri guida iniziale",
    tapTitle: "Come toccare l'anello",
    tapBody: "Vedi esattamente dove posizionare l'anello e per quanto tenerlo.",
    tapBodyByPlatform: {
      ios: "Percorso iPhone: posiziona l'anello vicino alla fotocamera posteriore alta e tienilo ben fermo 3-5 secondi.",
      android: "Percorso Android: inizia dalla zona medio-alta e tienilo ben fermo 2-4 secondi.",
      other: "Percorso generale: inizia dalla zona alta posteriore, tieni fermo e regola leggermente.",
    },
    tapCta: "Apri guida NFC",
    troubleshootingTitle: "Risoluzione problemi",
    troubleshootingBody: "Se qualcosa non va, inizia da queste soluzioni rapide.",
    troubleshootingBodyByPlatform: {
      ios: "Mostriamo prima le soluzioni iPhone, passo dopo passo.",
      android: "Mostriamo prima le soluzioni Android, passo dopo passo.",
      other: "Mostriamo prima le soluzioni generali, passo dopo passo.",
    },
    faqTitle: "Domande comuni",
    contactTitle: "Contatta il supporto",
    contactBody: "Ancora bloccato? Scrivici e ti aiutiamo.",
    showDetails: "Mostra dettagli",
    hideDetails: "Nascondi dettagli",
    actionLabel: "Cosa vuoi fare",
    ringRequiredLabel: "Anello richiesto:",
    recommendedLabel: "Consigliato:",
    howHavenWorksTitle: "Come funziona Haven",
    howHavenWorksIntro:
      "Face ID protegge il tuo account. Il tuo anello ti dà accesso rapido e un rituale speciale per i tuoi ricordi più preziosi.",
    howHavenWorksRows: [
      {
        operation: "Aprire l'app ogni giorno",
        ringRequired: "No (fortemente consigliato)",
        recommended: "Tocca l'anello (più rapido) o usa Face ID",
      },
      {
        operation: "Note veloci e bozze",
        ringRequired: "No",
        recommended: "Inizia semplicemente a scrivere",
      },
      {
        operation: "Sigillare un ricordo importante",
        ringRequired: "Sì",
        recommended: "Seal with Ring (richiesto)",
      },
      {
        operation: "Aggiungere o rimuovere un anello",
        ringRequired: "Sì",
        recommended: "Conferma con Face ID",
      },
      {
        operation: "Esportare dati",
        ringRequired: "Sì",
        recommended: "Conferma con Face ID",
      },
      {
        operation: "Eliminare ricordi sigillati",
        ringRequired: "Sì",
        recommended: "Face ID + conferma extra",
      },
      {
        operation: "Gestire un anello smarrito",
        ringRequired: "No",
        recommended: "Revoca da qualsiasi dispositivo con accesso attivo",
      },
    ],
    howHavenWorksKeyPointsTitle: "5 punti chiave",
    howHavenWorksKeyPoints: [
      "1. L'anello è una chiave veloce e uno strumento di rituale (non è l'unica credenziale).",
      "2. Per l'uso quotidiano è consigliato toccare l'anello — Face ID resta disponibile come alternativa.",
      "3. I ricordi importanti possono essere sigillati solo con un anello fidato.",
      "4. Le azioni ad alto rischio (aggiungere anelli, esportare, eliminare contenuti sigillati) richiedono di solito una verifica secondaria.",
      "5. I tuoi ricordi sono protetti con cifratura robusta nei flussi supportati e conservati come record sigillati sui tuoi dispositivi (non modificabili in modo occasionale).",
    ],
    howHavenWorksOneLine:
      "L'anello è la tua chiave magica per velocità e cerimonia. Face ID mantiene tutto al sicuro.",
  },
};

export function getHelpCenterContent(locale = "en", platform = "ios") {
  const base = HELP_CENTER_CONTENT[locale] || HELP_CENTER_CONTENT.en;
  const platformKey =
    platform === "android" || platform === "other" ? platform : "ios";

  return {
    ...base,
    tapBody: base.tapBodyByPlatform?.[platformKey] || base.tapBody,
    troubleshootingBody:
      base.troubleshootingBodyByPlatform?.[platformKey] ||
      base.troubleshootingBody,
  };
}
