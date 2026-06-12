import { NextRequest, NextResponse } from "next/server";
import {
  CLOUD_STORAGE_FULL_CODE,
  CLOUD_STORAGE_FULL_MESSAGE,
} from "@/lib/cloud-storage-config";
import {
  assertCloudQuotaForUpload,
  getCloudQuotaForUser,
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

    const url = new URL(req.url);
    const probeRaw = url.searchParams.get("additional_bytes") || "0";
    const additionalBytes = Math.max(0, Number.parseInt(probeRaw, 10) || 0);

    if (additionalBytes > 0) {
      try {
        const snapshot = await assertCloudQuotaForUpload(user.id, additionalBytes);
        return NextResponse.json({ ok: true, ...snapshot });
      } catch (error) {
        if (error instanceof Error && error.message === CLOUD_STORAGE_FULL_CODE) {
          const snapshot = await getCloudQuotaForUser(user.id);
          return NextResponse.json(
            {
              ok: false,
              error: CLOUD_STORAGE_FULL_MESSAGE,
              error_code: CLOUD_STORAGE_FULL_CODE,
              ...snapshot,
            },
            { status: 413 }
          );
        }
        throw error;
      }
    }

    const snapshot = await getCloudQuotaForUser(user.id);
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error) {
    if (error instanceof Error && error.message === "CLOUD_BACKUP_PLUS_REQUIRED") {
      return NextResponse.json(
        { error: "Haven Plus required for cloud backup.", error_code: "PLUS_REQUIRED" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Unauthorized.", error_code: "UNAUTHORIZED" }, { status: 401 });
  }
}
