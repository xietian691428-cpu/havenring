export function classifySyncHealth({
  syncIssues = [],
  integrityWarning = "",
  syncMeta = {},
}) {
  const issues = Array.isArray(syncIssues) ? syncIssues : [];
  const hasHashIssue = Boolean(integrityWarning) || issues.includes("hash");
  const hasAuthIssue =
    issues.includes("auth") || String(syncMeta?.lastFailureCode || "") === "auth";
  const hasOfflineIssue =
    issues.includes("offline") ||
    String(syncMeta?.lastFailureCode || "") === "offline";
  const hasSyncIssue =
    issues.includes("sync") ||
    issues.includes("network") ||
    String(syncMeta?.lastFailureCode || "") === "sync" ||
    String(syncMeta?.lastFailureCode || "") === "network";

  if (hasHashIssue) {
    return { severity: "soft", reason: "hash_mismatch" };
  }
  if (hasAuthIssue) {
    return { severity: "hard", reason: "auth_expired" };
  }
  if (hasOfflineIssue) {
    return { severity: "soft", reason: "offline" };
  }
  if (hasSyncIssue) {
    return { severity: "soft", reason: "sync" };
  }
  return { severity: "ok", reason: "" };
}

