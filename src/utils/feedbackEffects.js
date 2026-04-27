export function triggerSuccessFeedback({
  soundEnabled,
  hapticEnabled,
  allowSound = true,
}) {
  if (hapticEnabled && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(18);
  }
  if (soundEnabled && allowSound) {
    void playSoftSuccessTone();
  }
}

async function playSoftSuccessTone() {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  try {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    gain.connect(ctx.destination);

    const oscA = ctx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.setValueAtTime(660, now);
    oscA.connect(gain);
    oscA.start(now);
    oscA.stop(now + 0.12);

    const oscB = ctx.createOscillator();
    oscB.type = "sine";
    oscB.frequency.setValueAtTime(880, now + 0.08);
    oscB.connect(gain);
    oscB.start(now + 0.08);
    oscB.stop(now + 0.24);
  } catch {
    // Graceful fallback.
  } finally {
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 300);
  }
}
