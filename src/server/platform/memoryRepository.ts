import { PlatformError } from "./errors";
import { queryExceptionItems } from "./query";
import type { PlatformRepository } from "./repository";
import type {
  AssignmentRecord,
  BatchHistoryItem,
  BatchRecord,
  ExceptionPage,
  ExceptionQuery,
  ExportRecord,
  NotificationRecord,
  OrganizationRecord,
  PlatformAuditEvent,
  PolicySetRecord,
  ReviewProgress,
  ReviewRecord,
  SavedFilterRecord,
  ServerBatchBundle,
  ServerExceptionItem,
  SourceFileRecord,
  UserRecord,
} from "./types";

const key = (organizationId: string, id: string) => `${organizationId}:${id}`;

export class MemoryPlatformRepository implements PlatformRepository {
  private readonly organizations = new Map<string, OrganizationRecord>();
  private readonly users = new Map<string, UserRecord>();
  private readonly batches = new Map<string, BatchRecord>();
  private readonly sourceFiles = new Map<string, SourceFileRecord>();
  private readonly exceptions = new Map<string, ServerExceptionItem>();
  private readonly assignments = new Map<string, AssignmentRecord>();
  private readonly reviews = new Map<string, ReviewRecord>();
  private readonly audits: PlatformAuditEvent[] = [];
  private readonly filters = new Map<string, SavedFilterRecord>();
  private readonly policies = new Map<string, PolicySetRecord>();
  private readonly notifications = new Map<string, NotificationRecord>();
  private readonly exports = new Map<string, ExportRecord>();

  async putOrganization(organization: OrganizationRecord): Promise<void> {
    this.organizations.set(organization.id, structuredClone(organization));
  }

  async putUser(user: UserRecord): Promise<void> {
    this.users.set(key(user.organizationId, user.id), structuredClone(user));
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const normalized = email.trim().toLowerCase();
    const user = [...this.users.values()].find((candidate) => candidate.email.toLowerCase() === normalized);
    return user ? structuredClone(user) : undefined;
  }

  async getUser(organizationId: string, userId: string): Promise<UserRecord | undefined> {
    const user = this.users.get(key(organizationId, userId));
    return user ? structuredClone(user) : undefined;
  }

  async listUsers(organizationId: string): Promise<UserRecord[]> {
    return [...this.users.values()].filter((user) => user.organizationId === organizationId).map((user) => structuredClone(user));
  }

  async saveBatchBundle(bundle: ServerBatchBundle): Promise<void> {
    const { organizationId } = bundle.batch;
    this.batches.set(key(organizationId, bundle.batch.id), structuredClone(bundle.batch));
    for (const file of bundle.sourceFiles) this.sourceFiles.set(key(organizationId, file.id), structuredClone(file));
    for (const transaction of bundle.transactions) {
      const decision = bundle.decisions[transaction.id];
      if (!decision) continue;
      this.exceptions.set(key(organizationId, transaction.id), {
        transaction: structuredClone(transaction),
        decision: structuredClone(decision),
        failedRules: structuredClone((bundle.ruleResults[transaction.id] ?? []).filter(({ status }) => status === "FAIL")),
        duplicateMatches: structuredClone(bundle.duplicateMatches[transaction.id] ?? []),
        version: 1,
      });
    }
    this.audits.push(...structuredClone(bundle.auditEvents));
  }

  async getBatch(organizationId: string, batchId: string): Promise<BatchRecord | undefined> {
    const batch = this.batches.get(key(organizationId, batchId));
    return batch ? structuredClone(batch) : undefined;
  }

  private progressForBatch(organizationId: string, batchId: string): ReviewProgress {
    const items = [...this.exceptions.entries()].filter(([compound, item]) =>
      compound.startsWith(`${organizationId}:`)
      && item.transaction.batchId === batchId
      && item.decision.status !== "AUTO_PASS",
    ).map(([, item]) => item);
    const reviewed = items.filter((item) => this.reviews.has(key(organizationId, item.transaction.id))).length;
    return {
      exceptions: items.length,
      reviewed,
      remaining: items.length - reviewed,
      percentage: items.length === 0 ? 100 : Math.round((reviewed / items.length) * 100),
    };
  }

  async listBatches(organizationId: string): Promise<BatchHistoryItem[]> {
    return [...this.batches.values()]
      .filter((batch) => batch.organizationId === organizationId)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .map((batch) => ({ ...structuredClone(batch), reviewProgress: this.progressForBatch(organizationId, batch.id) }));
  }

  private exceptionItems(organizationId: string): ServerExceptionItem[] {
    return [...this.exceptions.entries()]
      .filter(([compound]) => compound.startsWith(`${organizationId}:`))
      .map(([compound, item]) => ({
        ...structuredClone(item),
        assignment: structuredClone(this.assignments.get(compound)),
        review: structuredClone(this.reviews.get(compound)),
      }));
  }

  async queryExceptions(organizationId: string, query: ExceptionQuery): Promise<ExceptionPage> {
    return queryExceptionItems(this.exceptionItems(organizationId), query);
  }

  async getException(organizationId: string, transactionId: string): Promise<ServerExceptionItem | undefined> {
    const compound = key(organizationId, transactionId);
    const item = this.exceptions.get(compound);
    return item ? {
      ...structuredClone(item),
      assignment: structuredClone(this.assignments.get(compound)),
      review: structuredClone(this.reviews.get(compound)),
    } : undefined;
  }

