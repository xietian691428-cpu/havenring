import { useEffect, useState } from "react";

export function usePwaInstall() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installStatus, setInstallStatus] = useState("");
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setInstallStatus("Offline mode is not available in this browser.");
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .register("/haven-pwa/service-worker.js", { scope: "/haven-pwa/" })
      .then(() => {
        if (!cancelled) setSwReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setInstallStatus("Offline mode unavailable right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setInstallStatus("Install Haven Ring for quick access and offline support.");
    };

    const onInstalled = () => {
      setInstallStatus("Installed. Welcome to Haven Ring.");
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPromptEvent) return false;
    await installPromptEvent.prompt();
    const result = await installPromptEvent.userChoice;
    if (result.outcome === "accepted") {
      setInstallStatus("Haven Ring installed successfully.");
      setInstallPromptEvent(null);
      return true;
    }
    setInstallStatus("Installation canceled. You can install later anytime.");
    return false;
  }

  return {
    canInstall: Boolean(installPromptEvent),
    installStatus,
    swReady,
    install,
  };
}
