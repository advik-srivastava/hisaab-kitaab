import {
  appendAuditEventsAsync,
  type AppendAuditEventInput,
} from "../audit";
import { makeDecision } from "../decisions";
import {
  findDuplicates,
  type DuplicateDetectionMetrics,
} from "../duplicates";
import { ingestFiles } from "../ingestion";
import { evaluateRules } from "../rules";
import { saveAnalyzedBatchAsync } from "../../lib/storage";
import type { Decision } from "../../types/decisions";
import type { RuleResult } from "../../types/rules";
import { associateDuplicateMatches } from "./associations";
import { calculateBatchSummary } from "./summary";
import type { ProcessBatchOptions, ProcessBatchResult } from "./types";

export async function processBatch(
  files: readonly File[],
  options: ProcessBatchOptions = {},
): Promise<ProcessBatchResult> {
  const processingStarted = performance.now();
  const ingestion = await ingestFiles(files);
  const ingestionMs = performance.now() - processingStarted;
  const now = options.now ?? (() => new Date());
  const createdAt = ingestion.transactions[0]?.createdAt ?? now().toISOString();
  const ruleResults: Record<string, RuleResult[]> = {};

  const rulesStarted = performance.now();
  for (const transaction of ingestion.transactions) {
    ruleResults[transaction.id] = evaluateRules(transaction, {
      referenceDate: options.referenceDate,
    });
  }
  const rulesMs = performance.now() - rulesStarted;

  const duplicateDetection: DuplicateDetectionMetrics = {
    totalTransactions: 0,
    candidatePairs: 0,
    evaluatedPairs: 0,
    fuzzyComparisons: 0,
  };
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

  const initialSave = await saveAnalyzedBatchAsync(
    {
      batchId: ingestion.batchId,
      createdAt,
      batchSummary,
      transactions: ingestion.transactions,
      ruleResults,
      duplicateMatches,
      decisions,
    },
    options.persistence ?? options.storage,
  );

  const auditInputs: AppendAuditEventInput[] = [
    {
      transactionId: ingestion.batchId,
      batchId: ingestion.batchId,
      actorType: "SYSTEM",
      action: "BATCH_PROCESSED",
      note: `Processed ${ingestion.transactions.length} transactions from ${ingestion.filesProcessed} files.`,
    },
  ];

  for (const match of duplicatePairs) {
    auditInputs.push({
        transactionId: match.currentTransactionId,
        batchId: ingestion.batchId,
        actorType: "SYSTEM",
        action: "DUPLICATE_DETECTED",
        note: `Matched ${match.matchedTransactionId} as ${match.matchType}. ${match.evidence.join(" ")}`,
      });
  }

  for (const transaction of ingestion.transactions) {
    const decision = decisions[transaction.id];
    auditInputs.push({
        transactionId: transaction.id,
        batchId: ingestion.batchId,
        actorType: "SYSTEM",
        action: "STATUS_ASSIGNED",
        newStatus: decision.status,
        note: decision.headline,
      });
  }

  const auditResult = initialSave.persistence.success
    ? await appendAuditEventsAsync(auditInputs, {
        storage: options.storage,
        persistence: options.persistence,
        now,
      })
    : undefined;
  const persistence = auditResult
    ? {
        ...auditResult.persistence,
        serializedBytes: initialSave.persistence.serializedBytes + auditResult.persistence.serializedBytes,
        serializationMs: initialSave.persistence.serializationMs + auditResult.persistence.serializationMs,
        writeMs: initialSave.persistence.writeMs + auditResult.persistence.writeMs,
      }
    : initialSave.persistence;
  const auditEvents = auditResult?.events ?? [];
  const serializationMs = persistence.serializationMs;
  const persistenceMs = serializationMs + persistence.writeMs;

  return {
    batchId: ingestion.batchId,
    createdAt,
    transactions: ingestion.transactions,
    ruleResults,
    duplicateMatches,
    decisions,
    batchSummary,
    auditEvents,
    fileErrors: ingestion.fileErrors,
    filesProcessed: ingestion.filesProcessed,
    rowsProcessed: ingestion.rowsProcessed,
    processingMetrics: {
      ingestionMs,
      rulesMs,
      duplicateMs,
      decisionsMs,
      serializationMs,
      persistenceMs,
      serializedStateBytes: persistence.serializedBytes,
      duplicateDetection,
    },
    persistence,
  };
}
