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

  const ringRowsByHaven = await Promise.all(
    activeHavenIds.map(async (havenId) => {
      const { data: rings, error: ringsErr } = await admin
        .from("user_nfc_rings")
        .select("id")
        .eq("haven_id", havenId)
        .eq("is_active", true);
      if (ringsErr) throw ringsErr;
      const memberRow = memberCounts.find((row) => row.havenId === havenId);
      const memberCount = memberRow?.count ?? 0;
      const ringIds = (rings ?? []).map((row) => row.id).filter(Boolean) as string[];
      return { havenId, memberCount, ringIds };
    })
  );

  const pairedHaven = ringRowsByHaven.find(
    (row) => row.memberCount >= 2 && row.ringIds.length >= 2
  );
  const pairActive = Boolean(pairedHaven);
  const scopeHavenIds = pairActive
    ? [pairedHaven!.havenId]
    : activeHavenIds;
  const ringIds = (
    pairActive ? pairedHaven!.ringIds : ringRowsByHaven.flatMap((row) => row.ringIds)
  ) as string[];

  return {
    havenIds: scopeHavenIds,
    ringIds,
    memberCount: pairActive ? pairedHaven!.memberCount : maxMembers,
    pairActive,
  };
}
