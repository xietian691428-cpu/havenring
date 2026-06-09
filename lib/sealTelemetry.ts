type SealTelemetryInput = {
  user_id?: string;
  endpoint: "ring_tap" | "finalize" | "staging";
  phase: string;
  outcome: "success" | "error";
  error_code?: string;
  mode?: string;
  latency_ms?: number;
  byte_size?: number;
};

export async function recordSealTelemetry(
  admin: any,
  input: SealTelemetryInput
) {
  const payload = {
    user_id: input.user_id || null,
    endpoint: input.endpoint,
    phase: input.phase,
    outcome: input.outcome,
    error_code: input.error_code || null,
    mode: input.mode || null,
    latency_ms: Number(input.latency_ms || 0) || 0,
    byte_size:
      typeof input.byte_size === "number" && input.byte_size >= 0
        ? Math.round(input.byte_size)
        : null,
    created_at: new Date().toISOString(),
  };
  console.info("[seal_telemetry]", JSON.stringify(payload));
  if (!admin) return;
  try {
    await admin.from("seal_telemetry_events" as never).insert(payload as never);
  } catch {
    /* non-blocking */
  }
}
