import { PARTNER_INVITE_SHARE } from "@/lib/partner-invite-url";

export type ShareInviteResult = "shared" | "copied" | "cancelled" | "failed";

export function canNativeShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  );
}

export async function shareInviteLink(url: string): Promise<ShareInviteResult> {
  const title = PARTNER_INVITE_SHARE.title;
  const text = PARTNER_INVITE_SHARE.text;

  if (canNativeShare()) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") return "cancelled";
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      const payload = `${text}\n\n${url}`;
      await navigator.clipboard.writeText(payload);
      return "copied";
    }
  } catch {
    /* fall through */
  }

  return "failed";
}
