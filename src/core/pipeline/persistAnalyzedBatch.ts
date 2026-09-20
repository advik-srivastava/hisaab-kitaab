import {
  appendAuditEventsAsync,
  type AppendAuditEventInput,
} from "../audit";
import { saveAnalyzedBatchAsync } from "../../lib/storage";
import type {
  BatchAnalysisResult,
  ProcessBatchOptions,
  ProcessBatchResult,
} from "./types";

export async function persistAnalyzedBatch(
  analysis: BatchAnalysisResult,
  options: ProcessBatchOptions = {},
): Promise<ProcessBatchResult> {
  const now = options.now ?? (() => new Date());
  const initialSave = await saveAnalyzedBatchAsync(
    {
      batchId: analysis.batchId,
      createdAt: analysis.createdAt,
      batchSummary: analysis.batchSummary,
      transactions: analysis.transactions,
      ruleResults: analysis.ruleResults,
      duplicateMatches: analysis.duplicateMatches,
      decisions: analysis.decisions,
    },
    options.persistence ?? options.storage,
  );

  const auditInputs: AppendAuditEventInput[] = [
    {
      transactionId: analysis.batchId,
      batchId: analysis.batchId,
      actorType: "SYSTEM",
      action: "BATCH_PROCESSED",
      note: `Processed ${analysis.transactions.length} transactions from ${analysis.filesProcessed} files.`,
    },
  ];
  for (const match of analysis.duplicatePairs) {
    auditInputs.push({
      transactionId: match.currentTransactionId,
      batchId: analysis.batchId,
      actorType: "SYSTEM",
      action: "DUPLICATE_DETECTED",
      note: `Matched ${match.matchedTransactionId} as ${match.matchType}. ${match.evidence.join(" ")}`,
    });
  }
  for (const transaction of analysis.transactions) {
    const decision = analysis.decisions[transaction.id];
    auditInputs.push({
      transactionId: transaction.id,
      batchId: analysis.batchId,
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
  const serializationMs = persistence.serializationMs;

  return {
    batchId: analysis.batchId,
    createdAt: analysis.createdAt,
    transactions: analysis.transactions,
    ruleResults: analysis.ruleResults,
    duplicateMatches: analysis.duplicateMatches,
    decisions: analysis.decisions,
    batchSummary: analysis.batchSummary,
    auditEvents: auditResult?.events ?? [],
    fileErrors: analysis.fileErrors,
    filesProcessed: analysis.filesProcessed,
    rowsProcessed: analysis.rowsProcessed,
    processingMetrics: {
      ...analysis.processingMetrics,
      serializationMs,
      persistenceMs: serializationMs + persistence.writeMs,
      serializedStateBytes: persistence.serializedBytes,
    },
    persistence,
  };
}
