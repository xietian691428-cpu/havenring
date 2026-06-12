import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { PAIR_MAX_MEMBERS } from "@/lib/pair-sharing";

type AdminClient = SupabaseClient<Database>;

export type HavenPairScope = {
  havenIds: string[];
  ringIds: string[];
  memberCount: number;
  pairActive: boolean;
};

/** Resolve haven + ring scope for Pair sync (all active rings in member havens). */
export async function resolveHavenPairScope(
  admin: AdminClient,
  userId: string
): Promise<HavenPairScope> {
  const { data: memberships, error: memErr } = await admin
    .from("haven_members")
    .select("haven_id")
    .eq("user_id", userId);

  if (memErr) throw memErr;

  const havenIds = [
    ...new Set((memberships ?? []).map((row) => row.haven_id).filter(Boolean)),
  ] as string[];

  if (!havenIds.length) {
    return { havenIds: [], ringIds: [], memberCount: 0, pairActive: false };
  }

  const memberCounts = await Promise.all(
    havenIds.map(async (havenId) => {
      const { count, error } = await admin
        .from("haven_members")
        .select("id", { count: "exact", head: true })
        .eq("haven_id", havenId);
      if (error) throw error;
      return { havenId, count: count ?? 0 };
    })
  );

  const activeHavenIds = memberCounts
    .filter((row) => row.count > 0 && row.count <= PAIR_MAX_MEMBERS)
    .map((row) => row.havenId);

  const maxMembers = memberCounts.reduce((max, row) => Math.max(max, row.count), 0);

  if (!activeHavenIds.length) {
    return { havenIds: [], ringIds: [], memberCount: maxMembers, pairActive: false };
  }

  const { data: rings, error: ringsErr } = await admin
    .from("user_nfc_rings")
    .select("id")
    .in("haven_id", activeHavenIds)
    .eq("is_active", true);

  if (ringsErr) throw ringsErr;

  const ringIds = (rings ?? []).map((row) => row.id).filter(Boolean) as string[];

  return {
    havenIds: activeHavenIds,
    ringIds,
    memberCount: maxMembers,
    pairActive: maxMembers >= 2 && ringIds.length >= 2,
  };
}
