import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserRateLimit } from "@/lib/api-rate-limit";
import {
  downloadCloudBackupObject,
  listLatestCloudMemoryBackups,
  requirePlusCloudBackup,
} from "@/lib/cloud-storage-server";
import {
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    await requirePlusCloudBackup(user.id);

    const limitRes = await enforceUserRateLimit({
      userId: user.id,
      scope: "cloud-backup-latest",
      policy: API_RATE_POLICIES.cloudBackupUpload,
    });
    if (limitRes) return limitRes;

    const memoryId = req.nextUrl.searchParams.get("memory_id");
    const uploadId = String(req.nextUrl.searchParams.get("upload_id") || "").trim();
    const includeData = req.nextUrl.searchParams.get("include_data") === "1";

    if (uploadId && includeData) {
      const buf = await downloadCloudBackupObject(user.id, uploadId);
      return NextResponse.json({
        ok: true,
        upload_id: uploadId,
        data_b64: buf.toString("base64"),
        byte_size: buf.length,
      });
    }

    const backups = await listLatestCloudMemoryBackups(user.id, memoryId);
    return NextResponse.json({ ok: true, backups });
  } catch (error) {
    if (error instanceof Error && error.message === "CLOUD_BACKUP_PLUS_REQUIRED") {
      return NextResponse.json(
        { error: "Haven Plus required for cloud backup.", error_code: "PLUS_REQUIRED" },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === "CLOUD_BACKUP_NOT_FOUND") {
      return NextResponse.json(
        { error: "Cloud backup not found.", error_code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Could not read cloud backups.", error_code: "CLOUD_BACKUP_LIST_FAILED" },
      { status: 500 }
    );
  }
}
