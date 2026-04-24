"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The "pending moment" is a moment that has already been encrypted and
 * uploaded to Supabase as `is_sealed: false`, and is now waiting for the
 * user to physically tap the ring. We keep only the server-side row id
 * (and metadata about what we're waiting for) — NEVER the plaintext or
 * the ciphertext.
 *
 * This piece of state IS persisted: if the user puts their phone down and
 * comes back later, the pending state should survive so they can still tap
 * to seal.
 */
export interface PendingMoment {
  /** Supabase moments.id */
  momentId: string;
  /** Supabase rings.id this moment is bound to */
  ringId: string;
  /** Wall-clock when the moment was staged, for session timeout UX */
  stagedAt: number;
}

/**
 * Short-lived vault access granted by a ring tap that had no pending moment.
 * DELIBERATELY NOT PERSISTED — the ritual requires a fresh tap every time
 * the user wants to revisit sealed moments. Closing the tab revokes access.
 */
export interface VaultAccess {
  /** The ring whose vault is unlocked. */
  ringId: string;
  /** The opaque NFC token from the tap that granted access. */
  token: string;
  /** Epoch ms when the tap happened. */
  grantedAt: number;
  /** Epoch ms after which this access is considered stale. */
  expiresAt: number;
}

/** 15 minutes — long enough to read, short enough to be ceremonial. */
export const VAULT_ACCESS_TTL_MS = 15 * 60 * 1000;

export type SealStage = "idle" | "composing" | "awaiting_tap" | "sealed";

interface HavenState {
  stage: SealStage;
  pending: PendingMoment | null;
  vaultAccess: VaultAccess | null;
  claimToken: string | null;
  linkedRingId: string | null;

  setStage: (stage: SealStage) => void;
  stagePending: (m: PendingMoment) => void;
  clearPending: () => void;

  grantVaultAccess: (ringId: string, token: string) => void;
  revokeVaultAccess: () => void;
  setClaimToken: (token: string | null) => void;
  setLinkedRingId: (ringId: string | null) => void;

  /** Full local reset — used on wipe. */
  reset: () => void;
}

export const useHavenStore = create<HavenState>()(
  persist(
    (set) => ({
      stage: "idle",
      pending: null,
      vaultAccess: null,
      claimToken: null,
      linkedRingId: null,

      setStage: (stage) => set({ stage }),
      stagePending: (pending) => set({ pending, stage: "awaiting_tap" }),
      clearPending: () => set({ pending: null, stage: "idle" }),

      grantVaultAccess: (ringId, token) => {
        const now = Date.now();
        set({
          vaultAccess: {
            ringId,
            token,
            grantedAt: now,
            expiresAt: now + VAULT_ACCESS_TTL_MS,
          },
        });
      },
      revokeVaultAccess: () => set({ vaultAccess: null }),
      setClaimToken: (claimToken) => set({ claimToken }),
      setLinkedRingId: (linkedRingId) => set({ linkedRingId }),

      reset: () =>
        set({
          stage: "idle",
          pending: null,
          vaultAccess: null,
          claimToken: null,
          linkedRingId: null,
        }),
    }),
    {
      name: "haven.pending",
      storage: createJSONStorage(() => localStorage),
      // Persist ONLY the compose-side state. Vault access is intentionally
      // never persisted — a fresh tap must grant a fresh session.
      partialize: (s) => ({
        stage: s.stage,
        pending: s.pending,
        linkedRingId: s.linkedRingId,
      }),
      skipHydration: true,
    }
  )
);

/** Call once on the client after mount to rehydrate the persisted store. */
export function hydrateHavenStore() {
  if (typeof window === "undefined") return;
  useHavenStore.persist.rehydrate();
}

/** True if the in-memory access is present, matches, and not expired. */
export function hasValidVaultAccess(
  access: VaultAccess | null,
  ringId: string,
  now: number = Date.now()
): access is VaultAccess {
  if (!access) return false;
  if (access.ringId !== ringId) return false;
  if (access.expiresAt <= now) return false;
  return true;
}
