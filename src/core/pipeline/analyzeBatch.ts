import { makeDecision } from "../decisions";
import {
  findDuplicates,
  type DuplicateDetectionMetrics,
} from "../duplicates";
import { ingestFiles } from "../ingestion";
import { evaluateRules } from "../rules";
import type { Decision } from "../../types/decisions";
import type { RuleResult } from "../../types/rules";
import { defaultFinancePolicy } from "../../config/defaultPolicy";
import { toPolicySnapshot } from "../../types/policies";
import { associateDuplicateMatches } from "./associations";
import { calculateBatchSummary } from "./summary";
import type { AnalyzeBatchOptions, BatchAnalysisResult } from "./types";

export async function analyzeBatch(
  files: readonly File[],
  options: AnalyzeBatchOptions = {},
): Promise<BatchAnalysisResult> {
  const processingStarted = performance.now();
  options.onProgress?.({ stage: "READING_FILES" });
  const ingestion = await ingestFiles(files);
  const ingestionMs = performance.now() - processingStarted;
  options.onProgress?.({
    stage: "NORMALIZING",
    processed: ingestion.transactions.length,
    total: ingestion.transactions.length,
  });
  const now = options.now ?? (() => new Date());
  const policy = options.policy ?? defaultFinancePolicy;
  const createdAt = ingestion.transactions[0]?.createdAt ?? now().toISOString();
  const ruleResults: Record<string, RuleResult[]> = {};

  options.onProgress?.({
    stage: "EVALUATING_RULES",
    processed: 0,
    total: ingestion.transactions.length,
  });
  const rulesStarted = performance.now();
  for (const transaction of ingestion.transactions) {
    ruleResults[transaction.id] = evaluateRules(transaction, {
      referenceDate: options.referenceDate,
      policy,
    });
  }
  const rulesMs = performance.now() - rulesStarted;

  const duplicateDetection: DuplicateDetectionMetrics = {
    totalTransactions: 0,
    candidatePairs: 0,
    evaluatedPairs: 0,
    fuzzyComparisons: 0,
  };
  options.onProgress?.({ stage: "CHECKING_DUPLICATES" });
  const duplicateStarted = performance.now();
  const duplicatePairs = findDuplicates(
    ingestion.transactions,
    duplicateDetection,
  );
  const duplicateMs = performance.now() - duplicateStarted;
  const duplicateMatches = associateDuplicateMatches(
    ingestion.transactions,
    duplicatePairs,
  );
  const decisions: Record<string, Decision> = {};

  options.onProgress?.({
    stage: "MAKING_DECISIONS",
    processed: 0,
    total: ingestion.transactions.length,
  });
  const decisionsStarted = performance.now();
  for (const transaction of ingestion.transactions) {
    decisions[transaction.id] = makeDecision(
      ruleResults[transaction.id],
      duplicateMatches[transaction.id],
    );
  }
  const decisionsMs = performance.now() - decisionsStarted;
  const batchSummary = calculateBatchSummary(
    ingestion.transactions,
    decisions,
    duplicateMatches,
  );

  return {
    batchId: ingestion.batchId,
    createdAt,
    transactions: ingestion.transactions,
    ruleResults,
    duplicatePairs,
    duplicateMatches,
    decisions,
    batchSummary,
    policySnapshot: toPolicySnapshot(policy),
    fileErrors: ingestion.fileErrors,
    filesProcessed: ingestion.filesProcessed,
    rowsProcessed: ingestion.rowsProcessed,
    processingMetrics: {
      ingestionMs,
      rulesMs,
      duplicateMs,
      decisionsMs,
      serializationMs: 0,
      persistenceMs: 0,
      serializedStateBytes: 0,
      duplicateDetection,
    },
  };
}
