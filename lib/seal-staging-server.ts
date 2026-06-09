import { getSupabaseAdminClient } from "@/lib/supabase/server";

/** Hard-delete staging row after seal commit or explicit cancel. */
export async function consumeSealStagingById(
  stagingId: string,
  userId: string
): Promise<void> {
  const id = String(stagingId || "").trim();
  if (!id || !userId) return;
  const admin = getSupabaseAdminClient();
  await admin.from("seal_staging" as never).delete().eq("id", id).eq("user_id", userId);
}

/** Best-effort purge of expired unconsumed staging rows (cron or admin). */
export async function purgeExpiredSealStaging(): Promise<void> {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("seal_staging" as never)
    .delete()
    .lt("expires_at", now);
}
