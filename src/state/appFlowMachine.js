const MAIN_STATES = {
  BOOTSTRAP: "BOOTSTRAP",
  AUTH_GATE: "AUTH_GATE",
  RING_SETUP_GATE: "RING_SETUP_GATE",
  SYNC_GATE: "SYNC_GATE",
  PWA_INSTALL_GATE: "PWA_INSTALL_GATE",
  READY: "READY",
  RECOVERY: "RECOVERY",
};

function resolveMainState(ctx) {
  if (!ctx.bootstrapped) return MAIN_STATES.BOOTSTRAP;
  if (ctx.recoveryErrorType) return MAIN_STATES.RECOVERY;
  if (!ctx.hasSession) return MAIN_STATES.AUTH_GATE;
  if (ctx.syncing) return MAIN_STATES.SYNC_GATE;
  if (ctx.platform === "ios" && !ctx.ftuxPwaDone && !ctx.pwaInstalled && !ctx.pwaDeferred) {
    return MAIN_STATES.PWA_INSTALL_GATE;
  }
  return MAIN_STATES.READY;
}

export const APP_FLOW_MAIN_STATES = MAIN_STATES;

export const initialAppFlowState = {
  bootstrapped: false,
  hasSession: false,
  hasBoundRing: false,
  platform: "other",
  webNfcAvailable: false,
  syncing: false,
  pwaInstalled: false,
  pwaDeferred: false,
  recoveryErrorType: "",
  ftuxLandingSignedIn: false,
  ftuxPwaDone: false,
  ftuxWelcomeDone: false,
  ftuxFirstMemoryDone: false,
  mainState: MAIN_STATES.BOOTSTRAP,
};

export function appFlowReducer(state, event) {
  const type = String(event?.type || "");
  if (!type) return state;
  if (type === "BOOTSTRAP_DONE") {
    const next = {
      ...state,
      bootstrapped: true,
      hasSession: Boolean(event.hasSession),
      hasBoundRing: Boolean(event.hasBoundRing),
      platform: event.platform || "other",
      webNfcAvailable: Boolean(event.webNfcAvailable),
      pwaInstalled: Boolean(event.pwaInstalled),
      mainState: MAIN_STATES.BOOTSTRAP,
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "SESSION_CHANGED") {
    const next = {
      ...state,
      hasSession: Boolean(event.hasSession),
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "RINGS_CHANGED") {
    const next = {
      ...state,
      hasBoundRing: Boolean(event.hasBoundRing),
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "SYNC_STATUS") {
    const next = {
      ...state,
      syncing: Boolean(event.syncing),
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "SYNC_HARD_FAILED") {
    const next = {
      ...state,
      recoveryErrorType: event.errorType || "network",
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "BIND_FAILED") {
    const next = {
      ...state,
      recoveryErrorType: "bind_failed",
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "SYNC_RECOVERED") {
    const next = {
      ...state,
      recoveryErrorType: "",
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "PWA_DEFERRED") {
    const next = {
      ...state,
      pwaDeferred: true,
      ftuxPwaDone: true,
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "PWA_INSTALLED") {
    const next = {
      ...state,
      pwaInstalled: true,
      pwaDeferred: false,
      ftuxPwaDone: true,
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "WEB_NFC_UPDATED") {
    const next = {
      ...state,
      webNfcAvailable: Boolean(event.webNfcAvailable),
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "RECOVERY_DISMISSED") {
    const next = {
      ...state,
      recoveryErrorType: "",
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  if (type === "FTUX_SYNC") {
    const next = {
      ...state,
      ftuxLandingSignedIn: Boolean(event.ftuxLandingSignedIn),
      ftuxPwaDone: Boolean(event.ftuxPwaDone),
      ftuxWelcomeDone: Boolean(event.ftuxWelcomeDone),
      ftuxFirstMemoryDone: Boolean(event.ftuxFirstMemoryDone),
    };
    return { ...next, mainState: resolveMainState(next) };
  }
  return state;
}

