import { getOnboardingFlowEn } from "./havenCopy";

/**
 * @param {string} locale
 * @param {"ios"|"android"|"other"} [platform]
 */
export function getFirstTimeOnboardingBundle(locale, platform = "ios") {
  if (locale === "en") return getOnboardingFlowEn(platform);
  return FIRST_TIME_ONBOARDING_CONTENT[locale] || getOnboardingFlowEn(platform);
}

/** Non-English locales: legacy 5-step flow (no `kind` — FirstTimeOnboarding uses classic layout). */
export const FIRST_TIME_ONBOARDING_CONTENT = {
  fr: {
    title: "Bienvenue sur Haven",
    stepLabelPrefix: "Étape ",
    stepLabelMiddle: " sur ",
    subtitle: "Un debut doux pour votre sanctuaire de souvenirs.",
    layeredCoreLine:
      "Face ID protège votre compte. Votre bague offre un accès rapide et un rituel spécial pour vos souvenirs les plus précieux.",
    skip: "Passer pour l'instant",
    next: "Suivant",
    back: "Retour",
    start: "Commencer maintenant",
    openNfcGuide: "En savoir plus sur les bagues",
    platformHintIos:
      "Sur iPhone, ouvrez Haven depuis l’icône Écran d’accueil pour l’expérience quotidienne la plus fluide.",
    platformHintAndroid:
      "Sur Android, vous pouvez continuer dans le navigateur et utiliser le toucher NFC de la bague de façon plus fiable.",
    steps: [
      {
        id: "welcome",
        illustration: "welcome",
        title: "Bienvenue sur Haven",
        body: "Votre sanctuaire prive pour les souvenirs les plus precieux de la vie.",
        subtitle: "Securise. Beau. A vous.",
        primaryButton: "Commencer le voyage",
      },
      {
        id: "guardian",
        illustration: "guardian",
        title: "Votre Face ID est le Gardien",
        body: "Chaque compte est protege par une securite biometrique de haut niveau. Nous ne voyons jamais vos souvenirs.",
        primaryButton: "Continuer",
      },
      {
        id: "ring-key",
        illustration: "ring-key",
        title: "La Bague est votre Cle magique",
        body: "Un toucher pour un acces instantane. Un rituel sacre pour vos souvenirs les plus importants.",
        subtitle: "Pas seulement du materiel — c'est une partie de la ceremonie.",
        primaryButton: "En savoir plus sur les bagues",
        action: "open-ring-guide",
      },
      {
        id: "memory-place",
        illustration: "draft-vs-seal",
        title: "Chaque souvenir a sa place",
        body: "Les pensees rapides vont dans les brouillons.\nLes moments profonds meritent d'etre scelles avec la bague.",
        primaryButton: "Continuer",
      },
      {
        id: "ownership",
        illustration: "ownership",
        title: "Vos souvenirs n'appartiennent qu'a vous",
        body: "Chiffres de bout en bout.\nVous gardez le controle total — y compris revoquer ou supprimer a tout moment.",
        primaryButton: "Entrer dans Haven",
      },
    ],
  },
  es: {
    title: "Bienvenido a Haven",
    stepLabelPrefix: "Paso ",
    stepLabelMiddle: " de ",
    subtitle: "Un inicio suave para tu santuario de recuerdos.",
    layeredCoreLine:
      "Face ID protege tu cuenta. Tu anillo te da acceso rápido y un ritual especial para tus recuerdos más preciados.",
    skip: "Saltar por ahora",
    next: "Siguiente",
    back: "Atrás",
    start: "Empezar ahora",
    openNfcGuide: "Conoce los anillos",
    platformHintIos:
      "En iPhone, abre Haven desde el icono de Inicio para la experiencia diaria más fluida.",
    platformHintAndroid:
      "En Android, puedes continuar en el navegador y usar el toque NFC del anillo con más fiabilidad.",
    steps: [
      {
        id: "welcome",
        illustration: "welcome",
        title: "Bienvenido a Haven",
        body: "Tu santuario privado para los recuerdos mas valiosos de la vida.",
        subtitle: "Seguro. Bello. Tuyo.",
        primaryButton: "Comenzar viaje",
      },
      {
        id: "guardian",
        illustration: "guardian",
        title: "Tu Face ID es el Guardian",
        body: "Cada cuenta esta protegida con seguridad biometrica de alto nivel. Nunca vemos tus recuerdos.",
        primaryButton: "Continuar",
      },
      {
        id: "ring-key",
        illustration: "ring-key",
        title: "El Anillo es tu Llave magica",
        body: "Un toque para acceso instantaneo. Un ritual sagrado para tus recuerdos mas importantes.",
        subtitle: "No es solo hardware — es parte de la ceremonia.",
        primaryButton: "Conoce los anillos",
        action: "open-ring-guide",
      },
      {
        id: "memory-place",
        illustration: "draft-vs-seal",
        title: "Cada recuerdo tiene su lugar",
        body: "Los pensamientos rapidos van a borradores.\nLos momentos profundos merecen sellarse con el anillo.",
        primaryButton: "Continuar",
      },
      {
        id: "ownership",
        illustration: "ownership",
        title: "Tus recuerdos solo te pertenecen a ti",
        body: "Cifrado de extremo a extremo.\nTu controlas todo — incluido revocar o borrar en cualquier momento.",
        primaryButton: "Entrar a Haven",
      },
    ],
  },
  de: {
    title: "Willkommen bei Haven",
    stepLabelPrefix: "Schritt ",
    stepLabelMiddle: " von ",
    subtitle: "Ein sanfter Start in dein Erinnerungsheiligtum.",
    layeredCoreLine:
      "Face ID schützt dein Konto. Dein Ring ermöglicht schnellen Zugang und ein besonderes Ritual für deine wertvollsten Erinnerungen.",
    skip: "Jetzt überspringen",
    next: "Weiter",
    back: "Zurück",
    start: "Jetzt starten",
    openNfcGuide: "Mehr uber Ringe",
    platformHintIos:
      "Auf dem iPhone öffnest du Haven am besten über das Home-Bildsymbol — für den ruhigsten Alltag.",
    platformHintAndroid:
      "Auf Android kannst du im Browser weitermachen und den NFC-Ring-Touch oft zuverlässiger nutzen.",
    steps: [
      {
        id: "welcome",
        illustration: "welcome",
        title: "Willkommen bei Haven",
        body: "Dein privates Heiligtum fur die wertvollsten Erinnerungen deines Lebens.",
        subtitle: "Sicher. Schon. Deins.",
        primaryButton: "Reise beginnen",
      },
      {
        id: "guardian",
        illustration: "guardian",
        title: "Dein Face ID ist der Wachter",
        body: "Jedes Konto ist durch starke biometrische Sicherheit geschutzt. Wir sehen deine Erinnerungen nie.",
        primaryButton: "Weiter",
      },
      {
        id: "ring-key",
        illustration: "ring-key",
        title: "Der Ring ist dein magischer Schlussel",
        body: "Eine Beruhrung fur sofortigen Zugriff. Ein heiliges Ritual fur deine wichtigsten Erinnerungen.",
        subtitle: "Nicht nur Hardware — sondern Teil der Zeremonie.",
        primaryButton: "Mehr uber Ringe",
        action: "open-ring-guide",
      },
      {
        id: "memory-place",
        illustration: "draft-vs-seal",
        title: "Jede Erinnerung hat ihren Platz",
        body: "Schnelle Gedanken gehen in Entwurfe.\nWichtige Momente verdienen es, mit dem Ring versiegelt zu werden.",
        primaryButton: "Weiter",
      },
      {
        id: "ownership",
        illustration: "ownership",
        title: "Deine Erinnerungen gehoren nur dir",
        body: "Ende-zu-Ende verschlusselt.\nDu kontrollierst alles — auch Widerruf oder Loschen jederzeit.",
        primaryButton: "Haven betreten",
      },
    ],
  },
  it: {
    title: "Benvenuto in Haven",
    stepLabelPrefix: "Passo ",
    stepLabelMiddle: " di ",
    subtitle: "Un inizio dolce per il tuo santuario dei ricordi.",
    layeredCoreLine:
      "Face ID protegge il tuo account. L’anello ti offre accesso rapido e un rito speciale per i ricordi più preziosi.",
    skip: "Salta per ora",
    next: "Avanti",
    back: "Indietro",
    start: "Inizia ora",
    openNfcGuide: "Scopri gli anelli",
    platformHintIos:
      "Su iPhone, apri Haven dall’icona Home per l’esperienza quotidiana più fluida.",
    platformHintAndroid:
      "Su Android puoi continuare nel browser e usare il tocco NFC dell’anello in modo più affidabile.",
    steps: [
      {
        id: "welcome",
        illustration: "welcome",
        title: "Benvenuto in Haven",
        body: "Il tuo santuario privato per i ricordi piu preziosi della vita.",
        subtitle: "Sicuro. Bellissimo. Tuo.",
        primaryButton: "Inizia il viaggio",
      },
      {
        id: "guardian",
        illustration: "guardian",
        title: "Il tuo Face ID e il Custode",
        body: "Ogni account e protetto dalla sicurezza biometrica piu forte. Non vediamo mai i tuoi ricordi.",
        primaryButton: "Continua",
      },
      {
        id: "ring-key",
        illustration: "ring-key",
        title: "L'Anello e la tua Chiave magica",
        body: "Un tocco per accesso istantaneo. Un rituale sacro per i tuoi ricordi piu importanti.",
        subtitle: "Non e solo hardware — e parte della cerimonia.",
        primaryButton: "Scopri gli anelli",
        action: "open-ring-guide",
      },
      {
        id: "memory-place",
        illustration: "draft-vs-seal",
        title: "Ogni ricordo ha il suo posto",
        body: "I pensieri rapidi vanno nelle bozze.\nI momenti profondi meritano di essere sigillati con l'anello.",
        primaryButton: "Continua",
      },
      {
        id: "ownership",
        illustration: "ownership",
        title: "I tuoi ricordi appartengono solo a te",
        body: "Cifratura end-to-end.\nHai il pieno controllo — inclusa la revoca o l'eliminazione in qualsiasi momento.",
        primaryButton: "Entra in Haven",
      },
    ],
  },
};