  async getSourceFiles(organizationId: string, batchId: string): Promise<SourceFileRecord[]> {
    return [...this.sourceFiles.values()].filter((file) => file.organizationId === organizationId && file.batchId === batchId).map((file) => structuredClone(file));
  }

  async findSourceFileByHash(organizationId: string, sha256: string): Promise<SourceFileRecord | undefined> {
    const file = [...this.sourceFiles.values()].find((candidate) => candidate.organizationId === organizationId && candidate.sha256 === sha256);
    return file ? structuredClone(file) : undefined;
  }

  async saveSourceFile(record: SourceFileRecord): Promise<void> {
    this.sourceFiles.set(key(record.organizationId, record.id), structuredClone(record));
  }

  private requireVersion(organizationId: string, transactionId: string, expectedVersion: number): [string, ServerExceptionItem] {
    const compound = key(organizationId, transactionId);
    const item = this.exceptions.get(compound);
    if (!item) throw new PlatformError("NOT_FOUND", "Transaction was not found.", 404);
    if (item.version !== expectedVersion) {
      throw new PlatformError("CONFLICT", "This exception changed after it was opened. Reload before submitting.", 409);
    }
    return [compound, item];
  }

  async saveAssignment(record: AssignmentRecord, expectedVersion: number): Promise<ServerExceptionItem> {
    const [compound, item] = this.requireVersion(record.organizationId, record.transactionId, expectedVersion);
    item.version += 1;
    const saved = { ...record, version: item.version };
    this.assignments.set(compound, structuredClone(saved));
    return (await this.getException(record.organizationId, record.transactionId))!;
  }

  async saveReview(record: ReviewRecord, expectedVersion: number): Promise<ServerExceptionItem> {
    const [compound, item] = this.requireVersion(record.organizationId, record.transactionId, expectedVersion);
    item.version += 1;
    const saved = { ...record, version: item.version };
    this.reviews.set(compound, structuredClone(saved));
    return (await this.getException(record.organizationId, record.transactionId))!;
  }

  async appendAudit(event: PlatformAuditEvent): Promise<void> {
    this.audits.push(structuredClone(event));
  }

  async listAudit(organizationId: string, filters: { batchId?: string; transactionId?: string } = {}): Promise<PlatformAuditEvent[]> {
    return this.audits.filter((event) =>
      event.organizationId === organizationId
      && (!filters.batchId || event.batchId === filters.batchId)
      && (!filters.transactionId || event.transactionId === filters.transactionId),
    ).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((event) => structuredClone(event));
  }

  async saveFilter(filter: SavedFilterRecord): Promise<void> {
    this.filters.set(key(filter.organizationId, filter.id), structuredClone(filter));
  }

  async listFilters(organizationId: string, userId: string): Promise<SavedFilterRecord[]> {
    return [...this.filters.values()].filter((filter) => filter.organizationId === organizationId && filter.userId === userId).map((filter) => structuredClone(filter));
  }

  async deleteFilter(organizationId: string, userId: string, filterId: string): Promise<void> {
    const compound = key(organizationId, filterId);
    const filter = this.filters.get(compound);
    if (filter?.userId === userId) this.filters.delete(compound);
  }

  async savePolicy(policy: PolicySetRecord): Promise<void> {
    if (policy.state === "ACTIVE") {
      for (const [compound, existing] of this.policies) {
        if (existing.organizationId === policy.organizationId && existing.state === "ACTIVE" && existing.id !== policy.id) {
          this.policies.set(compound, { ...existing, state: "RETIRED", updatedAt: policy.updatedAt });
        }
      }
    }
    this.policies.set(key(policy.organizationId, policy.id), structuredClone(policy));
  }

  async listPolicies(organizationId: string): Promise<PolicySetRecord[]> {
    return [...this.policies.values()].filter((policy) => policy.organizationId === organizationId).sort((a, b) => b.version - a.version).map((policy) => structuredClone(policy));
  }

  async getActivePolicy(organizationId: string): Promise<PolicySetRecord | undefined> {
    const policy = [...this.policies.values()].find((candidate) => candidate.organizationId === organizationId && candidate.state === "ACTIVE");
    return policy ? structuredClone(policy) : undefined;
  }

  async saveNotification(notification: NotificationRecord): Promise<void> {
    this.notifications.set(key(notification.organizationId, notification.id), structuredClone(notification));
  }

  async listNotifications(organizationId: string, userId: string): Promise<NotificationRecord[]> {
    return [...this.notifications.values()].filter((notification) => notification.organizationId === organizationId && notification.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((notification) => structuredClone(notification));
  }

  async saveExport(record: ExportRecord): Promise<void> {
    this.exports.set(key(record.organizationId, record.id), structuredClone(record));
  }

  async listExports(organizationId: string): Promise<ExportRecord[]> {
    return [...this.exports.values()].filter((record) => record.organizationId === organizationId).map((record) => structuredClone(record));
  }

  async clear(): Promise<void> {
    this.organizations.clear();
    this.users.clear();
    this.batches.clear();
    this.sourceFiles.clear();
    this.exceptions.clear();
    this.assignments.clear();
    this.reviews.clear();
    this.audits.length = 0;
    this.filters.clear();
    this.policies.clear();
    this.notifications.clear();
    this.exports.clear();
  }
}
