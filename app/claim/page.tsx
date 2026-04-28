import {
  getPreferredLocale,
  isSupportedLocale,
} from "@/lib/i18n";
import { redirect } from "next/navigation";

type ClaimReason =
  | "ring_inactive"
  | "nfc_unavailable"
  | "permission_denied"
  | "unknown";

function getReason(raw: string | undefined): ClaimReason {
  if (raw === "ring_inactive") return "ring_inactive";
  if (raw === "nfc_unavailable") return "nfc_unavailable";
  if (raw === "permission_denied") return "permission_denied";
  return "unknown";
}

interface ClaimPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClaimPage({ searchParams }: ClaimPageProps) {
  const sp = await searchParams;
  const lang = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;
  const reasonParam = Array.isArray(sp.reason) ? sp.reason[0] : sp.reason;
  const tokenParam = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const locale = isSupportedLocale(lang) ? lang : getPreferredLocale(null);
  const reason = getReason(reasonParam);
  const next = new URLSearchParams();
  next.set("ring", "signin");
  next.set("lang", locale);
  next.set("reason", reason);
  if (tokenParam) next.set("token", tokenParam);
  redirect(`/?${next.toString()}`);
}
