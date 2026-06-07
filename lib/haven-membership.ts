import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AdminClient = SupabaseClient<Database>;

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

  if (ring.user_id === userId) {
    return { ring, error: null };
  }

  if (!ring.haven_id) {
    return { ring: null, error: null };
  }

  const { data: member, error: memberError } = await admin
    .from("haven_members")
    .select("id")
    .eq("haven_id", ring.haven_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    return { ring: null, error: memberError };
  }

  return { ring: member ? ring : null, error: null };
}
