export const FIRST_MEMORY_DONE_KEY = "haven.first_memory.completed.v1";

/** Set when the first-run carousel is dismissed (any path). */
export const ONBOARDING_DONE_KEY = "haven.onboarding.completed.v1";

/** `bind_ring` | `face_only` | `skipped` | `completed` — used for post-FTUX routing. */
export const ONBOARDING_OUTCOME_KEY = "haven.onboarding.outcome.v1";

/** User dismissed the gentle “try sealing” strip on Timeline. */
export const TIMELINE_TRY_SEAL_HINT_DISMISSED_KEY = "haven.timeline.trySealHintDismissed.v1";

function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = String(navigator.userAgent || "").toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(ua) ||
    (ua.includes("macintosh") && typeof window !== "undefined" && "ontouchend" in window);
  if (isIos) return "ios";
  if (ua.includes("android")) return "android";
  return "other";
}

export function markFirstMemoryCompleted() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FIRST_MEMORY_DONE_KEY, "1");
}

export function isFirstMemoryCompleted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FIRST_MEMORY_DONE_KEY) === "1";
}

export async function trackFirstRunEvent(eventName, options = {}) {
  if (!eventName || typeof window === "undefined") return;
  const payload = {
    event_name: String(eventName),
    platform: options.platform || detectPlatform(),
    locale: options.locale || "en",
    metadata:
      options.metadata && typeof options.metadata === "object" ? options.metadata : {},
  };
  try {
    await fetch("/api/telemetry/first-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Telemetry should never block user flow.
  }
}
