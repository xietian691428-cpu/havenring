export const SEAL_WAIT_QUERY = "seal_wait";

export function isSealWaitSearch(search: string = ""): boolean {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return sp.get(SEAL_WAIT_QUERY) === "1";
}

/** After arming seal prep on /app, continue on /start so Android NFC opens the right page. */
export function navigateToSealWaitPage(): void {
  if (typeof window === "undefined") return;
  const url = new URL("/start", window.location.origin);
  url.searchParams.set(SEAL_WAIT_QUERY, "1");
  url.searchParams.set("intent", "seal");
  window.location.assign(url.href);
}
