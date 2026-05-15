/**
 * Detects URLs that are *actually* Supabase Auth returns (PKCE / implicit / errors),
 * so the marketing site is not mistaken for an OAuth callback (e.g. unrelated `?code=`).
 */
export function urlLooksLikeSupabaseAuthReturn(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  if (hash.includes("access_token=") || hash.includes("refresh_token=")) {
    return true;
  }
  if (hash.includes("error=")) {
    if (
      hash.includes("error_description=") ||
      hash.includes("error_code=") ||
      hash.includes("error_uri=")
    ) {
      return true;
    }
  }
  const q = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
  const sp = new URLSearchParams(q);
  const code = (sp.get("code") || "").trim();
  if (!code) return false;
  if (code.length < 32) return false;
  if (sp.has("state")) return true;
  const t = (sp.get("type") || "").toLowerCase();
  if (["magiclink", "signup", "recovery", "email_change", "invite", "email"].includes(t)) {
    return true;
  }
  return code.length >= 64;
}
