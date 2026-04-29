import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getSupabaseUserClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

/**
 * GET /api/nfc/list — active NFC ring bindings for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const accessToken = requireBearerToken(req);
    const supabase = getSupabaseUserClient(accessToken);

    const { data, error } = await supabase
      .from("user_nfc_rings")
      .select(
        "id, nfc_uid_hash, nickname, bound_at, last_used_at, is_active, created_at"
      )
      .eq("user_id", user.id)
      .order("bound_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rings: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
