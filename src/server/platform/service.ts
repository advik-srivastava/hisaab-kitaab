import { randomUUID } from "node:crypto";

import { authorize, canReviewAssignedException } from "./authorization";
import { PlatformError } from "./errors";
import type { PlatformRepository } from "./repository";
import type {
  AgingSummary,
  AssignmentRecord,
  AuthenticatedPrincipal,
  BatchHistoryItem,
  ExceptionPage,
  ExceptionQuery,
  NotificationRecord,
  PlatformAuditAction,
  PlatformAuditEvent,
  PolicyDefinition,
  PolicySetRecord,
  ReviewAction,
  ReviewRecord,
  SavedFilterRecord,
  ServerExceptionItem,
  ServerExceptionDetail,
  TrendPoint,
} from "./types";

export interface BulkOperationItem {
  transactionId: string;
  expectedVersion: number;
}

export interface BulkOperationResult {
  succeeded: string[];
  failed: Array<{ transactionId: string; code: string; message: string }>;
}

function auditEvent(
  principal: AuthenticatedPrincipal,
  action: PlatformAuditAction,
  now: Date,
  values: Pick<PlatformAuditEvent, "batchId" | "transactionId" | "note" | "metadata"> = {},
): PlatformAuditEvent {
  return {
    id: randomUUID(),
    organizationId: principal.organizationId,
    timestamp: now.toISOString(),
    actorId: principal.userId,
    actorRole: principal.role,
    action,
    ...values,
  };
}

function notification(
  userId: string,
  organizationId: string,
  type: NotificationRecord["type"],
  title: string,
  message: string,
  now: Date,
  values: Pick<NotificationRecord, "batchId" | "transactionId"> = {},
): NotificationRecord {
  return {
    id: randomUUID(),
    organizationId,
    userId,
    type,
    title,
    message,
    createdAt: now.toISOString(),
    ...values,
  };
}

function validatePolicy(definition: PolicyDefinition): void {
  if (
    !definition
    || !Array.isArray(definition.supportedCurrencies)
    || !definition.expenseLimits
    || !Array.isArray(definition.requiredFields)
    || !definition.requiredFields.every((field) => ["vendorName", "invoiceNumber", "invoiceDate", "amount", "currency"].includes(field))
  ) {
    throw new PlatformError("VALIDATION_ERROR", "The policy definition is invalid.", 400);
  }
  if (definition.supportedCurrencies.length === 0 || definition.supportedCurrencies.some((currency) => typeof currency !== "string" || !currency.trim())) {
    throw new PlatformError("VALIDATION_ERROR", "At least one supported currency is required.", 400);
  }
  const thresholds = [
    definition.expenseLimits.Meals,
    definition.expenseLimits.Taxi,
    definition.expenseLimits.Hotel,
    definition.purchaseOrderRequiredAbove,
  ];
  if (thresholds.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new PlatformError("VALIDATION_ERROR", "Policy thresholds must be non-negative numbers.", 400);
  }
}

