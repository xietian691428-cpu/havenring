const EN = {
  brand: "Help Center",
  title: "Help & Support",
  subtitle:
    "You are not alone here. This page walks you through everything step by step, like a friend beside you.",
  layeredCoreLine:
    "Your Face ID protects your account. Your ring gives you fast access and a special ritual for your most precious memories.",
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
    "Ring management, sealed-memory deletion, and export or migration always require strong secondary verification.",
  troubleshootingBodyByPlatform: {
    ios: "iPhone-focused quick fixes are shown first.",
    android: "Android-focused quick fixes are shown first.",
    other: "General quick fixes are shown first.",
  },
  faqTitle: "Common Questions",
  contactTitle: "Contact Support",
  contactBody: "Still stuck? Reach out and we will help you personally.",
  supportEmail: "support@havenring.me",
  howHavenWorksTitle: "How Haven Works",
  howHavenWorksIntro:
    "欢迎来到你的私人记忆圣殿。这里的一切都设计得简单且安全。",
  howHavenWorksRows: [
    {
      operation: "日常打开应用",
      ringRequired: "不强制（强烈推荐）",
      recommended:
        "优先：触碰戒指一触即达；备选：Face ID / Touch ID / Passkey",
      note: "最常用的方式，推荐把 App 添加到主屏幕",
    },
    {
      operation: "快速记录想法（草稿箱）",
      ringRequired: "不需要",
      recommended: "登录后直接开始记录",
      note: "随时随地捕捉灵感，无需戒指",
    },
    {
      operation: "重要记忆封印（Seal）",
      ringRequired: "推荐使用",
      recommended:
        "主推荐：Seal with Ring（仪式路径）；备选：Save Securely（Face ID）",
      note: "为特别珍贵的回忆增加神圣仪式感",
    },
    {
      operation: "添加或解绑戒指",
      ringRequired: "必须",
      recommended: "Face ID / Touch ID 二次验证",
      note: "高安全操作，需要本人确认",
    },
    {
      operation: "数据导出或迁移",
      ringRequired: "必须",
      recommended: "Face ID / Touch ID 二次验证",
      note: "保护你的全部记忆",
    },
    {
      operation: "删除已封印的内容",
      ringRequired: "必须",
      recommended: "Face ID + 额外确认",
      note: "非常谨慎的操作，默认封印内容不可修改",
    },
    {
      operation: "丢失戒指处理",
      ringRequired: "不需要",
      recommended: "在任意已登录设备上远程解除（需 Face ID）",
      note: "戒指丢失不影响你的记忆安全",
    },
  ],
  howHavenWorksKeyPointsTitle: "快速了解 Haven 的 5 个关键点",
  howHavenWorksKeyPoints: [
    "1. 戒指的作用：魔法快捷钥匙 + 重要记忆的仪式工具",
    "2. 安全机制：日常使用戒指 + Face ID 双重保护，所有重要操作必须二次验证",
    "3. iPhone 用户提示：Seal with Ring 可能需要备选方式，建议添加应用到主屏幕",
    "4. 推荐做法：准备至少 2 枚戒指，重要回忆使用 Seal with Ring",
    "5. 你的记忆非常安全：封印内容默认永久保存且不可修改，受端到端加密保护",
  ],
  howHavenWorksOneLine:
    "一句话总结：“戒指为你提供速度与仪式感，Face ID 保护你的账号安全。”",
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
