const DEFAULT_RETURN = "/start";

/** Safe in-app path for post-install redirect (?return= or ?next=). */
export function readSetupReturnPath(raw: string | undefined | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return DEFAULT_RETURN;
  if (/^\/(setup|api)(\/|$)/i.test(trimmed)) return DEFAULT_RETURN;
  return trimmed;
}
