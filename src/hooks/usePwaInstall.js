import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = {
  offlineUnavailable: "Offline mode is not available in this browser.",
  offlinePreparing: "Offline support is still preparing. Please try again shortly.",
  installPromptAvailable: "Install Haven Ring for quick access and offline support.",
  installedWelcome: "Installed. Welcome to Haven Ring.",
  installSuccess: "Haven Ring installed successfully.",
  installCanceled: "Installation canceled. You can install later anytime.",
  installPreparingTimeout:
    "Install setup is preparing. If it takes too long, you can add to Home Screen later from Settings.",
  installReadyAfterDelay:
    "Install setup is now ready. You can continue installing from this page.",
};

export function usePwaInstall(messages = {}) {
  const m = { ...DEFAULT_MESSAGES, ...messages };
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installStatus, setInstallStatus] = useState("");
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setInstallStatus(m.offlineUnavailable);
      return;
    }

    let cancelled = false;
    let timedOut = false;
    const readyTimeout = window.setTimeout(() => {
      timedOut = true;
      if (!cancelled) {
        setInstallStatus(m.installPreparingTimeout);
      }
    }, 9000);
    navigator.serviceWorker
      .ready
      .then(() => {
        if (cancelled) return;
        window.clearTimeout(readyTimeout);
        setSwReady(true);
        if (timedOut) {
          setInstallStatus(m.installReadyAfterDelay);
        }
      })
      .catch(() => {
        if (!cancelled) {
          window.clearTimeout(readyTimeout);
          setInstallStatus(m.offlinePreparing);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
    };
  }, [m.installPreparingTimeout, m.installReadyAfterDelay, m.offlinePreparing, m.offlineUnavailable]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setInstallStatus(m.installPromptAvailable);
    };

    const onInstalled = () => {
      setInstallStatus(m.installedWelcome);
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [m.installPromptAvailable, m.installedWelcome]);

  async function install() {
    if (!installPromptEvent) return false;
    await installPromptEvent.prompt();
    const result = await installPromptEvent.userChoice;
    if (result.outcome === "accepted") {
      setInstallStatus(m.installSuccess);
      setInstallPromptEvent(null);
      return true;
    }
    setInstallStatus(m.installCanceled);
    return false;
  }

  return {
    canInstall: Boolean(installPromptEvent),
    installStatus,
    swReady,
    install,
  };
}
