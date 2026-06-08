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

export const PARTNER_INVITE_SHARE = {
  title: "Join my Haven - Shared Memory Space",
  text: "Hey, tap this link on your phone with your ring to join our shared Haven.",
} as const;
