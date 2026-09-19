import type { BatchSummary, Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { Transaction } from "../../types/transaction";

export function calculateBatchSummary(
  transactions: readonly Transaction[],
  decisions: Readonly<Record<string, Decision>>,
  duplicateMatches: Readonly<Record<string, DuplicateMatch[]>>,
): BatchSummary {
  let autoPassed = 0;
  let needsReview = 0;
  let highRisk = 0;
  let potentialExposure = 0;

  for (const transaction of transactions) {
    const status = decisions[transaction.id]?.status;
    if (status === "AUTO_PASS") autoPassed += 1;
    if (status === "REVIEW") needsReview += 1;
    if (status === "HIGH_RISK") {
      highRisk += 1;
      const amount = transaction.amount;
      const currency = transaction.currency?.trim().toUpperCase();
      if (
        typeof amount === "number" &&
        Number.isFinite(amount) &&
        amount > 0 &&
        currency === "INR"
      ) {
        potentialExposure += amount;
      }
    }
  }

  return {
    totalProcessed: transactions.length,
    autoPassed,
    needsReview,
    highRisk,
    duplicateCandidates: transactions.filter(
      ({ id }) => (duplicateMatches[id]?.length ?? 0) > 0,
    ).length,
    potentialExposure,
  };
}
