type SealTelemetryInput = {
  user_id?: string;
  endpoint: "ring_tap" | "finalize";
  phase: "request" | "precheck" | "commit" | "issue_ticket";
  outcome: "success" | "error";
  error_code?: string;
  mode?: string;
  latency_ms?: number;
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
    created_at: new Date().toISOString(),
  };
  // Always keep a structured server log for quick triage.
  console.info("[seal_telemetry]", JSON.stringify(payload));
  if (!admin) return;
  try {
    await admin.from("seal_telemetry_events" as never).insert(payload as never);
  } catch {
    // Do not block sealing flow if telemetry storage is unavailable.
  }
}
