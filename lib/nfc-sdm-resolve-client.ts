/**
 * Client-side SDM resolve + Web NFC listen with silent auto-retry.
 */
import { listenForSealRingTapOnce } from "@/src/features/seal/sealCore";
import {
  isRetryableHttpStatus,
  isRetryableNetworkFailure,
  USER_FACING,
  userFacingMessageFromCode,
  userFacingMessageFromUnknown,
} from "@/lib/user-facing-errors";
import { sleepMs } from "@/lib/nfc-flow-timing";

export const NFC_AUTO_RETRY_COUNT = 2;

export type SdmResolveAttemptResult =
  | { ok: true; response: Response; data: Record<string, unknown> }
  | { ok: false; retryable: boolean; apiCode: string; message: string };

export async function postSdmResolveWithRetry(args: {
  headers: Record<string, string>;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  maxRetries?: number;
}): Promise<SdmResolveAttemptResult> {
  const maxRetries = args.maxRetries ?? NFC_AUTO_RETRY_COUNT;
  let lastMessage: string = USER_FACING.tapRingAgain;
  let lastCode = "";
  let lastRetryable = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("/api/rings/sdm/resolve", {
        method: "POST",
        headers: args.headers,
        signal: args.signal,
        body: JSON.stringify(args.body),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const apiCode = typeof data.code === "string" ? data.code : "";
      const apiError = typeof data.error === "string" ? data.error : "";

      if (response.ok && data.valid === true) {
        return { ok: true, response, data };
      }

      lastCode = apiCode;
      lastMessage = userFacingMessageFromCode(
        apiCode,
        userFacingMessageFromUnknown(apiError, USER_FACING.tapRingAgain)
      );
      lastRetryable =
        isRetryableHttpStatus(response.status) &&
        apiCode !== "SDM_REPLAY_DETECTED" &&
        !/already used/i.test(apiError);

      if (lastRetryable && attempt < maxRetries) {
        await sleepMs(450 * (attempt + 1));
        continue;
      }

      return { ok: false, retryable: lastRetryable, apiCode: lastCode, message: lastMessage };
    } catch (error) {
      const aborted = args.signal?.aborted;
      lastRetryable = !aborted && isRetryableNetworkFailure(error);
      lastMessage = aborted
        ? USER_FACING.tapRingAgain
        : userFacingMessageFromUnknown(error, USER_FACING.networkRetry);
      lastCode = "";

      if (lastRetryable && attempt < maxRetries) {
        await sleepMs(450 * (attempt + 1));
        continue;
      }

      return { ok: false, retryable: lastRetryable, apiCode: lastCode, message: lastMessage };
    }
  }

  return {
    ok: false,
    retryable: lastRetryable,
    apiCode: lastCode,
    message: lastMessage || USER_FACING.tapRingAgain,
  };
}

export async function listenForRingTapWithRetry(
  origin: string,
  maxRetries: number = NFC_AUTO_RETRY_COUNT
): Promise<{ ok: true; target: string } | { ok: false; message: string }> {
  let lastMessage: string = USER_FACING.tapRingAgain;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await listenForSealRingTapOnce(origin);
    if (result.ok) {
      return { ok: true, target: result.target };
    }
    lastMessage = userFacingMessageFromUnknown(result.message, USER_FACING.tapRingAgain);
    if (attempt < maxRetries) {
      await sleepMs(500 * (attempt + 1));
    }
  }

  return { ok: false, message: lastMessage };
}
