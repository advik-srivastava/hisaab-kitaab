import type { AuditEvent } from "../../src/types/audit";
import type { BatchSummary, Decision } from "../../src/types/decisions";
import type { DuplicateMatch } from "../../src/types/duplicates";
import type { RuleResult } from "../../src/types/rules";
import type { Transaction } from "../../src/types/transaction";
import type {
  BatchMetadata,
  PersistedBatch,
  PersistenceAdapter,
  StorageWriteResult,
  StoredReviewAction,
} from "../../src/lib/storage";

const success = (): StorageWriteResult => ({
  success: true,
  serializedBytes: 0,
  serializationMs: 0,
  writeMs: 0,
});

export class MemoryPersistence implements PersistenceAdapter {
  metadata?: BatchMetadata;
  readonly transactions = new Map<string, Transaction>();
  readonly rules = new Map<string, RuleResult[]>();
  readonly duplicates = new Map<string, DuplicateMatch[]>();
  readonly decisions = new Map<string, Decision>();
  readonly reviews = new Map<string, StoredReviewAction[]>();
  readonly audits: AuditEvent[] = [];

  async getCurrentBatchMetadata() { return this.metadata; }
  async getBatchSummary(): Promise<BatchSummary | undefined> { return this.metadata?.batchSummary; }
  async getTransaction(id: string) { return this.transactions.get(id); }
  async getTransactionsForBatch(batchId: string) {
    return [...this.transactions.values()].filter((item) => item.batchId === batchId);
  }
  async getRuleResults(id: string) { return this.rules.get(id) ?? []; }
  async getDuplicateMatches(id: string) { return this.duplicates.get(id) ?? []; }
  async getDecision(id: string) { return this.decisions.get(id); }
  async getAuditEvents(id: string) { return this.audits.filter((event) => event.transactionId === id); }
  async getReviewActions(id: string) { return this.reviews.get(id) ?? []; }
  async getAuditEventCount(batchId: string) { return this.audits.filter((event) => event.batchId === batchId).length; }

  async getCurrentBatch(): Promise<PersistedBatch | undefined> {
    if (!this.metadata) return undefined;
    return {
      ...this.metadata,
      transactions: [...this.transactions.values()],
      ruleResults: Object.fromEntries(this.rules),
      duplicateMatches: Object.fromEntries(this.duplicates),
      decisions: Object.fromEntries(this.decisions),
      reviewActions: Object.fromEntries(this.reviews),
      auditEvents: [...this.audits],
    };
  }

  async saveAnalyzedBatch(batch: PersistedBatch): Promise<StorageWriteResult> {
    await this.clear();
    this.metadata = { batchId: batch.batchId, createdAt: batch.createdAt, batchSummary: batch.batchSummary };
    for (const transaction of batch.transactions) {
      this.transactions.set(transaction.id, transaction);
      this.rules.set(transaction.id, (batch.ruleResults[transaction.id] ?? []).filter(({ status }) => status === "FAIL"));
      this.duplicates.set(transaction.id, batch.duplicateMatches[transaction.id] ?? []);
      const decision = batch.decisions[transaction.id];
      if (decision) this.decisions.set(transaction.id, decision);
    }
    this.audits.push(...batch.auditEvents);
    return success();
  }

  async appendAuditEvents(batchId: string, events: readonly AuditEvent[]) {
    if (this.metadata?.batchId !== batchId) return { ...success(), success: false };
    this.audits.push(...events);
    return success();
  }

  async saveReviewAction(batchId: string, transactionId: string, action: StoredReviewAction, event: AuditEvent) {
    if (this.metadata?.batchId !== batchId) return { ...success(), success: false };
    this.reviews.set(transactionId, [...(this.reviews.get(transactionId) ?? []), action]);
    this.audits.push(event);
    return success();
  }

  async clear() {
    this.metadata = undefined;
    this.transactions.clear();
    this.rules.clear();
    this.duplicates.clear();
    this.decisions.clear();
    this.reviews.clear();
    this.audits.length = 0;
  }
}
