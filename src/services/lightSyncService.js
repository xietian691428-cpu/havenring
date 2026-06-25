import { isIosWebKit } from "@/lib/composer-platform-limits";
import { shouldAllowIosFullPairSync } from "@/lib/ios-app-boot";
import { isPostSealQuietWindow } from "@/lib/post-seal-memory-guard";
import { peekCloudBackupManifest, restoreCloudBackupsQuietly } from "./cloudBackupService";
import { syncPairMemoriesFromServer } from "./pairSharingService";
import { syncRingScopedCaches } from "./ringSyncService";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { flushOfflineSyncQueue } from "./offlineSyncQueue";

/**
 * Pull-refresh sync — local-first on iOS WebKit (metadata only; no pair import / cloud merge).
 */
export async function runPullRefreshSync() {
  const sb = getSupabaseBrowserClient();
  const { data } = await sb.auth.getSession();
  const accessToken = data.session?.access_token || "";
  if (!accessToken) {
    return { ok: false, reason: "auth", issues: ["auth"] };
  }

  const iosSafe = isIosWebKit();
  const postSealQuiet = isPostSealQuietWindow();

  if (!iosSafe && !postSealQuiet) {
    try {
      await flushOfflineSyncQueue(accessToken);
    } catch {
      /* optional */
    }
  }

  const includePairSync =
    !iosSafe && !postSealQuiet
      ? true
      : iosSafe && shouldAllowIosFullPairSync() && !postSealQuiet;

  const outcome = await syncRingScopedCaches({
    includePairSync,
    fullPairSync: false,
  });

  let cloudMerged = 0;
  if (!iosSafe && !postSealQuiet) {
    await peekCloudBackupManifest();
    const cloud = await restoreCloudBackupsQuietly();
    cloudMerged = Number(cloud?.merged || 0);
  }

  return {
    ok: true,
    outcome,
    cloudMerged,
    issues: Array.isArray(outcome?.issues) ? outcome.issues : [],
  };
}

/**
 * Light pull-refresh sync — incremental pair + manifest peek + one quiet cloud merge.
 */
export async function runLightManifestSync() {
  const sb = getSupabaseBrowserClient();
  const { data } = await sb.auth.getSession();
  const accessToken = data.session?.access_token || "";
  if (!accessToken) {
    return { ok: false, reason: "auth", issues: ["auth"] };
  }

  try {
    await flushOfflineSyncQueue(accessToken);
  } catch {
    /* optional */
  }

  const outcome = await syncRingScopedCaches({
    includePairSync: true,
    fullPairSync: false,
  });

  await peekCloudBackupManifest();
  const cloud = await restoreCloudBackupsQuietly();

  return {
    ok: true,
    outcome,
    cloudMerged: Number(cloud?.merged || 0),
    issues: Array.isArray(outcome?.issues) ? outcome.issues : [],
  };
}

/**
 * Deep sync — full pair re-import + full cloud restore (Settings).
 */
export async function runDeepManifestSync() {
  const sb = getSupabaseBrowserClient();
  const { data } = await sb.auth.getSession();
  const accessToken = data.session?.access_token || "";
  if (!accessToken) {
    return { ok: false, reason: "auth", issues: ["auth"] };
  }

  try {
    await flushOfflineSyncQueue(accessToken);
  } catch {
    /* optional */
  }

  const outcome = await syncRingScopedCaches({
    includePairSync: true,
    fullPairSync: true,
  });

  let cloudMerged = 0;
  try {
    const { restoreFromCloudDeep } = await import("./cloudBackupService");
    const cloud = await restoreFromCloudDeep();
    cloudMerged = Number(cloud?.merged || 0);
  } catch (error) {
    console.warn("[haven-ring] deep cloud restore skipped:", error);
  }

  try {
    await syncPairMemoriesFromServer(accessToken, { fullPairSync: true });
  } catch {
    /* pair import already attempted in ring sync */
  }

  return {
    ok: true,
    outcome,
    cloudMerged,
    issues: Array.isArray(outcome?.issues) ? outcome.issues : [],
  };
}
