import { randomUUID } from "node:crypto";

import { analyzeBatch, type AnalyzeBatchOptions, type BatchAnalysisResult } from "../../core/pipeline";
import type { FinancePolicy } from "../../types/policies";
import { authorize } from "../platform/authorization";
import { PlatformError } from "../platform/errors";
import type { PlatformRepository } from "../platform/repository";
import type {
  AuthenticatedPrincipal,
  BatchRecord,
  PlatformAuditEvent,
  ServerBatchBundle,
  SourceFileRecord,
} from "../platform/types";

export interface ServerProcessingResult {
  analysis: BatchAnalysisResult;
  batch: BatchRecord;
}

function toFinancePolicy(
  record: Awaited<ReturnType<PlatformRepository["getActivePolicy"]>>,
  companyName: string,
): FinancePolicy | undefined {
  if (!record || record.state !== "ACTIVE") return undefined;
  return {
    id: record.id,
    companyName,
    policyName: record.name,
    version: String(record.version),
    supportedCurrencies: record.definition.supportedCurrencies,
    expenseLimits: record.definition.expenseLimits,
    purchaseOrderRequiredAbove: record.definition.purchaseOrderRequiredAbove,
    requiredFields: record.definition.requiredFields,
    createdAt: record.createdAt,
    activatedAt: record.effectiveAt ?? record.updatedAt,
    status: "ACTIVE",
  };
}

export class ServerBatchProcessingService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async persistAnalysis(
    principal: AuthenticatedPrincipal | undefined,
    analysis: BatchAnalysisResult,
    sourceFiles: SourceFileRecord[],
    policyVersionId: string,
  ): Promise<BatchRecord> {
    const user = authorize(principal, "READ_FINANCE");
    if (!policyVersionId) throw new PlatformError("VALIDATION_ERROR", "A policy version is required.", 400);
    if (sourceFiles.some(({ organizationId }) => organizationId !== user.organizationId)) {
      throw new PlatformError("FORBIDDEN", "Cross-organization source files are denied.", 403);
    }
    const timestamp = this.now().toISOString();
    const batch: BatchRecord = {
      id: analysis.batchId,
      organizationId: user.organizationId,
      uploadedBy: user.userId,
      uploadedAt: sourceFiles[0]?.uploadedAt ?? analysis.createdAt,
      processedAt: timestamp,
      updatedAt: timestamp,
      status: analysis.fileErrors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      policyVersionId,
      fileCount: sourceFiles.length,
      filesProcessed: analysis.filesProcessed,
      processingErrors: analysis.fileErrors.map(({ fileName, message }) => `${fileName}: ${message}`),
      summary: analysis.batchSummary,
    };
    const auditEvents: PlatformAuditEvent[] = [
      {
        id: randomUUID(), organizationId: user.organizationId, timestamp, actorId: user.userId,
        actorRole: user.role, action: "BATCH_CREATED", batchId: analysis.batchId,
      },
      {
        id: randomUUID(), organizationId: user.organizationId, timestamp, actorId: null,
        actorRole: "SYSTEM", action: "PROCESSING_COMPLETED", batchId: analysis.batchId,
        metadata: { rowsProcessed: analysis.rowsProcessed, filesProcessed: analysis.filesProcessed },
      },
      ...analysis.duplicatePairs.map((match): PlatformAuditEvent => ({
        id: randomUUID(), organizationId: user.organizationId, timestamp, actorId: null,
        actorRole: "SYSTEM", action: "DUPLICATE_DETECTED", batchId: analysis.batchId,
        transactionId: match.currentTransactionId,
        note: `Matched ${match.matchedTransactionId} as ${match.matchType}.`,
      })),
      ...analysis.transactions.map((transaction): PlatformAuditEvent => ({
        id: randomUUID(), organizationId: user.organizationId, timestamp, actorId: null,
        actorRole: "SYSTEM", action: "STATUS_ASSIGNED", batchId: analysis.batchId,
        transactionId: transaction.id, note: analysis.decisions[transaction.id].headline,
      })),
    ];
    const bundle: ServerBatchBundle = {
      batch,
      sourceFiles,
      transactions: analysis.transactions,
      ruleResults: analysis.ruleResults,
      duplicateMatches: analysis.duplicateMatches,
      decisions: analysis.decisions,
      auditEvents,
    };
    await Promise.all([
      this.repository.saveBatchBundle(bundle),
      this.repository.saveNotification({
        id: randomUUID(), organizationId: user.organizationId, userId: user.userId,
        type: "BATCH_COMPLETED", title: "Batch processing completed",
        message: `${analysis.rowsProcessed} transactions were processed.`, createdAt: timestamp, batchId: analysis.batchId,
      }),
    ]);
    return batch;
  }

  async process(
    principal: AuthenticatedPrincipal | undefined,
    files: readonly File[],
    sourceFiles: SourceFileRecord[],
    policyVersionId: string,
    options: AnalyzeBatchOptions = {},
  ): Promise<ServerProcessingResult> {
    const user = authorize(principal, "READ_FINANCE");
    const batchId = sourceFiles[0]?.batchId;
    if (sourceFiles.length === 0 || sourceFiles.some(({ scanStatus }) => scanStatus !== "CLEAN")) {
      throw new PlatformError("VALIDATION_ERROR", "Only files with a verified CLEAN scan result can be processed.", 409);
    }
    const activePolicyRecord = await this.repository.getActivePolicy(user.organizationId);
    if (!activePolicyRecord || activePolicyRecord.id !== policyVersionId) {
      throw new PlatformError(
        "VALIDATION_ERROR",
        "An active company policy is required before processing invoices.",
        409,
      );
    }
    const policy = toFinancePolicy(activePolicyRecord, user.organizationName);
    if (!policy) {
      throw new PlatformError(
        "VALIDATION_ERROR",
        "An active company policy is required before processing invoices.",
        409,
      );
    }
    await this.repository.appendAudit({
      id: randomUUID(), organizationId: user.organizationId, timestamp: this.now().toISOString(),
      actorId: user.userId, actorRole: user.role, action: "PROCESSING_STARTED", batchId,
      metadata: { fileCount: files.length },
    });
    try {
      const analysis = await analyzeBatch(files, { ...options, policy });
      const batch = await this.persistAnalysis(user, analysis, sourceFiles, policyVersionId);
      return { analysis, batch };
    } catch (error) {
      const timestamp = this.now().toISOString();
      await Promise.all([
        this.repository.appendAudit({
          id: randomUUID(), organizationId: user.organizationId, timestamp,
          actorId: null, actorRole: "SYSTEM", action: "PROCESSING_FAILED", batchId,
          note: error instanceof PlatformError ? error.code : "Unexpected processing failure.",
        }),
        this.repository.saveNotification({
          id: randomUUID(), organizationId: user.organizationId, userId: user.userId,
          type: "BATCH_FAILED", title: "Batch processing failed",
          message: "The batch could not be processed. Review the processing status before retrying.",
          createdAt: timestamp, batchId,
        }),
      ]);
      throw error;
    }
  }
}
