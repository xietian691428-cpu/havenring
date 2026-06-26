/**
 * Dynamic loader for seal finalize + ring-tap prep (composer / heavy paths).
 */

export async function loadPrepareSealForRingTap() {
  const mod = await import("./sealFlowClient");
  return mod.prepareSealForRingTap;
}

export async function loadSealFinalizeModule() {
  return import("./sealFinalize");
}

export async function loadSealFlowClient() {
  return import("./sealFlowClient");
}