export class PlatformService {
  constructor(
    private readonly repository: PlatformRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  queryExceptions(principal: AuthenticatedPrincipal | undefined, query: ExceptionQuery): Promise<ExceptionPage> {
    const user = authorize(principal, "READ_FINANCE");
    return this.repository.queryExceptions(user.organizationId, query);
  }

  queryMyQueue(principal: AuthenticatedPrincipal | undefined, query: ExceptionQuery = {}): Promise<ExceptionPage> {
    const user = authorize(principal, "READ_FINANCE");
    return this.repository.queryExceptions(user.organizationId, {
      ...query,
      assignedReviewerId: user.userId,
      reviewStatus: query.reviewStatus ?? "UNREVIEWED",
    });
  }

  async getException(principal: AuthenticatedPrincipal | undefined, transactionId: string): Promise<ServerExceptionItem> {
    const user = authorize(principal, "READ_FINANCE");
    const item = await this.repository.getException(user.organizationId, transactionId);
    if (!item) throw new PlatformError("NOT_FOUND", "Exception was not found.", 404);
    return item;
  }

  async getExceptionDetail(principal: AuthenticatedPrincipal | undefined, transactionId: string): Promise<ServerExceptionDetail> {
    const user = authorize(principal, "READ_FINANCE");
    const item = await this.getException(user, transactionId);
    const matchedId = item.duplicateMatches[0]?.matchedTransactionId;
    const [matched, auditEvents] = await Promise.all([
      matchedId ? this.repository.getException(user.organizationId, matchedId) : undefined,
      this.repository.listAudit(user.organizationId, { transactionId }),
    ]);
    return { ...item, matchedTransaction: matched?.transaction, auditEvents };
  }

  async reviewException(
    principal: AuthenticatedPrincipal | undefined,
    input: { transactionId: string; action: ReviewAction; note?: string; expectedVersion: number },
  ): Promise<ServerExceptionItem> {
    const user = authorize(principal, "REVIEW_EXCEPTION");
    const current = await this.getException(user, input.transactionId);
    if (!canReviewAssignedException(user, current.assignment?.reviewerId)) {
      throw new PlatformError("FORBIDDEN", "This exception is not assigned to you.", 403);
    }
    if (input.action === "MARK_NOT_DUPLICATE" && current.duplicateMatches.length === 0) {
      throw new PlatformError("VALIDATION_ERROR", "Only duplicate candidates can be marked not duplicate.", 400);
    }
    const reviewedAt = this.now();
    const record: ReviewRecord = {
      transactionId: input.transactionId,
      organizationId: user.organizationId,
      action: input.action,
      reviewerId: user.userId,
      reviewerName: user.displayName,
      note: input.note?.trim() || null,
      reviewedAt: reviewedAt.toISOString(),
      version: input.expectedVersion + 1,
    };
    const saved = await this.repository.saveReview(record, input.expectedVersion);
    await this.repository.appendAudit(auditEvent(user, input.action, reviewedAt, {
      transactionId: input.transactionId,
      batchId: current.transaction.batchId,
      note: record.note ?? undefined,
      metadata: { version: saved.version },
    }));
    return saved;
  }

  async bulkReview(
    principal: AuthenticatedPrincipal | undefined,
    input: { items: BulkOperationItem[]; action: ReviewAction; note?: string },
  ): Promise<BulkOperationResult> {
    authorize(principal, "REVIEW_EXCEPTION");
    const result: BulkOperationResult = { succeeded: [], failed: [] };
    for (const item of input.items) {
      try {
        await this.reviewException(principal, { ...item, action: input.action, note: input.note });
        result.succeeded.push(item.transactionId);
      } catch (error) {
        const platformError = error instanceof PlatformError ? error : new PlatformError("STORAGE_ERROR", "Review could not be saved.", 500);
        result.failed.push({ transactionId: item.transactionId, code: platformError.code, message: platformError.message });
      }
    }
    return result;
  }

  async assignException(
    principal: AuthenticatedPrincipal | undefined,
    input: { transactionId: string; reviewerId: string; expectedVersion: number },
  ): Promise<ServerExceptionItem> {
    const manager = authorize(principal, "ASSIGN_REVIEWER");
    const [current, reviewer] = await Promise.all([
      this.getException(manager, input.transactionId),
      this.repository.getUser(manager.organizationId, input.reviewerId),
    ]);
    if (!reviewer || !reviewer.active || !["REVIEWER", "FINANCE_MANAGER", "ADMIN"].includes(reviewer.role)) {
      throw new PlatformError("VALIDATION_ERROR", "The selected reviewer is not available in this organization.", 400);
    }
    const assignedAt = this.now();
    const assignment: AssignmentRecord = {
      transactionId: input.transactionId,
      organizationId: manager.organizationId,
      reviewerId: reviewer.id,
      assignedBy: manager.userId,
      assignedAt: assignedAt.toISOString(),
      version: input.expectedVersion + 1,
    };
    const saved = await this.repository.saveAssignment(assignment, input.expectedVersion);
    const action = current.assignment ? "REVIEWER_REASSIGNED" : "REVIEWER_ASSIGNED";
    await Promise.all([
      this.repository.appendAudit(auditEvent(manager, action, assignedAt, {
        transactionId: input.transactionId,
        batchId: current.transaction.batchId,
        note: `Assigned to ${reviewer.displayName}.`,
        metadata: { reviewerId: reviewer.id, version: saved.version },
      })),
      this.repository.saveNotification(notification(
        reviewer.id,
        manager.organizationId,
        current.assignment ? "EXCEPTION_REASSIGNED" : current.decision.status === "HIGH_RISK" ? "HIGH_RISK_ASSIGNED" : "EXCEPTION_ASSIGNED",
        current.decision.status === "HIGH_RISK" ? "High-risk exception assigned" : "Exception assigned",
        `${current.transaction.invoiceNumber ?? current.transaction.id} was assigned to you.`,
        assignedAt,
        { transactionId: input.transactionId, batchId: current.transaction.batchId },
      )),
    ]);
    return saved;
  }

  async bulkAssign(
    principal: AuthenticatedPrincipal | undefined,
    input: { items: BulkOperationItem[]; reviewerId: string },
  ): Promise<BulkOperationResult> {
    authorize(principal, "ASSIGN_REVIEWER");
    const result: BulkOperationResult = { succeeded: [], failed: [] };
    for (const item of input.items) {
      try {
        await this.assignException(principal, { ...item, reviewerId: input.reviewerId });
        result.succeeded.push(item.transactionId);
      } catch (error) {
        const platformError = error instanceof PlatformError ? error : new PlatformError("STORAGE_ERROR", "Assignment could not be saved.", 500);
        result.failed.push({ transactionId: item.transactionId, code: platformError.code, message: platformError.message });
      }
    }
    return result;
  }

  async saveFilter(
    principal: AuthenticatedPrincipal | undefined,
    input: { id?: string; name: string; query: ExceptionQuery },
  ): Promise<SavedFilterRecord> {
    const user = authorize(principal, "READ_FINANCE");
    if (!input.name.trim()) throw new PlatformError("VALIDATION_ERROR", "A saved-filter name is required.", 400);
    const timestamp = this.now().toISOString();
    const filter: SavedFilterRecord = {
      id: input.id ?? randomUUID(),
      organizationId: user.organizationId,
      userId: user.userId,
      name: input.name.trim(),
      query: input.query,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repository.saveFilter(filter);
    return filter;
  }

  listFilters(principal: AuthenticatedPrincipal | undefined): Promise<SavedFilterRecord[]> {
    const user = authorize(principal, "READ_FINANCE");
    return this.repository.listFilters(user.organizationId, user.userId);
  }

  async savePolicy(
    principal: AuthenticatedPrincipal | undefined,
    input: { name: string; state: PolicySetRecord["state"]; definition: PolicyDefinition },
  ): Promise<PolicySetRecord> {
    const admin = authorize(principal, "MANAGE_POLICY");
    validatePolicy(input.definition);
    const existing = await this.repository.listPolicies(admin.organizationId);
    const now = this.now();
    const policy: PolicySetRecord = {
      id: randomUUID(),
      organizationId: admin.organizationId,
      version: Math.max(0, ...existing.map(({ version }) => version)) + 1,
      name: input.name.trim() || `Policy v${existing.length + 1}`,
      state: input.state,
      effectiveAt: input.state === "ACTIVE" ? now.toISOString() : undefined,
      definition: input.definition,
      createdBy: admin.userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await Promise.all([
      this.repository.savePolicy(policy),
      this.repository.appendAudit(auditEvent(admin, "POLICY_CHANGED", now, {
        note: `${policy.name} saved as ${policy.state}.`,
        metadata: { policyId: policy.id, version: policy.version },
      })),
    ]);
    return policy;
  }

  listPolicies(principal: AuthenticatedPrincipal | undefined): Promise<PolicySetRecord[]> {
    const user = authorize(principal, "READ_FINANCE");
    return this.repository.listPolicies(user.organizationId);
  }

  listBatches(principal: AuthenticatedPrincipal | undefined): Promise<BatchHistoryItem[]> {
    const user = authorize(principal, "READ_FINANCE");
    return this.repository.listBatches(user.organizationId);
  }

  listNotifications(principal: AuthenticatedPrincipal | undefined): Promise<NotificationRecord[]> {
    const user = authorize(principal, "READ_FINANCE");
    return this.repository.listNotifications(user.organizationId, user.userId);
  }

  async trends(principal: AuthenticatedPrincipal | undefined): Promise<TrendPoint[]> {
    const user = authorize(principal, "READ_FINANCE");
    const batches = await this.repository.listBatches(user.organizationId);
    return batches.filter(({ processedAt }) => processedAt).map((batch) => ({
      batchId: batch.id,
      processedAt: batch.processedAt!,
      transactionsProcessed: batch.summary.totalProcessed,
      autoClearRate: batch.summary.totalProcessed === 0 ? 0 : batch.summary.autoPassed / batch.summary.totalProcessed,
      reviewVolume: batch.summary.needsReview,
      highRiskVolume: batch.summary.highRisk,
      duplicateCandidates: batch.summary.duplicateCandidates,
      potentialExposure: batch.summary.potentialExposure,
    }));
  }

  async aging(principal: AuthenticatedPrincipal | undefined): Promise<AgingSummary> {
    const user = authorize(principal, "READ_FINANCE");
    const unresolved = await this.collectExceptions(user.organizationId, { reviewStatus: "UNREVIEWED" });
    const now = this.now().getTime();
    const ages = unresolved.map((item) => ({
      item,
      days: Math.max(0, Math.floor((now - new Date(item.transaction.createdAt).getTime()) / 86_400_000)),
    }));
    const buckets: AgingSummary["buckets"] = {
      LT_1_DAY: 0,
      ONE_TO_THREE_DAYS: 0,
      FOUR_TO_SEVEN_DAYS: 0,
      SEVEN_PLUS_DAYS: 0,
    };
    for (const { days } of ages) {
      if (days < 1) buckets.LT_1_DAY += 1;
      else if (days <= 3) buckets.ONE_TO_THREE_DAYS += 1;
      else if (days <= 7) buckets.FOUR_TO_SEVEN_DAYS += 1;
      else buckets.SEVEN_PLUS_DAYS += 1;
    }
    const oldest = ages.sort((a, b) => b.days - a.days)[0];
    return {
      buckets,
      oldestUnresolved: oldest ? {
        transactionId: oldest.item.transaction.id,
        ageDays: oldest.days,
        assignedReviewerId: oldest.item.assignment?.reviewerId,
        status: oldest.item.decision.status,
      } : undefined,
    };
  }

  async collectExceptions(organizationId: string, query: ExceptionQuery): Promise<ServerExceptionItem[]> {
    const items: ServerExceptionItem[] = [];
    let page = 1;
    do {
      const result = await this.repository.queryExceptions(organizationId, { ...query, page, pageSize: 200 });
      items.push(...result.items);
      if (page >= result.totalPages) break;
      page += 1;
    } while (true);
    return items;
  }
}
