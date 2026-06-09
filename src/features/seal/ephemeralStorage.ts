/**
 * Best-effort detection of browsers that wipe or partition storage per tab/session.
 */

let cachedEphemeral: boolean | null = null;

export function isEphemeralStorageEnvironment(): boolean {
  if (cachedEphemeral !== null) return cachedEphemeral;
  if (typeof window === "undefined") {
    cachedEphemeral = false;
    return false;
  }

  let ephemeral = false;
  try {
    const probe = `haven.ephemeral.probe.${Date.now()}`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
  } catch {
    ephemeral = true;
  }

  if (!ephemeral && typeof navigator !== "undefined" && navigator.storage?.estimate) {
    void navigator.storage.estimate().then((est) => {
      const quota = Number(est.quota || 0);
      if (quota > 0 && quota < 120 * 1024 * 1024) {
        cachedEphemeral = true;
      }
    });
  }

  if (
    !ephemeral &&
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    ephemeral = false;
  }

  cachedEphemeral = ephemeral;
  return ephemeral;
}

export function resetEphemeralStorageCache(): void {
  cachedEphemeral = null;
}
