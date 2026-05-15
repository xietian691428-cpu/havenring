import type { Session } from "@supabase/supabase-js";
import { urlLooksLikeSupabaseAuthReturn } from "./supabaseAuthUrlSignal";

/** Where `/app` stores a return path when the shell requires sign-in first. */
export const DEFERRED_APP_ENTRY_KEY = "haven.deferredAppEntry.v1";

const DEFERRED_ENTRY_MAX_AGE_MS = 60 * 60 * 1000;

type DeferredPayload = { path: string; savedAt: number };

/** Legacy FTUX flag — kept so `/start` OAuth can still clear it; gate no longer depends on it. */
export const FTUX_STARTED_KEY = "haven.ftux.started.v1";

export function isPermanentSupabaseSession(session: Session | null): session is Session {
  if (!session) return false;
  return (
    session.user.is_anonymous !== true &&
    session.user.app_metadata?.provider !== "anonymous"
  );
}

/** True when the current URL may still be processed by Supabase `detectSessionInUrl` / PKCE exchange. */
export function appUrlLooksLikeSupabaseAuthCallback(): boolean {
  return urlLooksLikeSupabaseAuthReturn();
}

const DEEPLINK_QUERY_KEYS = ["ring", "token", "reason", "memoryId", "memory", "m", "claim", "lang"] as const;

/**
 * Remember `/app?…` ring / memory / claim deep links before redirecting to `/start`,
 * so Hub → `/app?ring=signin&token=…` is not lost when the user must sign in first.
 */
export function captureAppDeepLinkForPostLogin(): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    if (u.pathname !== "/app") return;
    const sp = u.searchParams;
    const meaningful = DEEPLINK_QUERY_KEYS.some((k) => sp.has(k));
    if (!meaningful) return;
    sp.delete("code");
    const path = `${u.pathname}?${sp.toString()}`.replace(/\?$/, "");
    const payload: DeferredPayload = { path, savedAt: Date.now() };
    sessionStorage.setItem(DEFERRED_APP_ENTRY_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function peekDeferredAppEntry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEFERRED_APP_ENTRY_KEY);
    if (!raw) return null;
    let path: string | null = null;
    try {
      const parsed = JSON.parse(raw) as DeferredPayload;
      if (parsed?.path && typeof parsed.savedAt === "number") {
        if (Date.now() - parsed.savedAt > DEFERRED_ENTRY_MAX_AGE_MS) {
          sessionStorage.removeItem(DEFERRED_APP_ENTRY_KEY);
          return null;
        }
        path = parsed.path;
      }
    } catch {
      if (raw.startsWith("/app")) path = raw;
    }
    if (!path || !path.startsWith("/app")) return null;
    return path;
  } catch {
    return null;
  }
}

export function consumeDeferredAppEntry(): string | null {
  const v = peekDeferredAppEntry();
  if (!v) return null;
  try {
    sessionStorage.removeItem(DEFERRED_APP_ENTRY_KEY);
  } catch {
    /* ignore */
  }
  return v;
}

const PATHS_SCRUB_OAUTH_ARTIFACTS = new Set(["/app", "/login"]);

/** Remove one-time OAuth params from the address bar after a successful session. */
export function scrubSupabaseAuthArtifactsFromEntryPages(): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    if (!PATHS_SCRUB_OAUTH_ARTIFACTS.has(u.pathname)) return;
    let changed = false;
    if (u.searchParams.has("code")) {
      u.searchParams.delete("code");
      changed = true;
    }
    if (u.searchParams.has("state")) {
      u.searchParams.delete("state");
      changed = true;
    }
    if (
      u.hash &&
      /access_token|refresh_token|provider_token|type=recovery|error=/i.test(u.hash)
    ) {
      u.hash = "";
      changed = true;
    }
    if (changed) {
      const next = `${u.pathname}${u.search}${u.hash}`;
      window.history.replaceState({}, "", next);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated Use scrubSupabaseAuthArtifactsFromEntryPages */
export const scrubSupabaseAuthArtifactsFromAppUrl = scrubSupabaseAuthArtifactsFromEntryPages;
