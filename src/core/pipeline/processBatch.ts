import { appendAuditEvent } from "../audit";
import { makeDecision } from "../decisions";
import { findDuplicates } from "../duplicates";
import { ingestFiles } from "../ingestion";
import { evaluateRules } from "../rules";
import { saveAnalyzedBatch } from "../../lib/storage";
import type { AuditEvent } from "../../types/audit";
import type { Decision } from "../../types/decisions";
import type { RuleResult } from "../../types/rules";
import { associateDuplicateMatches } from "./associations";
import { calculateBatchSummary } from "./summary";
import type { ProcessBatchOptions, ProcessBatchResult } from "./types";

export async function processBatch(
  files: readonly File[],
  options: ProcessBatchOptions = {},
): Promise<ProcessBatchResult> {
  const ingestion = await ingestFiles(files);
  const now = options.now ?? (() => new Date());
  const createdAt = ingestion.transactions[0]?.createdAt ?? now().toISOString();
  const ruleResults: Record<string, RuleResult[]> = {};

  for (const transaction of ingestion.transactions) {
    ruleResults[transaction.id] = evaluateRules(transaction, {
      referenceDate: options.referenceDate,
    });
  }

  const duplicatePairs = findDuplicates(ingestion.transactions);
  const duplicateMatches = associateDuplicateMatches(
    ingestion.transactions,
    duplicatePairs,
  );
  const decisions: Record<string, Decision> = {};

  for (const transaction of ingestion.transactions) {
    decisions[transaction.id] = makeDecision(
      ruleResults[transaction.id],
      duplicateMatches[transaction.id],
    );
  }

  const batchSummary = calculateBatchSummary(
    ingestion.transactions,
    decisions,
    duplicateMatches,
  );

  saveAnalyzedBatch(
    {
      batchId: ingestion.batchId,
      createdAt,
      batchSummary,
      transactions: ingestion.transactions,
      ruleResults,
      duplicateMatches,
      decisions,
    },
    options.storage,
  );

  const auditOptions = { storage: options.storage, now };
  const auditEvents: AuditEvent[] = [];
  const batchEvent = appendAuditEvent(
    {
      transactionId: ingestion.batchId,
      batchId: ingestion.batchId,
      actorType: "SYSTEM",
      action: "BATCH_PROCESSED",
      note: `Processed ${ingestion.transactions.length} transactions from ${ingestion.filesProcessed} files.`,
    },
    auditOptions,
  );
  if (batchEvent) auditEvents.push(batchEvent);

  for (const match of duplicatePairs) {
    const event = appendAuditEvent(
      {
        transactionId: match.currentTransactionId,
        batchId: ingestion.batchId,
        actorType: "SYSTEM",
        action: "DUPLICATE_DETECTED",
        note: `Matched ${match.matchedTransactionId} as ${match.matchType}. ${match.evidence.join(" ")}`,
      },
      auditOptions,
    );
    if (event) auditEvents.push(event);
  }

  for (const transaction of ingestion.transactions) {
    const decision = decisions[transaction.id];
    const event = appendAuditEvent(
      {
        transactionId: transaction.id,
        batchId: ingestion.batchId,
        actorType: "SYSTEM",
        action: "STATUS_ASSIGNED",
        newStatus: decision.status,
        note: decision.headline,
      },
      auditOptions,
    );
    if (event) auditEvents.push(event);
  }

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
  };
}
