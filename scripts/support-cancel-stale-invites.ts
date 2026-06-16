/**
 * Ops: cancel duplicate pending ring_invites (keep newest per haven).
 *
 *   npx tsx scripts/support-cancel-stale-invites.ts --dry-run
 *   npx tsx scripts/support-cancel-stale-invites.ts
 *   npx tsx scripts/support-cancel-stale-invites.ts --haven-id <uuid>
 */
import { createClient } from "@supabase/supabase-js";

type InviteRow = {
  id: string;
  haven_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  cancelled_at: string | null;
};

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const havenIdx = argv.indexOf("--haven-id");
  const havenId =
    havenIdx >= 0 && typeof argv[havenIdx + 1] === "string"
      ? argv[havenIdx + 1]!.trim()
      : "";
  return { dryRun, havenId };
}

async function main() {
  const { dryRun, havenId } = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  let query = admin
    .from("ring_invites")
    .select("id, haven_id, created_by, created_at, expires_at, consumed_at, cancelled_at")
    .is("consumed_at", null)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });

  if (havenId) {
    query = query.eq("haven_id", havenId);
  }

  const { data: pending, error } = await query;
  if (error) throw error;

  const rows = (pending ?? []) as InviteRow[];
  const keepByHaven = new Map<string, InviteRow>();
  for (const row of rows) {
    if (!keepByHaven.has(row.haven_id)) {
      keepByHaven.set(row.haven_id, row);
    }
  }

  const toCancel = rows.filter((row) => keepByHaven.get(row.haven_id)?.id !== row.id);
  const keep = [...keepByHaven.values()];

  console.log(
    JSON.stringify(
      {
        dryRun,
        pendingCount: rows.length,
        keepCount: keep.length,
        cancelCount: toCancel.length,
        keep: keep.map((row) => ({
          id: row.id,
          haven_id: row.haven_id,
          created_at: row.created_at,
          expires_at: row.expires_at,
        })),
        cancel: toCancel.map((row) => ({
          id: row.id,
          haven_id: row.haven_id,
          created_at: row.created_at,
        })),
      },
      null,
      2
    )
  );

  if (dryRun || !toCancel.length) {
    return;
  }

  const now = new Date().toISOString();
  const ids = toCancel.map((row) => row.id);
  const { error: updateErr } = await admin
    .from("ring_invites")
    .update({ cancelled_at: now })
    .in("id", ids)
    .is("consumed_at", null)
    .is("cancelled_at", null);
  if (updateErr) throw updateErr;

  console.log(`Cancelled ${ids.length} stale invite(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
