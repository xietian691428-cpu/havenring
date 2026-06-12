import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildPartnerInviteUrl } from "@/lib/partner-invite-url";
import {
  createInviteKeyPackage,
  encodeInviteKeyPackage,
  uploadWrappedHavenKey,
} from "@/src/services/havenKeyService";

/** @deprecated Legacy second-ring invite (Phase 5). Plus explicit sharing is separate. */
export async function preparePartnerInvite({ havenId }) {
  const sb = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.access_token) {
    throw new Error("cloud_sign_in_required");
  }

  if (havenId) {
    await uploadWrappedHavenKey({
      accessToken: session.access_token,
      havenId,
    });
  }

  const inviteRes = await fetch("/api/haven/invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ haven_id: havenId || undefined }),
  });
  const invitePayload = await inviteRes.json().catch(() => ({}));
  if (!inviteRes.ok) {
    throw new Error(invitePayload.error || "Could not create invite.");
  }

  const keyPackage = await createInviteKeyPackage(
    invitePayload.havenId,
    invitePayload.inviteCode
  );
  const encodedPackage = encodeInviteKeyPackage(keyPackage);

  const deliveryRes = await fetch("/api/haven/invite/delivery", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invite_code: invitePayload.inviteCode,
      key_package: encodedPackage,
    }),
  });
  const deliveryPayload = await deliveryRes.json().catch(() => ({}));
  if (!deliveryRes.ok) {
    throw new Error(deliveryPayload.error || "Could not prepare invite link.");
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = buildPartnerInviteUrl(
    origin,
    invitePayload.inviteCode,
    deliveryPayload.keyToken
  );

  return {
    inviteCode: invitePayload.inviteCode,
    keyToken: deliveryPayload.keyToken,
    inviteUrl,
    expiresAt: invitePayload.expiresAt || deliveryPayload.expiresAt,
    havenId: invitePayload.havenId,
    accessToken: session.access_token,
  };
}

export async function fetchPartnerInviteStatus({ inviteCode, accessToken }) {
  const res = await fetch(
    `/api/haven/invite/status?invite=${encodeURIComponent(inviteCode)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "status_failed");
  }
  return payload;
}

export async function revokePartnerInvite({ inviteCode, accessToken }) {
  const res = await fetch("/api/haven/invite", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invite_code: inviteCode }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Could not revoke invite.");
  }
  return payload;
}
