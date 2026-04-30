const EN = {
  brand: "Haven",
  title: "My rings",
  subtitle:
    "Quick access keys to your memory space. Any bound ring works equally for quick login and recommended sealing.",
  layeredCoreLine:
    "Your Face ID protects your account. Your ring gives you fast access and a special ritual for your most precious memories.",
  emptyTitle: "No rings registered yet",
  emptyBody:
    "Add your NFC rings and give them names. We recommend at least two: one for daily use and one backup in case of loss.",
  addRing: "Add a ring",
  maxRings: "Up to five rings per device registry.",
  limitReachedHint:
    "Ring limit reached (5). Revoke one ring before adding another.",
  ringSince: "Added on",
  boundAt: "Bound at",
  lastUsedAt: "Last used",
  linkedMemories: "Linked memories",
  neverUsed: "Never used yet",
  revoke: "Revoke ring",
  revoking: "Revoking…",
  syncLoading: "Loading cloud ring bindings…",
  syncFailed: "Could not load cloud ring data. Check sign-in/network and retry.",
  retrySync: "Retry",
  verifyTitle: "Secondary verification required",
  verifyHint:
    "Before unbinding, confirm with device password or recovery code.",
  verifyPassword: "Device password",
  verifyRecovery: "Recovery code",
  verifyConfirm: "Verify and revoke",
  verifyCancel: "Cancel",
  verifyError: "Verification failed. Check password/code and retry.",
  revokeWarning:
    "After unbinding, this ring will immediately stop working for login and sealing. All sealed content remains permanently and safely stored in the cloud.",
  revokeDone: "Ring revoked successfully.",
  revokeFailed: "Could not revoke this ring.",
  cloudSignInRequired: "Sign in first to manage cloud-linked rings.",
  cloudSignInAction: "Open Settings to sign in",
  unknownDate: "—",
  openSetup: "Register another ring",
  settingsLink: "Privacy & backup",
  privacyNote:
    "Every ring is equal: any one can be used for quick login and recommended sealing. Your account stays the owner of all memories.",
  iosUsageHint:
    "Touch your ring to quickly access your sanctuary. Advanced option: ring link rewrite is available on Android devices.",
  androidUsageHint: "You can also rewrite the ring link here when needed.",
  rewriteLinkAction: "Rewrite ring link",
  quickGuideTitle: "How Haven Works",
  quickGuideIntro: "欢迎来到你的私人记忆圣殿。这里的一切都设计得简单且安全。",
  quickGuideOneLine:
    "一句话总结：“戒指为你提供速度与仪式感，Face ID 保护你的账号安全。”",
  quickGuidePoints: [
    "日常打开应用：戒指强烈推荐但不强制，也可用 Face ID / Passkey。",
    "快速记录想法：不需要戒指，登录后可直接记录到草稿箱。",
    "重要记忆封印：推荐 Seal with Ring，备选 Save Securely with Face ID。",
    "高风险操作（解绑、导出、删除）：必须二次验证。",
  ],
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
    openSetup: "Enregistrer une autre bague",
    settingsLink: "Confidentialite et sauvegarde",
  },
  es: {
    ...EN,
    title: "Mis anillos",
    subtitle: "Accesos rapidos. Cada anillo vale igual.",
    emptyTitle: "Sin anillos registrados",
    addRing: "Anadir anillo",
    openSetup: "Registrar otro anillo",
    settingsLink: "Privacidad y copia",
  },
  de: {
    ...EN,
    title: "Meine Ringe",
    subtitle: "Schnellzugriff. Jeder Ring ist gleich.",
    emptyTitle: "Noch keine Ringe",
    addRing: "Ring hinzufugen",
    openSetup: "Weiteren Ring registrieren",
    settingsLink: "Datenschutz & Backup",
  },
  it: {
    ...EN,
    title: "I miei anelli",
    subtitle: "Accesso rapido. Ogni anello e uguale.",
    emptyTitle: "Nessun anello registrato",
    addRing: "Aggiungi anello",
    openSetup: "Registra un altro anello",
    settingsLink: "Privacy e backup",
  },
};
