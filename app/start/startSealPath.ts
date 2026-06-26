import { hasSdmSearch } from "@/lib/nfc-intent";
import { isSealFlowArmed } from "@/lib/seal-flow";
import {
  isPrimarySealWaitPage,
  isSealWaitSearch,
} from "@/src/features/seal/sealCore";

export function isSealNfcLaunchSearch(search: string): boolean {
  return hasSdmSearch(search);
}

/** True when /start should load seal finalize orchestration (not idle marketing shell). */
export function isStartSealPathActive(
  search: string = "",
  sealWaitMode = false
): boolean {
  if (typeof window === "undefined" && !search) return false;
  const q = search || (typeof window !== "undefined" ? window.location.search : "");
  return (
    sealWaitMode ||
    isSealNfcLaunchSearch(q) ||
    isSealWaitSearch(q) ||
    isPrimarySealWaitPage(q) ||
    isSealFlowArmed()
  );
}
