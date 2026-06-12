import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { userOwnsRing } from "@/lib/haven-access";

type AdminClient = SupabaseClient<Database>;

/**
 * Resolve an active ring the caller may operate on (pin, token issue, revoke).
 * Phase 5: owner-only — legacy haven_members broad access removed.
 *
 * @deprecated Name retained for imports; pair membership no longer grants ring ops.
 */
export async function getRingWithMembership(
  admin: AdminClient,
  ringId: string,
  userId: string
) {
  const { data: ring, error } = await admin
    .from("user_nfc_rings")
    .select("id, user_id, haven_id, is_active")
    .eq("id", ringId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !ring) {
    return { ring: null, error };
  }

  if (userOwnsRing(userId, ring)) {
    return { ring, error: null };
  }

  return { ring: null, error: null };
}
