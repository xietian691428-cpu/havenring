const EN = {
  title: "How to Use Your NFC Ring",
  diagramAriaLabel: "iPhone back NFC target diagram",
  sweetSpotLabel: "NFC sweet spot",
  gotIt: "Got it",
  later: "Show me again later",
  read: "Try Ring Read",
  write: "Write Fixed Haven Entry",
  reading: "Reading...",
  writing: "Writing...",
  hold: "Hold your ring still near the camera area...",
  writingStatus: "Writing fixed Haven entry to ring...",
  writeSuccess: "Fixed Haven entry written successfully.",
  ringDetected: "Ring detected: ",
  platforms: {
    ios: {
      intro:
        "iPhone path (recommended). Follow these simple steps once, and daily use becomes effortless.",
      steps: [
        { title: "Step 1", body: "Place your ring on the upper back of your iPhone near the camera.", icon: "📍" },
        { title: "Step 2", body: "Keep it steady for 3-5 seconds.", icon: "⏳" },
        { title: "Step 3", body: "Light tap is enough for daily use.", icon: "✨" },
        { title: "Step 4", body: "If nothing happens, gently reposition and try once more.", icon: "🔁" },
      ],
    },
    android: {
      intro:
        "Android path. Most phones read NFC around the upper middle back, then daily use becomes quick and easy.",
      steps: [
        { title: "Step 1", body: "Place your ring on the upper-middle back of your Android phone.", icon: "📍" },
        { title: "Step 2", body: "Keep it still for 2-4 seconds.", icon: "⏳" },
        { title: "Step 3", body: "If no response, move 1-2 cm and try once.", icon: "🔍" },
        { title: "Step 4", body: "Once detected, a light tap is enough for daily use.", icon: "✨" },
      ],
    },
    other: {
      intro:
        "General path. Keep the ring on the upper back area, hold steady, then adjust slightly if needed.",
      steps: [
        { title: "Step 1", body: "Start from the upper back area of your phone.", icon: "📍" },
        { title: "Step 2", body: "Hold still for 3-5 seconds.", icon: "⏳" },
        { title: "Step 3", body: "If no response, move a little and try again.", icon: "🔍" },
        { title: "Step 4", body: "After the first success, daily tap becomes easy.", icon: "✨" },
      ],
    },
  },
};

