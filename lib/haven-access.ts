import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AdminClient = SupabaseClient<Database>;

export type HavenRingRow = {
  id: string;
  user_id: string;
  haven_id: string | null;
  is_active?: boolean | null;
};

/**
 * Pair model — max 2 haven members; sealed memories sync within the Pair.
 * Personal drafts stay device-local until sealed; seal commits to haven scope.
 */

/** Haven member check for Pair-scoped reads (sync / import). */
export async function isLegacyHavenMember(
  admin: AdminClient,
  userId: string,
  havenId: string | null | undefined
): Promise<boolean> {
  if (!havenId || !userId) return false;
  const { data, error } = await admin
    .from("haven_members")
    .select("id")
    .eq("haven_id", havenId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function userOwnsRing(
  userId: string,
  ring: Pick<HavenRingRow, "user_id">
): boolean {
  return Boolean(userId && ring.user_id === userId);
}

/** Seal and ring credential mutations require the bound owner account. */
export function userCanSealWithRing(
  userId: string,
  ring: Pick<HavenRingRow, "user_id">
): boolean {
  return userOwnsRing(userId, ring);
}

/** Pair member may read sealed moments in the same haven (not ring-owner ops). */
export async function userCanReadPairMoments(
  admin: AdminClient,
  userId: string,
  havenId: string | null | undefined
): Promise<boolean> {
  return isLegacyHavenMember(admin, userId, havenId);
}

/** @deprecated Alias — use userCanReadPairMoments. */
export async function userHasLegacyHavenAccess(
  admin: AdminClient,
  userId: string,
  ring: Pick<HavenRingRow, "user_id" | "haven_id">
): Promise<boolean> {
  if (userOwnsRing(userId, ring)) return true;
  return isLegacyHavenMember(admin, userId, ring.haven_id);
}
