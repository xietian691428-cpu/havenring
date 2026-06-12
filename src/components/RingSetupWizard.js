/**
 * Optional ring link — full bind UX lives on /bind-ring.
 * This modal redirects there when opened (Rings, Home, recovery).
 */

import { useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const RING_SETUP_DISMISSED_KEY = STORAGE_KEYS.ringSetupDismissed;

export function RingSetupWizard({ open, onClose }) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.location.assign("/bind-ring");
    onClose?.();
  }, [open, onClose]);

  return null;
}
