import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type PrivacyPolicyContent = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: Array<{
    heading: string;
    body?: string;
    bullets?: string[];
  }>;
  closing: string;
  returnLabel: string;
};

export const PRIVACY_POLICY_CONTENT: Record<Locale, PrivacyPolicyContent> = {
  en: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: May 6, 2026",
    intro:
      "At Haven, we believe your memories are deeply personal. We are committed to protecting your privacy through transparency, security, and respect.",
    sections: [
      {
        heading: "What We Collect",
        bullets: [
          "Account information when you sign in with Apple or Google",
          "The memories you choose to create (text, photos, videos, audio)",
          "Basic technical information (such as device type and app interactions) to keep Haven running smoothly",
        ],
      },
      {
        heading: "How We Use Your Information",
        bullets: [
          "To provide, protect, and improve your personal Memory Sanctuary",
          "To enable secure syncing across your devices",
        ],
      },
      {
        heading: "End-to-End Encryption",
        body: "Your sealed memories are encrypted on your device before they leave it. We cannot access, read, or view the content of your memories.",
      },
      {
        heading: "Data Storage",
        body: "Your memories remain stored until you decide to delete them or delete your account.",
      },
      {
        heading: "Your Control",
        body: "You can:",
        bullets: [
          "Access and download your data at any time",
          "Revoke ring access instantly",
          "Delete individual memories or your entire account",
        ],
      },
      {
        heading: "Third Parties",
        body: "We do not sell your personal data.",
        bullets: [
          "We only share the minimum necessary information with service providers who help us operate the app (such as cloud storage and authentication), and they are contractually bound to protect your information.",
        ],
      },
      {
        heading: "Contact Us",
        body: "For any privacy questions, please reach out to privacy@havenring.me",
      },
    ],
    closing: "By using Haven, you agree to this Privacy Policy.",
    returnLabel: "Return",
  },
  fr: {
    title: "Politique de confidentialite",
    lastUpdated: "Derniere mise a jour : 6 mai 2026",
    intro:
      "Chez Haven, nous croyons que vos souvenirs sont intimement personnels. Nous protegeons votre vie privee avec transparence, securite et respect.",
    sections: [
      {
        heading: "Ce que nous collectons",
        bullets: [
          "Les informations de compte lors de la connexion avec Apple ou Google",
          "Les souvenirs que vous choisissez de creer (texte, photos, videos, audio)",
          "Des informations techniques de base (type d'appareil et interactions) pour assurer le bon fonctionnement de Haven",
        ],
      },
      {
        heading: "Comment nous utilisons vos informations",
        bullets: [
          "Pour fournir, proteger et ameliorer votre sanctuaire de memoires personnel",
          "Pour activer une synchronisation securisee entre vos appareils",
        ],
      },
      {
        heading: "Chiffrement de bout en bout",
        body: "Vos souvenirs scelles sont chiffres sur votre appareil avant de le quitter. Nous ne pouvons ni acceder, ni lire, ni voir le contenu de vos souvenirs.",
      },
      {
        heading: "Stockage des donnees",
        body: "Vos souvenirs restent stockes jusqu'a ce que vous choisissiez de les supprimer ou de supprimer votre compte.",
      },
      {
        heading: "Votre controle",
        body: "Vous pouvez :",
        bullets: [
          "Acceder a vos donnees et les telecharger a tout moment",
          "Revoquer immediatement l'acces d'une bague",
          "Supprimer des souvenirs individuels ou l'ensemble de votre compte",
        ],
      },
      {
        heading: "Partenaires tiers",
        body: "Nous ne vendons pas vos donnees personnelles.",
        bullets: [
          "Nous partageons uniquement les informations strictement necessaires avec les prestataires qui nous aident a faire fonctionner l'application (comme le stockage cloud et l'authentification), et ils sont contractuellement tenus de proteger vos informations.",
        ],
      },
      {
        heading: "Nous contacter",
        body: "Pour toute question sur la confidentialite, contactez privacy@havenring.me",
      },
    ],
    closing: "En utilisant Haven, vous acceptez cette politique de confidentialite.",
    returnLabel: "Retour",
  },
  es: {
    title: "Politica de privacidad",
    lastUpdated: "Ultima actualizacion: 6 de mayo de 2026",
    intro:
      "En Haven, creemos que tus recuerdos son profundamente personales. Protegemos tu privacidad con transparencia, seguridad y respeto.",
    sections: [
      {
        heading: "Que recopilamos",
        bullets: [
          "Informacion de cuenta cuando inicias sesion con Apple o Google",
          "Los recuerdos que decides crear (texto, fotos, videos, audio)",
          "Informacion tecnica basica (tipo de dispositivo e interacciones) para que Haven funcione correctamente",
        ],
      },
      {
        heading: "Como usamos tu informacion",
        bullets: [
          "Para ofrecer, proteger y mejorar tu santuario personal de recuerdos",
          "Para habilitar sincronizacion segura entre tus dispositivos",
        ],
      },
      {
        heading: "Cifrado de extremo a extremo",
        body: "Tus recuerdos sellados se cifran en tu dispositivo antes de salir de el. No podemos acceder, leer ni ver el contenido de tus recuerdos.",
      },
      {
        heading: "Almacenamiento de datos",
        body: "Tus recuerdos permanecen almacenados hasta que decidas eliminarlos o eliminar tu cuenta.",
      },
      {
        heading: "Tu control",
        body: "Tu puedes:",
        bullets: [
          "Acceder y descargar tus datos en cualquier momento",
          "Revocar al instante el acceso del anillo",
          "Eliminar recuerdos individuales o toda tu cuenta",
        ],
      },
      {
        heading: "Terceros",
        body: "No vendemos tus datos personales.",
        bullets: [
          "Solo compartimos la informacion minima necesaria con proveedores que nos ayudan a operar la app (como almacenamiento en la nube y autenticacion), y estan obligados por contrato a proteger tu informacion.",
        ],
      },
      {
        heading: "Contactanos",
        body: "Para cualquier consulta de privacidad, escribe a privacy@havenring.me",
      },
    ],
    closing: "Al usar Haven, aceptas esta Politica de privacidad.",
    returnLabel: "Volver",
  },
  de: {
    title: "Datenschutzrichtlinie",
    lastUpdated: "Zuletzt aktualisiert: 6. Mai 2026",
    intro:
      "Bei Haven sind Erinnerungen etwas sehr Personliches. Wir schutzen deine Privatsphare mit Transparenz, Sicherheit und Respekt.",
    sections: [
      {
        heading: "Welche Daten wir erfassen",
        bullets: [
          "Kontoinformationen bei der Anmeldung mit Apple oder Google",
          "Erinnerungen, die du erstellst (Text, Fotos, Videos, Audio)",
          "Grundlegende technische Informationen (Geratetyp und Interaktionen), damit Haven zuverlassig funktioniert",
        ],
      },
      {
        heading: "Wie wir deine Informationen nutzen",
        bullets: [
          "Um dein personliches Memory Sanctuary bereitzustellen, zu schutzen und zu verbessern",
          "Um eine sichere Synchronisierung zwischen deinen Geraten zu ermoglichen",
        ],
      },
      {
        heading: "Ende-zu-Ende-Verschlusselung",
        body: "Deine versiegelten Erinnerungen werden auf deinem Gerat verschlusselt, bevor sie es verlassen. Wir konnen den Inhalt deiner Erinnerungen nicht aufrufen, lesen oder ansehen.",
      },
      {
        heading: "Datenspeicherung",
        body: "Deine Erinnerungen bleiben gespeichert, bis du sie oder dein Konto loschst.",
      },
      {
        heading: "Deine Kontrolle",
        body: "Du kannst:",
        bullets: [
          "Deine Daten jederzeit aufrufen und herunterladen",
          "Ringzugriff sofort widerrufen",
          "Einzelne Erinnerungen oder dein gesamtes Konto loschen",
        ],
      },
      {
        heading: "Drittanbieter",
        body: "Wir verkaufen keine personenbezogenen Daten.",
        bullets: [
          "Wir teilen nur die minimal notwendigen Informationen mit Dienstleistern, die uns beim Betrieb der App unterstutzen (z. B. Cloud-Speicher und Authentifizierung). Diese sind vertraglich zum Schutz deiner Informationen verpflichtet.",
        ],
      },
      {
        heading: "Kontakt",
        body: "Bei Fragen zum Datenschutz kontaktiere uns unter privacy@havenring.me",
      },
    ],
    closing: "Durch die Nutzung von Haven stimmst du dieser Datenschutzrichtlinie zu.",
    returnLabel: "Zuruck",
  },
  it: {
    title: "Informativa sulla privacy",
    lastUpdated: "Ultimo aggiornamento: 6 maggio 2026",
    intro:
      "In Haven crediamo che i tuoi ricordi siano profondamente personali. Proteggiamo la tua privacy con trasparenza, sicurezza e rispetto.",
    sections: [
      {
        heading: "Cosa raccogliamo",
        bullets: [
          "Informazioni dell'account quando accedi con Apple o Google",
          "I ricordi che scegli di creare (testo, foto, video, audio)",
          "Informazioni tecniche di base (tipo di dispositivo e interazioni) per mantenere Haven fluido e affidabile",
        ],
      },
      {
        heading: "Come utilizziamo le tue informazioni",
        bullets: [
          "Per fornire, proteggere e migliorare il tuo Memory Sanctuary personale",
          "Per abilitare la sincronizzazione sicura tra i tuoi dispositivi",
        ],
      },
      {
        heading: "Crittografia end-to-end",
        body: "I tuoi ricordi sigillati vengono crittografati sul tuo dispositivo prima di lasciarlo. Non possiamo accedere, leggere o visualizzare il contenuto dei tuoi ricordi.",
      },
      {
        heading: "Conservazione dei dati",
        body: "I tuoi ricordi restano archiviati finche non decidi di eliminarli o di eliminare il tuo account.",
      },
      {
        heading: "Il tuo controllo",
        body: "Puoi:",
        bullets: [
          "Accedere e scaricare i tuoi dati in qualsiasi momento",
          "Revocare subito l'accesso dell'anello",
          "Eliminare singoli ricordi o l'intero account",
        ],
      },
      {
        heading: "Terze parti",
        body: "Non vendiamo i tuoi dati personali.",
        bullets: [
          "Condividiamo solo le informazioni minime necessarie con i fornitori di servizi che ci aiutano a gestire l'app (come archiviazione cloud e autenticazione), vincolati da accordi contrattuali alla protezione delle tue informazioni.",
        ],
      },
      {
        heading: "Contattaci",
        body: "Per domande sulla privacy, scrivi a privacy@havenring.me",
      },
    ],
    closing: "Usando Haven, accetti questa Informativa sulla privacy.",
    returnLabel: "Indietro",
  },
};

export function getPrivacyPolicyContent(locale: string | null | undefined) {
  const key = String(locale || "").toLowerCase().split("-")[0] as Locale;
  return PRIVACY_POLICY_CONTENT[key] || PRIVACY_POLICY_CONTENT[DEFAULT_LOCALE];
}
