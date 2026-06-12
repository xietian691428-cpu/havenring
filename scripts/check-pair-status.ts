/**
 * Ops: audit Pair bindings in production Supabase.
 * Run (with service role in env):
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/check-pair-status.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: members, error: mErr } = await admin
    .from("haven_members")
    .select("haven_id, user_id, role, created_at")
    .order("created_at", { ascending: true });
  if (mErr) throw mErr;

  const byHaven = new Map<string, NonNullable<typeof members>>();
  for (const row of members ?? []) {
    const list = byHaven.get(row.haven_id) ?? [];
    list.push(row);
    byHaven.set(row.haven_id, list);
  }

  const { data: rings, error: rErr } = await admin
    .from("user_nfc_rings")
    .select("id, user_id, haven_id, nickname, bound_at, is_active, nfc_uid_hash")
    .eq("is_active", true)
    .order("bound_at", { ascending: true });
  if (rErr) throw rErr;

  const { data: moments, error: moErr } = await admin
    .from("moments")
    .select("id, haven_id, created_at")
    .eq("is_sealed", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (moErr) throw moErr;

  const havens = [...byHaven.entries()].map(([havenId, mems]) => {
    const havenRings = (rings ?? []).filter((r) => r.haven_id === havenId);
    const uniqueUsers = new Set(mems.map((m) => m.user_id));
    return {
      havenId,
      memberCount: mems.length,
      distinctAccounts: uniqueUsers.size,
      pairComplete: mems.length >= 2 && uniqueUsers.size >= 2,
      ringCount: havenRings.length,
      readyForPairSync:
        mems.length >= 2 && uniqueUsers.size >= 2 && havenRings.length >= 2,
      rings: havenRings.map((r) => ({
        nickname: r.nickname || "(unnamed)",
        boundAt: r.bound_at,
        userIdShort: `${r.user_id.slice(0, 8)}…`,
      })),
      sealedMomentCount: (moments ?? []).filter((m) => m.haven_id === havenId).length,
    };
  });

  havens.sort((a, b) => b.memberCount - a.memberCount);
  const complete = havens.filter((h) => h.readyForPairSync);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        summary: {
          completePairs: complete.length,
          totalHavens: havens.length,
        },
        completePairs: complete,
        allHavens: havens,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
