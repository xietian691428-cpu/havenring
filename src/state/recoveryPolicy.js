export function classifySyncHealth({
  syncIssues = [],
  integrityWarning = "",
  syncMeta = {},
}) {
  const issues = Array.isArray(syncIssues) ? syncIssues : [];
  const hasHashIssue = Boolean(integrityWarning) || issues.includes("hash");
  const hasAuthIssue =
    issues.includes("auth") || String(syncMeta?.lastFailureCode || "") === "auth";
  const hasNetworkIssue =
    issues.includes("network") ||
    String(syncMeta?.lastFailureCode || "") === "network";

  if (hasHashIssue) {
    return { severity: "hard", reason: "hash_mismatch" };
  }
  if (hasAuthIssue) {
    return { severity: "hard", reason: "auth_expired" };
  }
  if (hasNetworkIssue) {
    return { severity: "soft", reason: "network" };
  }
  return { severity: "ok", reason: "" };
}

