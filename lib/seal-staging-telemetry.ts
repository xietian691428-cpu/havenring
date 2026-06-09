import { recordSealTelemetry } from "@/lib/sealTelemetry";

export type SealStagingTelemetryInput = {
  user_id?: string;
  phase: "create" | "read" | "delete" | "purge";
  outcome: "success" | "error";
  error_code?: string;
  storage_backend?: "db" | "object";
  byte_size?: number;
  latency_ms?: number;
};

export async function recordSealStagingTelemetry(
  admin: unknown,
  input: SealStagingTelemetryInput
) {
  await recordSealTelemetry(admin as Parameters<typeof recordSealTelemetry>[0], {
    user_id: input.user_id,
    endpoint: "staging",
    phase: input.phase,
    outcome: input.outcome,
    error_code: input.error_code,
    mode: input.storage_backend || undefined,
    latency_ms: input.latency_ms,
    byte_size: input.byte_size,
  });
}
