import { APP_FLOW_MAIN_STATES } from "./appFlowMachine";

export function getRecoveryActionIntent(errorType = "") {
  const kind = String(errorType || "");
  if (kind === "auth_expired") return "reauth";
  if (kind === "bind_failed") return "open_ring_setup";
  if (kind === "hash_mismatch") return "rebuild_and_sync";
  return "retry_sync";
}

export function getFlowPrimaryUi(flowState, locale = "en") {
  const isZh = String(locale).toLowerCase().startsWith("zh");
  if (flowState.mainState === APP_FLOW_MAIN_STATES.AUTH_GATE) {
    return {
      title: isZh ? "需要登录" : "Sign-in required",
      body: isZh
        ? "请先完成账号登录，再继续使用你的记忆圣殿。"
        : "Complete account sign-in to continue into your memory sanctuary. Touch detection alone is not final proof on new or high-risk devices.",
      actionLabel: isZh ? "继续登录" : "Continue sign-in",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.RING_SETUP_GATE) {
    const isIos = flowState.platform === "ios";
    const noWebNfcOnIos = isIos && !flowState.webNfcAvailable;
    return {
      title: isZh ? "需要绑定戒指" : "Ring binding required",
      body: isZh
        ? noWebNfcOnIos
          ? "当前设备暂不支持浏览器 NFC。请优先添加到主屏幕，并使用 Ring Link 或手动绑定完成首枚戒指。"
          : isIos
            ? "当前已登录但还没有可用戒指。iOS 下可优先使用 Ring Link URL 或手动绑定流程完成首枚绑定。"
          : "当前已登录，但还没有可用戒指。请先绑定至少 1 枚戒指。"
        : noWebNfcOnIos
          ? "This device cannot use Web NFC in browser. Add to Home Screen first, then use Ring Link URL or manual bind fallback."
          : isIos
            ? "Session is valid but no ring is bound yet. On iOS, use Ring Link URL or manual bind fallback for first ring."
          : "Session is valid but no ring is bound yet. Ring setup is strongly recommended for fast access, but your account remains the core owner.",
      actionLabel: isZh ? "去绑定戒指" : "Bind a ring",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.SYNC_GATE) {
    return {
      title: isZh ? "正在同步" : "Syncing data",
      body: isZh
        ? "请稍候，正在完成账号与戒指数据同步。"
        : "Please wait while account and ring data sync completes.",
      actionLabel: isZh ? "立即重试同步" : "Retry sync",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.PWA_INSTALL_GATE) {
    const noWebNfcOnIos = flowState.platform === "ios" && !flowState.webNfcAvailable;
    return {
      title: isZh ? "建议添加到主屏幕" : "Add to Home Screen recommended",
      body: isZh
        ? noWebNfcOnIos
          ? "当前浏览器 NFC 不可用。请先添加到主屏幕，后续从主屏幕入口进入会更稳定。"
          : "iOS 建议从主屏幕入口进入，体验更稳定、更接近原生 App。"
        : noWebNfcOnIos
          ? "Web NFC is unavailable in this browser. Add to Home Screen first for a more reliable daily entry."
          : "On iOS, open Haven from your Home Screen icon for a smoother daily experience. Ring ritual remains optional.",
      actionLabel: isZh ? "查看安装指引" : "Open install guide",
      secondaryActionLabel: isZh ? "稍后再说" : "Skip for now",
      secondaryActionIntent: "defer_pwa",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.RECOVERY) {
    const errorType = String(flowState.recoveryErrorType || "");
    const isAuthExpired = errorType === "auth_expired";
    const isHashMismatch = errorType === "hash_mismatch";
    const isBindFailed = errorType === "bind_failed";
    const body = isZh
      ? isAuthExpired
        ? "登录已过期，请先重新认证。"
        : isHashMismatch
          ? "检测到内容完整性异常，请先重建和同步。"
          : isBindFailed
            ? "戒指绑定失败，请重新完成绑定和二次验证。"
            : "网络或同步异常，请执行恢复动作后重试。"
      : isAuthExpired
        ? "Session expired. Re-authenticate before continuing."
        : isHashMismatch
          ? "Integrity mismatch detected. Rebuild and resync first."
          : isBindFailed
            ? "Ring binding failed. Retry binding with secondary verification."
            : "Network or sync issue detected. Run recovery and retry.";
    const actionIntent = getRecoveryActionIntent(errorType);
    const actionLabel = isZh
      ? actionIntent === "reauth"
        ? "重新登录"
        : actionIntent === "open_ring_setup"
          ? "重新绑定戒指"
          : actionIntent === "rebuild_and_sync"
            ? "重建本地缓存"
            : "执行恢复"
      : actionIntent === "reauth"
        ? "Re-authenticate"
        : actionIntent === "open_ring_setup"
          ? "Retry ring binding"
          : actionIntent === "rebuild_and_sync"
            ? "Rebuild local cache"
            : "Recover now";
    return {
      title: isZh ? "需要恢复" : "Recovery required",
      body,
      actionLabel,
      enforceSingle: true,
    };
  }
  return null;
}