export const NFC_GUIDE_CONTENT = {
  en: EN,
  fr: {
    ...EN,
    title: "Comment utiliser votre bague NFC",
    gotIt: "Compris",
    later: "Me le rappeler plus tard",
    platforms: {
      ios: {
        intro:
          "Parcours iPhone (recommande). Suivez ces etapes pas a pas une seule fois, puis l'usage quotidien devient facile.",
        steps: [
          { title: "Etape 1", body: "Placez votre bague en haut du dos de votre iPhone, pres de la camera.", icon: "📍" },
          { title: "Etape 2", body: "Gardez-la immobile pendant 3-5 secondes.", icon: "⏳" },
          { title: "Etape 3", body: "Pour le quotidien, un leger contact suffit.", icon: "✨" },
          { title: "Etape 4", body: "Si rien ne se passe, repositionnez doucement et reessayez.", icon: "🔁" },
        ],
      },
      android: {
        intro:
          "Parcours Android. La plupart des telephones lisent le NFC au milieu haut du dos, pas a pas.",
        steps: [
          { title: "Etape 1", body: "Placez votre bague au milieu haut du dos de votre telephone Android.", icon: "📍" },
          { title: "Etape 2", body: "Gardez-la immobile pendant 2-4 secondes.", icon: "⏳" },
          { title: "Etape 3", body: "Sans reponse, deplacez de 1-2 cm puis reessayez.", icon: "🔍" },
          { title: "Etape 4", body: "Apres detection, un leger contact suffit au quotidien.", icon: "✨" },
        ],
      },
      other: {
        intro:
          "Parcours general. Commencez en haut du dos du telephone, gardez fixe, puis ajustez legerement, pas a pas.",
        steps: [
          { title: "Etape 1", body: "Commencez par la zone haute arriere du telephone.", icon: "📍" },
          { title: "Etape 2", body: "Restez immobile 3-5 secondes.", icon: "⏳" },
          { title: "Etape 3", body: "Sans reponse, bougez legerement et reessayez.", icon: "🔍" },
          { title: "Etape 4", body: "Apres un premier succes, le tap quotidien devient simple.", icon: "✨" },
        ],
      },
    },
  },
  es: {
    ...EN,
    title: "Cómo usar tu anillo NFC",
    gotIt: "Entendido",
    later: "Mostrar de nuevo más tarde",
    platforms: {
      ios: {
        intro:
          "Ruta iPhone (recomendada). Sigue estos pasos paso a paso una vez y el uso diario sera facil.",
        steps: [
          { title: "Paso 1", body: "Coloca el anillo en la parte superior trasera de tu iPhone, cerca de la camara.", icon: "📍" },
          { title: "Paso 2", body: "Mantenlo inmovil durante 3-5 segundos.", icon: "⏳" },
          { title: "Paso 3", body: "Para el uso diario, un toque suave es suficiente.", icon: "✨" },
          { title: "Paso 4", body: "Si no pasa nada, recoloca suavemente y prueba otra vez.", icon: "🔁" },
        ],
      },
      android: {
        intro:
          "Ruta Android. La mayoria de telefonos leen NFC en la zona media superior trasera, paso a paso.",
        steps: [
          { title: "Paso 1", body: "Coloca el anillo en la parte media superior trasera de tu Android.", icon: "📍" },
          { title: "Paso 2", body: "Mantenlo inmovil por 2-4 segundos.", icon: "⏳" },
          { title: "Paso 3", body: "Si no responde, mueve 1-2 cm y vuelve a intentar.", icon: "🔍" },
          { title: "Paso 4", body: "Tras detectarlo, un toque suave basta para el dia a dia.", icon: "✨" },
        ],
      },
      other: {
        intro:
          "Ruta general. Empieza por la parte superior trasera, manten estable y ajusta ligeramente si hace falta, paso a paso.",
        steps: [
          { title: "Paso 1", body: "Empieza desde la zona superior trasera del telefono.", icon: "📍" },
          { title: "Paso 2", body: "Mantente inmovil 3-5 segundos.", icon: "⏳" },
          { title: "Paso 3", body: "Si no responde, mueve un poco y prueba de nuevo.", icon: "🔍" },
          { title: "Paso 4", body: "Despues del primer exito, el toque diario sera sencillo.", icon: "✨" },
        ],
      },
    },
  },
  de: {
    ...EN,
    title: "So nutzt du deinen NFC-Ring",
    gotIt: "Verstanden",
    later: "Später erneut zeigen",
    platforms: {
      ios: {
        intro:
          "iPhone-Pfad (empfohlen). Folge diesen Schritten einmal, dann ist der Alltag ganz leicht.",
        steps: [
          { title: "Schritt 1", body: "Lege den Ring oben auf die Rueckseite deines iPhones nahe der Kamera.", icon: "📍" },
          { title: "Schritt 2", body: "Halte ihn 3-5 Sekunden ganz ruhig.", icon: "⏳" },
          { title: "Schritt 3", body: "Im Alltag reicht ein sanfter Tipp.", icon: "✨" },
          { title: "Schritt 4", body: "Wenn nichts passiert, leicht neu positionieren und erneut versuchen.", icon: "🔁" },
        ],
      },
      android: {
        intro:
          "Android-Pfad. Bei den meisten Geraeten liegt der NFC-Bereich mittig oben auf der Rueckseite, Schritt fuer Schritt.",
        steps: [
          { title: "Schritt 1", body: "Lege den Ring auf den oberen Mittelbereich der Android-Rueckseite.", icon: "📍" },
          { title: "Schritt 2", body: "Halte ihn 2-4 Sekunden ganz ruhig.", icon: "⏳" },
          { title: "Schritt 3", body: "Bei keiner Reaktion 1-2 cm verschieben und erneut probieren.", icon: "🔍" },
          { title: "Schritt 4", body: "Nach erster Erkennung reicht ein leichter Tipp im Alltag.", icon: "✨" },
        ],
      },
      other: {
        intro:
          "Allgemeiner Pfad. Oben auf der Rueckseite starten, ruhig halten, dann leicht anpassen, Schritt fuer Schritt.",
        steps: [
          { title: "Schritt 1", body: "Beginne im oberen Rueckseitenbereich des Telefons.", icon: "📍" },
          { title: "Schritt 2", body: "3-5 Sekunden ganz ruhig halten.", icon: "⏳" },
          { title: "Schritt 3", body: "Ohne Reaktion leicht verschieben und erneut tippen.", icon: "🔍" },
          { title: "Schritt 4", body: "Nach dem ersten Erfolg wird der Alltag sehr einfach.", icon: "✨" },
        ],
      },
    },
  },
  it: {
    ...EN,
    title: "Come usare il tuo anello NFC",
    gotIt: "Capito",
    later: "Mostramelo più tardi",
    platforms: {
      ios: {
        intro:
          "Percorso iPhone (consigliato). Segui questi passaggi passo dopo passo una volta e poi l'uso quotidiano sara semplice.",
        steps: [
          { title: "Passo 1", body: "Posiziona l'anello nella parte alta posteriore dell'iPhone vicino alla fotocamera.", icon: "📍" },
          { title: "Passo 2", body: "Tienilo ben fermo per 3-5 secondi.", icon: "⏳" },
          { title: "Passo 3", body: "Per l'uso quotidiano basta un tocco leggero.", icon: "✨" },
          { title: "Passo 4", body: "Se non succede nulla, riposiziona delicatamente e riprova.", icon: "🔁" },
        ],
      },
      android: {
        intro:
          "Percorso Android. Su molti telefoni la lettura NFC e nella zona medio-alta posteriore, passo dopo passo.",
        steps: [
          { title: "Passo 1", body: "Posiziona l'anello nella zona medio-alta posteriore del tuo Android.", icon: "📍" },
          { title: "Passo 2", body: "Tienilo ben fermo per 2-4 secondi.", icon: "⏳" },
          { title: "Passo 3", body: "Se non risponde, spostalo di 1-2 cm e riprova.", icon: "🔍" },
          { title: "Passo 4", body: "Dopo il primo rilevamento, un tocco leggero basta ogni giorno.", icon: "✨" },
        ],
      },
      other: {
        intro:
          "Percorso generale. Parti dalla parte alta posteriore, tieni fermo e regola leggermente se serve, passo dopo passo.",
        steps: [
          { title: "Passo 1", body: "Inizia dalla zona alta posteriore del telefono.", icon: "📍" },
          { title: "Passo 2", body: "Tieni ben fermo per 3-5 secondi.", icon: "⏳" },
          { title: "Passo 3", body: "Se non risponde, sposta leggermente e riprova.", icon: "🔍" },
          { title: "Passo 4", body: "Dopo il primo successo, l'uso quotidiano diventa facile.", icon: "✨" },
        ],
      },
    },
  },
};

export function getNfcGuideContent(locale = "en", platform = "ios") {
  const base = NFC_GUIDE_CONTENT[locale] || NFC_GUIDE_CONTENT.en;
  const platformKey =
    platform === "android" || platform === "other" ? platform : "ios";
  const platformCopy =
    base.platforms?.[platformKey] ||
    NFC_GUIDE_CONTENT.en.platforms[platformKey] ||
    NFC_GUIDE_CONTENT.en.platforms.ios;

  return {
    ...base,
    intro: platformCopy.intro,
    steps: platformCopy.steps,
  };
}
