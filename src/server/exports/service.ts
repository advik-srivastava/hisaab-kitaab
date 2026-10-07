import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";

import { authorize } from "../platform/authorization";
import { PlatformError } from "../platform/errors";
import type { PlatformRepository } from "../platform/repository";
import type { PlatformService } from "../platform/service";
import type { AuthenticatedPrincipal, ExceptionQuery, ServerExceptionItem } from "../platform/types";

export interface GeneratedExport {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exceptionRows(items: readonly ServerExceptionItem[]) {
  return items.map(({ transaction, decision, failedRules, duplicateMatches, assignment, review }) => ({
    transactionId: transaction.id,
    invoiceNumber: transaction.invoiceNumber ?? "",
    vendor: transaction.vendorName ?? "",
    amount: transaction.amount ?? "",
    currency: transaction.currency ?? "",
    decisionStatus: decision.status,
    primaryIssue: decision.headline,
    failedRules: failedRules.map(({ ruleName }) => ruleName).join("; "),
    duplicateType: duplicateMatches[0]?.matchType ?? "",
    matchedTransaction: duplicateMatches[0]?.matchedTransactionId ?? "",
    reviewer: assignment?.reviewerId ?? "",
    reviewAction: review?.action ?? "",
    sourceFile: transaction.sourceFile,
    sourceSheet: transaction.sourceSheet ?? "",
    sourceRow: transaction.sourceRow,
    createdAt: transaction.createdAt,
    updatedAt: review?.reviewedAt ?? assignment?.assignedAt ?? transaction.createdAt,
  }));
}

function rowsToCsv(rows: Array<Record<string, unknown>>): Uint8Array {
  if (rows.length === 0) return new TextEncoder().encode("");
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))];
  return new TextEncoder().encode(lines.join("\r\n"));
}

export class ExportService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly platform: PlatformService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async exceptions(
    principal: AuthenticatedPrincipal | undefined,
    query: ExceptionQuery,
    format: "csv" | "xlsx",
  ): Promise<GeneratedExport> {
    const user = authorize(principal, "EXPORT_EXCEPTIONS");
    const items = await this.platform.collectExceptions(user.organizationId, query);
    const rows = exceptionRows(items);
    const timestamp = this.now();
    const exportRecord = {
      id: randomUUID(),
      organizationId: user.organizationId,
      requestedBy: user.userId,
      kind: format === "csv" ? "EXCEPTIONS_CSV" as const : "EXCEPTIONS_XLSX" as const,
      createdAt: timestamp.toISOString(),
      query,
    };
    await Promise.all([
      this.repository.saveExport(exportRecord),
      this.repository.appendAudit({
        id: randomUUID(), organizationId: user.organizationId, timestamp: timestamp.toISOString(), actorId: user.userId,
        actorRole: user.role, action: "EXPORT_CREATED", note: exportRecord.kind, metadata: { exportId: exportRecord.id, rowCount: rows.length },
      }),
    ]);
    if (format === "csv") {
      return { filename: `exceptions-${timestamp.toISOString().slice(0, 10)}.csv`, contentType: "text/csv; charset=utf-8", bytes: rowsToCsv(rows) };
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Exceptions");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    return { filename: `exceptions-${timestamp.toISOString().slice(0, 10)}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes };
  }

  async audit(principal: AuthenticatedPrincipal | undefined, batchId?: string): Promise<GeneratedExport> {
    const user = authorize(principal, "EXPORT_AUDIT");
    const events = await this.repository.listAudit(user.organizationId, { batchId });
    const rows = events.map((event) => ({
      timestamp: event.timestamp,
      actor: event.actorId ?? "SYSTEM",
      actorRole: event.actorRole,
      action: event.action,
      batch: event.batchId ?? "",
      transaction: event.transactionId ?? "",
      note: event.note ?? "",
      metadata: event.metadata ? JSON.stringify(event.metadata) : "",
    }));
    const now = this.now();
    const exportId = randomUUID();
    await Promise.all([
      this.repository.saveExport({ id: exportId, organizationId: user.organizationId, requestedBy: user.userId, kind: "AUDIT_CSV", createdAt: now.toISOString(), batchId }),
      this.repository.appendAudit({
        id: randomUUID(), organizationId: user.organizationId, timestamp: now.toISOString(), actorId: user.userId,
        actorRole: user.role, action: "EXPORT_CREATED", batchId, note: "AUDIT_CSV", metadata: { exportId, rowCount: rows.length },
      }),
    ]);
    return { filename: `audit-${now.toISOString().slice(0, 10)}.csv`, contentType: "text/csv; charset=utf-8", bytes: rowsToCsv(rows) };
  }

  async batchReport(principal: AuthenticatedPrincipal | undefined, batchId: string): Promise<GeneratedExport> {
    const user = authorize(principal, "EXPORT_EXCEPTIONS");
    const [batch, files, exceptions, audit] = await Promise.all([
      this.repository.getBatch(user.organizationId, batchId),
      this.repository.getSourceFiles(user.organizationId, batchId),
      this.platform.collectExceptions(user.organizationId, { batchId }),
      this.repository.listAudit(user.organizationId, { batchId }),
    ]);
    if (!batch) throw new PlatformError("NOT_FOUND", "Batch was not found.", 404);
    const now = this.now();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      batchId: batch.id,
      uploadedBy: batch.uploadedBy,
      uploadedAt: batch.uploadedAt,
      processedAt: batch.processedAt ?? "",
      status: batch.status,
      files: files.map(({ originalFilename }) => originalFilename).join("; "),
      filesProcessed: batch.filesProcessed,
      totalRecords: batch.summary.totalProcessed,
      autoPass: batch.summary.autoPassed,
      review: batch.summary.needsReview,
      highRisk: batch.summary.highRisk,
      duplicateCandidates: batch.summary.duplicateCandidates,
      potentialExposure: batch.summary.potentialExposure,
      reviewed: exceptions.filter(({ review }) => review).length,
      remaining: exceptions.filter(({ review }) => !review).length,
      processingErrors: batch.processingErrors.join("; "),
      policyVersion: batch.policyVersionId,
      reportGeneratedAt: now.toISOString(),
    }]), "Batch Summary");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exceptionRows(exceptions)), "Exceptions");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(audit), "Audit");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const exportId = randomUUID();
    await Promise.all([
      this.repository.saveExport({ id: exportId, organizationId: user.organizationId, requestedBy: user.userId, kind: "BATCH_REPORT", createdAt: now.toISOString(), batchId }),
      this.repository.appendAudit({
        id: randomUUID(), organizationId: user.organizationId, timestamp: now.toISOString(), actorId: user.userId,
        actorRole: user.role, action: "EXPORT_CREATED", batchId, note: "BATCH_REPORT", metadata: { exportId },
      }),
    ]);
    return { filename: `batch-${batch.id}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes };
  }
}
