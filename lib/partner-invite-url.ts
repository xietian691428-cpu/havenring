export function buildPartnerInviteUrl(
  origin: string,
  inviteCode: string,
  keyToken: string
): string {
  const url = new URL("/bind-ring", origin);
  url.searchParams.set("invite", inviteCode);
  url.searchParams.set("kt", keyToken);
  return url.toString();
}

/** Partner link share sheet copy. */
export const PARTNER_INVITE_SHARE = {
  title: "Link with me on Haven",
  text: "Open this link on your phone to link our rings.",
} as const;
