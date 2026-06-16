/** Session flag: Settings → Rings opens partner invite panel once. */
export const OPEN_PARTNER_INVITE_SESSION_KEY = "haven_open_partner_invite";

export function markOpenPartnerInviteOnRings() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(OPEN_PARTNER_INVITE_SESSION_KEY, "1");
}

export function consumeOpenPartnerInviteOnRings(): boolean {
  if (typeof window === "undefined") return false;
  const flag = window.sessionStorage.getItem(OPEN_PARTNER_INVITE_SESSION_KEY);
  if (flag) window.sessionStorage.removeItem(OPEN_PARTNER_INVITE_SESSION_KEY);
  return flag === "1";
}
