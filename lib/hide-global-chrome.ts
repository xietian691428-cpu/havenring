/** Hide marketing/accessibility chrome on immersive app flows (Apple-style full-bleed screens). */
export function shouldHideGlobalChrome(pathname: string): boolean {
  return /^\/(app|start|bind-ring|hub|seal-success|claim|seal)(\/|$)/.test(pathname);
}
