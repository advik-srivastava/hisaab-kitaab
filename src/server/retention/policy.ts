import type { RetentionPolicy } from "../platform/types";

export interface RetentionCandidate {
  id: string;
  kind: "uploadedFile" | "transactionData" | "auditEvent" | "report";
  createdAt: string;
}

export function retentionCutoffs(policy: RetentionPolicy, now = new Date()): Record<RetentionCandidate["kind"], Date> {
  const cutoff = (days: number) => new Date(now.getTime() - days * 86_400_000);
  return {
    uploadedFile: cutoff(policy.uploadedFilesDays),
    transactionData: cutoff(policy.transactionDataDays),
    auditEvent: cutoff(policy.auditEventsDays),
    report: cutoff(policy.reportsDays),
  };
}

export function expiredRetentionCandidates(
  candidates: readonly RetentionCandidate[],
  policy: RetentionPolicy,
  now = new Date(),
): RetentionCandidate[] {
  const cutoffs = retentionCutoffs(policy, now);
  return candidates.filter((candidate) => new Date(candidate.createdAt) < cutoffs[candidate.kind]);
}
