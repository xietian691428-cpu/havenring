import { isIosWebKit } from "@/lib/composer-platform-limits";

const RELOAD_WINDOW_KEY = "haven.ios.reload_window.v1";
const RELOAD_WINDOW_MS = 5 * 60 * 1000;
const RELOAD_MINIMAL_THRESHOLD = 2;

type ReloadWindow = {
  count: number;
  firstAt: number;
};

function readReloadWindow(): ReloadWindow | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RELOAD_WINDOW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReloadWindow;
    if (typeof parsed.count !== "number" || typeof parsed.firstAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeReloadWindow(window: ReloadWindow): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(RELOAD_WINDOW_KEY, JSON.stringify(window));
  } catch {
    /* quota */
  }
}

/** Call once on /app boot — counts rapid Safari reloads in a 5-minute window. */
export function recordIosPageReload(): void {
  if (!isIosWebKit()) return;
  const now = Date.now();
  const prev = readReloadWindow();
  if (!prev || now - prev.firstAt > RELOAD_WINDOW_MS) {
    writeReloadWindow({ count: 1, firstAt: now });
    return;
  }
  writeReloadWindow({ count: prev.count + 1, firstAt: prev.firstAt });
}

/** Force text-only timeline for this session after repeated reloads. */
export function isIosReloadMinimalMode(): boolean {
  if (!isIosWebKit()) return false;
  const window = readReloadWindow();
  if (!window) return false;
  if (Date.now() - window.firstAt > RELOAD_WINDOW_MS) return false;
  return window.count >= RELOAD_MINIMAL_THRESHOLD;
}
