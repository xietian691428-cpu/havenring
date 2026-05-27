/** User chose "Skip for now" on /setup — suppress iOS PWA install gate in the app shell. */
export const PWA_INSTALL_DEFERRED_KEY = "haven.pwa.install.deferred.v1";

export function readPwaInstallDeferred(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PWA_INSTALL_DEFERRED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePwaInstallDeferred(deferred: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (deferred) {
      window.localStorage.setItem(PWA_INSTALL_DEFERRED_KEY, "1");
    } else {
      window.localStorage.removeItem(PWA_INSTALL_DEFERRED_KEY);
    }
  } catch {
    /* ignore */
  }
}
