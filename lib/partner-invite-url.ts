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

/** Legacy invite share — product moving to explicit Shared memories (Plus). */
export const PARTNER_INVITE_SHARE = {
  title: "Haven invite",
  text: "Open this link on your phone and sign in with your own account.",
} as const;
