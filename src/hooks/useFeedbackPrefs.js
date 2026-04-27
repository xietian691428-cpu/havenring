import { useMemo, useState } from "react";

const PREF_KEY = "haven.feedback.preferences.v1";

function readPrefs() {
  if (typeof window === "undefined") {
    return { soundEnabled: true, hapticEnabled: true, soundScope: "save_only" };
  }
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return { soundEnabled: true, hapticEnabled: true, soundScope: "save_only" };
    const parsed = JSON.parse(raw);
    return {
      soundEnabled: parsed?.soundEnabled !== false,
      hapticEnabled: parsed?.hapticEnabled !== false,
      soundScope:
        parsed?.soundScope === "all_success" ? "all_success" : "save_only",
    };
  } catch {
    return { soundEnabled: true, hapticEnabled: true, soundScope: "save_only" };
  }
}

function writePrefs(prefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // Silent fallback to avoid breaking the user flow.
  }
}

export function useFeedbackPrefs() {
  const initial = useMemo(() => readPrefs(), []);
  const [soundEnabled, setSoundEnabled] = useState(initial.soundEnabled);
  const [hapticEnabled, setHapticEnabled] = useState(initial.hapticEnabled);
  const [soundScope, setSoundScope] = useState(initial.soundScope);

  function updateFeedbackPrefs(next) {
    const merged = {
      soundEnabled:
        typeof next.soundEnabled === "boolean" ? next.soundEnabled : soundEnabled,
      hapticEnabled:
        typeof next.hapticEnabled === "boolean" ? next.hapticEnabled : hapticEnabled,
      soundScope:
        next.soundScope === "all_success" || next.soundScope === "save_only"
          ? next.soundScope
          : soundScope,
    };
    setSoundEnabled(merged.soundEnabled);
    setHapticEnabled(merged.hapticEnabled);
    setSoundScope(merged.soundScope);
    writePrefs(merged);
    return merged;
  }

  return {
    soundEnabled,
    hapticEnabled,
    soundScope,
    updateFeedbackPrefs,
  };
}
