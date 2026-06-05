export type NfcIntent = "bind" | "seal" | "claim" | "daily" | "idle";

export function hasSdmSearch(search: string): boolean {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const cmac = sp.get("cmac") || "";
  const picc = sp.get("picc") || sp.get("picc_data") || "";
  const uid = sp.get("uid") || "";
  const ctr = sp.get("ctr") || "";
  return Boolean(cmac) && (Boolean(picc) || (Boolean(uid) && Boolean(ctr)));
}

export function readNfcIntent(search: string): NfcIntent {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (sp.get("intent") || "").trim().toLowerCase();
  if (raw === "bind" || raw === "seal" || raw === "claim" || raw === "daily") {
    return raw;
  }
  if ((sp.get("claim") || "").trim()) return "claim";
  if (hasSdmSearch(search)) return "daily";
  return "idle";
}

export function withNfcIntent(href: string, intent: Exclude<NfcIntent, "idle">): string {
  const url = new URL(href, "https://havenring.me");
  url.searchParams.set("intent", intent);
  return `${url.pathname}${url.search}${url.hash}`;
}
