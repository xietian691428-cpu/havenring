import { buildPartnerInviteUrl } from "@/lib/partner-invite-url";
import {
  PARTNER_INVITE_KEY_TOKEN_STORAGE_KEY,
  PARTNER_INVITE_STORAGE_KEY,
} from "@/src/services/havenKeyService";

export function readPendingPartnerInviteCode(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PARTNER_INVITE_STORAGE_KEY) || "";
}

export function readPendingPartnerInviteKeyToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PARTNER_INVITE_KEY_TOKEN_STORAGE_KEY) || "";
}

/** Append partner invite query params when a pending join is in progress. */
export function appendPendingPartnerInviteParams(params: URLSearchParams): void {
  const invite = readPendingPartnerInviteCode();
  const kt = readPendingPartnerInviteKeyToken();
  if (invite) params.set("invite", invite);
  if (kt) params.set("kt", kt);
}

export function buildBindRingUrl(origin: string, uid: string): string {
  const params = new URLSearchParams();
  if (uid) params.set("uid", uid);
  appendPendingPartnerInviteParams(params);
  const qs = params.toString();
  return qs ? `${origin}/bind-ring?${qs}` : `${origin}/bind-ring`;
}

export function hasPendingPartnerInvite(): boolean {
  return Boolean(readPendingPartnerInviteCode());
}
