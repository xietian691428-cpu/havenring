export const NFC_TROUBLESHOOTING_CONTENT = {
  en: {
    sectionAriaLabel: "NFC troubleshooting",
    title: "Need help with ring tap?",
    subtitle: "Quick fixes for common NFC moments.",
    platformSubtitle: {
      ios: "Showing iPhone-first guidance.",
      android: "Showing Android guidance.",
      other: "Showing general phone guidance.",
    },
    platforms: {
      ios: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Tap not working",
          answer:
            "Place the ring on the upper back near the camera. If your phone has a thick case, remove it and try again.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connection lost / Stack Error",
          answer:
            "Keep the ring completely still for 5 seconds, then try once more. A steady hold usually fixes this.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Nothing happens",
          answer:
            "Make sure NFC is enabled on your phone, then gently tap again near the camera area.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Still not working after multiple tries",
          answer:
            "Take a short pause, unlock your phone, and try in a quieter spot without movement. Slow and steady works best.",
        },
      ],
      android: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Tap not working",
          answer:
            "Try the upper-middle back first. If no response, move the ring slowly across the middle back area.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connection lost / Stack Error",
          answer:
            "Hold your ring and phone still for 3-5 seconds. Movement during scan can break the connection.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Nothing happens",
          answer:
            "Check NFC is enabled in quick settings, unlock the phone, then try again.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Still not working after multiple tries",
          answer:
            "Remove thick case, pause for 10 seconds, then retry with a steady hold.",
        },
      ],
      other: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Tap not working",
          answer:
            "Start from the upper back area and hold still. Move slightly if needed.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connection lost / Stack Error",
          answer: "Keep both phone and ring steady for 5 seconds, then try once.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Nothing happens",
          answer: "Make sure NFC is on and your phone is unlocked.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Still not working after multiple tries",
          answer: "Take a short pause and retry with slower, steadier motion.",
        },
      ],
    },
  },
  fr: {
    title: "Besoin d'aide pour le tap ?",
    subtitle: "Corrections rapides pour les problèmes NFC courants.",
    platformSubtitle: {
      ios: "Nous affichons d'abord les solutions iPhone, pas a pas.",
      android: "Nous affichons d'abord les solutions Android, pas a pas.",
      other: "Nous affichons d'abord les solutions generales, pas a pas.",
    },
    platforms: {
      ios: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Le tap ne fonctionne pas",
          answer:
            "Placez la bague en haut du dos du telephone pres de la camera. Si la coque est epaisse, retirez-la puis reessayez.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connexion perdue / Erreur de lecture",
          answer:
            "Gardez la bague bien immobile 5 secondes, puis reessayez une fois.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Rien ne se passe",
          answer: "Verifiez que le NFC est active puis retouchez doucement une fois.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Toujours bloque apres plusieurs essais",
          answer: "Faites une courte pause puis reessayez sans bouger.",
        },
      ],
      android: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Le tap ne fonctionne pas",
          answer:
            "Essayez d'abord la zone milieu-haut du dos du telephone. Deplacez lentement si besoin.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connexion perdue / Erreur de lecture",
          answer: "Gardez telephone et bague bien stables 3-5 secondes.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Rien ne se passe",
          answer: "Activez le NFC, deverrouillez le telephone, puis reessayez.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Toujours bloque apres plusieurs essais",
          answer: "Retirez la coque epaisse, attendez 10 secondes puis retentez.",
        },
      ],
      other: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Le tap ne fonctionne pas",
          answer: "Commencez en haut du dos du telephone et gardez fixe.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connexion perdue / Erreur de lecture",
          answer: "Restez immobile 5 secondes puis reessayez une fois.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Rien ne se passe",
          answer: "Verifiez NFC active et telephone deverrouille.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Toujours bloque apres plusieurs essais",
          answer: "Faites une pause courte puis reessayez plus lentement.",
        },
      ],
    },
    items: [
      {
        id: "tap-not-working",
        icon: "📶",
        question: "Le tap ne fonctionne pas",
        answer:
          "Placez la bague en haut du dos du téléphone près de la caméra. Si la coque est épaisse, retirez-la puis réessayez.",
      },
      {
        id: "connection-lost",
        icon: "🧩",
        question: "Connexion perdue / Erreur de lecture",
        answer:
          "Gardez la bague complètement immobile pendant 5 secondes, puis réessayez. Une tenue stable règle souvent le problème.",
      },
      {
        id: "nothing-happens",
        icon: "🤔",
        question: "Rien ne se passe",
        answer:
          "Vérifiez que le NFC est activé sur votre téléphone, puis retouchez doucement près de la caméra.",
      },
      {
        id: "too-many-tries",
        icon: "🌙",
        question: "Toujours bloqué après plusieurs essais",
        answer:
          "Faites une petite pause, déverrouillez votre téléphone et réessayez dans un endroit plus calme, sans bouger.",
      },
    ],
  },
  es: {
    title: "¿Necesitas ayuda con el toque?",
    subtitle: "Soluciones rápidas para momentos NFC comunes.",
    platformSubtitle: {
      ios: "Mostramos primero las soluciones para iPhone, paso a paso.",
      android: "Mostramos primero las soluciones para Android, paso a paso.",
      other: "Mostramos primero las soluciones generales, paso a paso.",
    },
    platforms: {
      ios: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "El toque no funciona",
          answer:
            "Coloca el anillo en la parte superior trasera cerca de la camara. Si hay funda gruesa, retirala y prueba.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Conexión perdida / Error de lectura",
          answer: "Manten el anillo bien inmovil 5 segundos y vuelve a intentar.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "No pasa nada",
          answer: "Activa NFC y vuelve a tocar suavemente una vez.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Sigue fallando despues de varios intentos",
          answer: "Haz una pausa corta y prueba otra vez sin movimiento.",
        },
      ],
      android: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "El toque no funciona",
          answer:
            "Empieza en la zona media superior trasera. Mueve lentamente el anillo si no responde.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Conexión perdida / Error de lectura",
          answer: "Mantén telefono y anillo quietos durante 3-5 segundos.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "No pasa nada",
          answer: "Activa NFC, desbloquea el telefono y vuelve a intentar.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Sigue fallando despues de varios intentos",
          answer: "Quita la funda gruesa, espera 10 segundos y prueba de nuevo.",
        },
      ],
      other: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "El toque no funciona",
          answer: "Empieza por la parte superior trasera y mantenlo quieto.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Conexión perdida / Error de lectura",
          answer: "Manten ambos quietos 5 segundos y prueba una vez.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "No pasa nada",
          answer: "Verifica NFC activo y telefono desbloqueado.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Sigue fallando despues de varios intentos",
          answer: "Haz una pausa corta y vuelve a intentar mas despacio.",
        },
      ],
    },
    items: [
      {
        id: "tap-not-working",
        icon: "📶",
        question: "El toque no funciona",
        answer:
          "Coloca el anillo en la parte superior trasera cerca de la cámara. Si usas una funda gruesa, retírala e inténtalo de nuevo.",
      },
      {
        id: "connection-lost",
        icon: "🧩",
        question: "Conexión perdida / Error de lectura",
        answer:
          "Mantén el anillo completamente quieto durante 5 segundos y vuelve a intentar. Mantenerlo estable suele resolverlo.",
      },
      {
        id: "nothing-happens",
        icon: "🤔",
        question: "No pasa nada",
        answer:
          "Asegúrate de que NFC esté activado en tu teléfono, luego toca de nuevo suavemente cerca de la cámara.",
      },
      {
        id: "too-many-tries",
        icon: "🌙",
        question: "Sigue fallando después de varios intentos",
        answer:
          "Haz una pausa breve, desbloquea tu teléfono y vuelve a intentarlo en un lugar más quieto, sin movimiento.",
      },
    ],
  },
  de: {
    title: "Hilfe beim Antippen?",
    subtitle: "Schnelle Lösungen für häufige NFC-Momente.",
    platformSubtitle: {
      ios: "Wir zeigen zuerst iPhone-Loesungen, Schritt fuer Schritt.",
      android: "Wir zeigen zuerst Android-Loesungen, Schritt fuer Schritt.",
      other: "Wir zeigen zuerst allgemeine Loesungen, Schritt fuer Schritt.",
    },
    platforms: {
      ios: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Tippen funktioniert nicht",
          answer:
            "Lege den Ring oben nahe der Kamera auf die Rueckseite. Dicke Huelle kurz entfernen und erneut versuchen.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Verbindung verloren / Lesefehler",
          answer: "Ring 5 Sekunden ganz ruhig halten und erneut versuchen.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Es passiert nichts",
          answer: "NFC aktivieren und erneut sanft antippen, einmal.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Nach mehreren Versuchen immer noch nicht",
          answer: "Kurz pausieren und ohne Bewegung erneut versuchen.",
        },
      ],
      android: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Tippen funktioniert nicht",
          answer:
            "Starte im oberen Mittelbereich der Rueckseite und verschiebe langsam bei Bedarf.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Verbindung verloren / Lesefehler",
          answer: "Telefon und Ring 3-5 Sekunden komplett ruhig halten.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Es passiert nichts",
          answer: "NFC einschalten, Telefon entsperren, dann erneut versuchen.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Nach mehreren Versuchen immer noch nicht",
          answer: "Dicke Huelle entfernen, 10 Sekunden warten und erneut testen.",
        },
      ],
      other: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Tippen funktioniert nicht",
          answer: "Im oberen Rueckseitenbereich starten und ruhig halten.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Verbindung verloren / Lesefehler",
          answer: "Beides 5 Sekunden ruhig halten, dann erneut probieren.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Es passiert nichts",
          answer: "NFC aktiv und Telefon entsperrt pruefen.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Nach mehreren Versuchen immer noch nicht",
          answer: "Kurz pausieren und langsamer erneut versuchen.",
        },
      ],
    },
    items: [
      {
        id: "tap-not-working",
        icon: "📶",
        question: "Tippen funktioniert nicht",
        answer:
          "Lege den Ring oben auf die Rückseite nahe der Kamera. Wenn die Hülle dick ist, nimm sie kurz ab und versuche es erneut.",
      },
      {
        id: "connection-lost",
        icon: "🧩",
        question: "Verbindung verloren / Lesefehler",
        answer:
          "Halte den Ring 5 Sekunden komplett still und versuche es noch einmal. Ruhiges Halten löst das meist.",
      },
      {
        id: "nothing-happens",
        icon: "🤔",
        question: "Es passiert nichts",
        answer:
          "Prüfe, ob NFC auf deinem Telefon aktiviert ist, und tippe dann sanft in Kameranähe erneut an.",
      },
      {
        id: "too-many-tries",
        icon: "🌙",
        question: "Nach mehreren Versuchen immer noch nicht",
        answer:
          "Mach kurz Pause, entsperre dein Telefon und versuche es in ruhiger Umgebung ohne Bewegung erneut.",
      },
    ],
  },
  it: {
    title: "Hai bisogno di aiuto con il tocco?",
    subtitle: "Soluzioni rapide per i momenti NFC più comuni.",
    platformSubtitle: {
      ios: "Mostriamo prima le soluzioni iPhone, passo dopo passo.",
      android: "Mostriamo prima le soluzioni Android, passo dopo passo.",
      other: "Mostriamo prima le soluzioni generali, passo dopo passo.",
    },
    platforms: {
      ios: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Il tocco non funziona",
          answer:
            "Posiziona l'anello in alto vicino alla fotocamera. Se la cover e spessa, rimuovila e riprova.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connessione persa / Errore di lettura",
          answer: "Tieni l'anello ben fermo per 5 secondi e riprova.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Non succede nulla",
          answer: "Attiva NFC e tocca di nuovo con delicatezza, una volta.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Ancora non funziona dopo vari tentativi",
          answer: "Fai una breve pausa e riprova senza movimento.",
        },
      ],
      android: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Il tocco non funziona",
          answer:
            "Inizia dalla zona medio-alta posteriore e sposta lentamente se non risponde.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connessione persa / Errore di lettura",
          answer: "Tieni telefono e anello fermi per 3-5 secondi.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Non succede nulla",
          answer: "Attiva NFC, sblocca il telefono e riprova.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Ancora non funziona dopo vari tentativi",
          answer: "Rimuovi cover spessa, attendi 10 secondi e ritenta.",
        },
      ],
      other: [
        {
          id: "tap-not-working",
          icon: "📶",
          question: "Il tocco non funziona",
          answer: "Parti dalla zona alta posteriore e tieni fermo.",
        },
        {
          id: "connection-lost",
          icon: "🧩",
          question: "Connessione persa / Errore di lettura",
          answer: "Tieni tutto fermo 5 secondi, poi riprova una volta.",
        },
        {
          id: "nothing-happens",
          icon: "🤔",
          question: "Non succede nulla",
          answer: "Controlla NFC attivo e telefono sbloccato.",
        },
        {
          id: "too-many-tries",
          icon: "🌙",
          question: "Ancora non funziona dopo vari tentativi",
          answer: "Fai una pausa breve e riprova piu lentamente.",
        },
      ],
    },
    items: [
      {
        id: "tap-not-working",
        icon: "📶",
        question: "Il tocco non funziona",
        answer:
          "Posiziona l'anello sulla parte alta posteriore vicino alla fotocamera. Se la cover è spessa, rimuovila e riprova.",
      },
      {
        id: "connection-lost",
        icon: "🧩",
        question: "Connessione persa / Errore di lettura",
        answer:
          "Tieni l'anello completamente fermo per 5 secondi, poi riprova. Restare fermi di solito risolve.",
      },
      {
        id: "nothing-happens",
        icon: "🤔",
        question: "Non succede nulla",
        answer:
          "Assicurati che NFC sia attivo sul telefono, poi tocca di nuovo delicatamente vicino alla fotocamera.",
      },
      {
        id: "too-many-tries",
        icon: "🌙",
        question: "Ancora non funziona dopo vari tentativi",
        answer:
          "Fai una breve pausa, sblocca il telefono e riprova in un punto più tranquillo, senza movimento.",
      },
    ],
  },
};

export function getNfcTroubleshootingContent(locale = "en", platform = "ios") {
  const base = NFC_TROUBLESHOOTING_CONTENT[locale] || NFC_TROUBLESHOOTING_CONTENT.en;
  const platformKey =
    platform === "android" || platform === "other" ? platform : "ios";
  const platformItems =
    base.platforms?.[platformKey] ||
    NFC_TROUBLESHOOTING_CONTENT.en.platforms?.[platformKey] ||
    base.items ||
    NFC_TROUBLESHOOTING_CONTENT.en.items;

  return {
    ...base,
    items: platformItems,
    subtitle: base.platformSubtitle?.[platformKey] || base.subtitle,
  };
}
