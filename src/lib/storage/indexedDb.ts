import type { AuditEvent } from "../../types/audit";
import type { BatchSummary, Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import { financePolicySchema, type FinancePolicy } from "../../types/policies";
import { activatePolicySet } from "../../core/policies";
import { hasAdvancedExceptionFilters, matchesExceptionQuery } from "./exceptionQuery";
import {
  BATCH_MARKER_KEY,
  STORAGE_KEY,
  type BatchMetadata,
  DEFAULT_EXCEPTION_PAGE_SIZE,
  type ExceptionsPageQuery,
  type ExceptionsPageResult,
  type PersistedBatch,
  type PersistenceAdapter,
  type StorageWriteResult,
  type StoredReviewAction,
} from "./types";

export const DATABASE_NAME = "hisaab-kitaab";
export const DATABASE_VERSION = 3;
export const OBJECT_STORES = {
  batches: "batches",
  transactions: "transactions",
  ruleResults: "ruleResults",
  duplicateMatches: "duplicateMatches",
  decisions: "decisions",
  reviewState: "reviewState",
  auditEvents: "auditEvents",
  policies: "policies",
  settings: "settings",
} as const;

const ANALYSIS_STORES = [
  OBJECT_STORES.batches,
  OBJECT_STORES.transactions,
  OBJECT_STORES.ruleResults,
  OBJECT_STORES.duplicateMatches,
  OBJECT_STORES.decisions,
  OBJECT_STORES.reviewState,
  OBJECT_STORES.auditEvents,
] as const;

interface BatchRecord extends BatchMetadata { current: number }
interface RuleRecord { transactionId: string; batchId: string; results: RuleResult[] }
interface DuplicateRecord {
  transactionId: string;
  batchId: string;
  matchedTransactionIds: string[];
  matches: DuplicateMatch[];
}
interface DecisionRecord {
  transactionId: string;
  batchId: string;
  status: Decision["status"];
  statusRank: number;
  order: number;
  decision: Decision;
}
interface ReviewRecord { transactionId: string; batchId: string; actions: StoredReviewAction[] }
interface AuditRecord {
  id: string;
  batchId: string;
  transactionId: string;
  order: number;
  event: AuditEvent;
}
interface SettingRecord { key: string; value: string }

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function statusRank(status: Decision["status"]): number {
  if (status === "HIGH_RISK") return 0;
  if (status === "REVIEW") return 1;
  return 2;
}

function addDecisionIndexes(decisions: IDBObjectStore): void {
  if (!decisions.indexNames.contains("exceptionOrder")) {
    decisions.createIndex("exceptionOrder", ["batchId", "statusRank", "order"]);
  }
  if (!decisions.indexNames.contains("statusOrder")) {
    decisions.createIndex("statusOrder", ["batchId", "status", "order"]);
  }
}

function createSchema(database: IDBDatabase): void {
  const batches = database.createObjectStore(OBJECT_STORES.batches, { keyPath: "batchId" });
  batches.createIndex("current", "current");
  const transactions = database.createObjectStore(OBJECT_STORES.transactions, { keyPath: "id" });
  transactions.createIndex("batchId", "batchId");
  const rules = database.createObjectStore(OBJECT_STORES.ruleResults, { keyPath: "transactionId" });
  rules.createIndex("batchId", "batchId");
  const duplicates = database.createObjectStore(OBJECT_STORES.duplicateMatches, { keyPath: "transactionId" });
  duplicates.createIndex("batchId", "batchId");
  duplicates.createIndex("matchedTransactionIds", "matchedTransactionIds", { multiEntry: true });
  const decisions = database.createObjectStore(OBJECT_STORES.decisions, { keyPath: "transactionId" });
  decisions.createIndex("batchId", "batchId");
  addDecisionIndexes(decisions);
  const reviews = database.createObjectStore(OBJECT_STORES.reviewState, { keyPath: "transactionId" });
  reviews.createIndex("batchId", "batchId");
  const audits = database.createObjectStore(OBJECT_STORES.auditEvents, { keyPath: "id" });
  audits.createIndex("batchId", "batchId");
  audits.createIndex("transactionId", "transactionId");
  addPolicySchema(database);
}

function addPolicySchema(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(OBJECT_STORES.policies)) {
    const policies = database.createObjectStore(OBJECT_STORES.policies, { keyPath: "id" });
    policies.createIndex("status", "status");
    policies.createIndex("createdAt", "createdAt");
  }
  if (!database.objectStoreNames.contains(OBJECT_STORES.settings)) {
    database.createObjectStore(OBJECT_STORES.settings, { keyPath: "key" });
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion === 0) {
        createSchema(request.result);
        return;
      }
      if (oldVersion < 2 && request.transaction) {
        const decisions = request.transaction.objectStore(OBJECT_STORES.decisions);
        addDecisionIndexes(decisions);
        let order = 0;
        decisions.openCursor().onsuccess = (cursorEvent) => {
          const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          const record = cursor.value as Partial<DecisionRecord> & Pick<DecisionRecord, "decision">;
          cursor.update({
            ...record,
            status: record.decision.status,
            statusRank: statusRank(record.decision.status),
            order,
          });
          order += 1;
          cursor.continue();
        };
      }
      if (oldVersion < 3) addPolicySchema(request.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade was blocked."));
  });
}

function storageResult(
  success: boolean,
  startedAt: number,
  records: readonly unknown[],
  error?: unknown,
): StorageWriteResult {
  const encoder = new TextEncoder();
  const serializedBytes = records.reduce<number>(
    (total, record) => total + encoder.encode(JSON.stringify(record)).byteLength,
    0,
  );
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  return {
    success,
    serializedBytes,
    serializationMs: 0,
    writeMs: performance.now() - startedAt,
    error: success
      ? undefined
      : {
          code: name === "QuotaExceededError" ? "QUOTA_EXCEEDED" : "WRITE_FAILED",
          message: name === "QuotaExceededError"
            ? "Browser storage quota was exceeded."
            : "IndexedDB could not be written.",
        },
  };
}

function updateBrowserMarker(batchId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    if (batchId) window.localStorage.setItem(BATCH_MARKER_KEY, batchId);
    else window.localStorage.removeItem(BATCH_MARKER_KEY);
  } catch {
    // The marker is non-critical; IndexedDB remains the source of truth.
  }
}

export class IndexedDbPersistence implements PersistenceAdapter {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(private readonly factory: IDBFactory) {}

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= openDatabase(this.factory);
    return this.databasePromise;
  }

  private async byIndex<T>(store: string, index: string, key: IDBValidKey): Promise<T[]> {
    const database = await this.database();
    return requestResult(
      database.transaction(store, "readonly").objectStore(store).index(index).getAll(key) as IDBRequest<T[]>,
    );
  }

  private async getRecord<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    const database = await this.database();
    return requestResult(
      database.transaction(store, "readonly").objectStore(store).get(key) as IDBRequest<T | undefined>,
    );
  }

  async getCurrentBatchMetadata(): Promise<BatchMetadata | undefined> {
    const database = await this.database();
    const record = await requestResult(
      database.transaction(OBJECT_STORES.batches, "readonly")
        .objectStore(OBJECT_STORES.batches).index("current").get(1) as IDBRequest<BatchRecord | undefined>,
    );
    if (!record) return undefined;
    const { batchId, createdAt, batchSummary, policySnapshot } = record;
    return { batchId, createdAt, batchSummary, policySnapshot };
  }

  async getCurrentBatch(): Promise<PersistedBatch | undefined> {
    const metadata = await this.getCurrentBatchMetadata();
    if (!metadata) return undefined;
    const [transactions, rules, duplicates, decisions, reviews, audits] = await Promise.all([
      this.getTransactionsForBatch(metadata.batchId),
      this.byIndex<RuleRecord>(OBJECT_STORES.ruleResults, "batchId", metadata.batchId),
      this.byIndex<DuplicateRecord>(OBJECT_STORES.duplicateMatches, "batchId", metadata.batchId),
      this.byIndex<DecisionRecord>(OBJECT_STORES.decisions, "batchId", metadata.batchId),
      this.byIndex<ReviewRecord>(OBJECT_STORES.reviewState, "batchId", metadata.batchId),
      this.byIndex<AuditRecord>(OBJECT_STORES.auditEvents, "batchId", metadata.batchId),
    ]);
    const ruleResults = Object.fromEntries(transactions.map(({ id }) => [id, [] as RuleResult[]]));
    const duplicateMatches = Object.fromEntries(transactions.map(({ id }) => [id, [] as DuplicateMatch[]]));
    for (const record of rules) ruleResults[record.transactionId] = record.results;
    for (const record of duplicates) duplicateMatches[record.transactionId] = record.matches;
    audits.sort((a, b) => a.order - b.order);
    return {
      ...metadata,
      transactions,
      ruleResults,
      duplicateMatches,
      decisions: Object.fromEntries(decisions.map(({ transactionId, decision }) => [transactionId, decision])),
      reviewActions: Object.fromEntries(reviews.map(({ transactionId, actions }) => [transactionId, actions])),
      auditEvents: audits.map(({ event }) => event),
    };
  }

  async getExceptionsPage(query: ExceptionsPageQuery): Promise<ExceptionsPageResult> {
    const startedAt = performance.now();
    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_EXCEPTION_PAGE_SIZE));
    const database = await this.database();
    const transaction = database.transaction(OBJECT_STORES.decisions, "readonly");
    const decisions = transaction.objectStore(OBJECT_STORES.decisions);
    const index = query.status
      ? decisions.index("statusOrder")
      : decisions.index("exceptionOrder");
    const range = query.status
      ? IDBKeyRange.bound(
          [query.batchId, query.status, Number.MIN_SAFE_INTEGER],
          [query.batchId, query.status, Number.MAX_SAFE_INTEGER],
        )
      : IDBKeyRange.bound(
          [query.batchId, 0, Number.MIN_SAFE_INTEGER],
          [query.batchId, 1, Number.MAX_SAFE_INTEGER],
        );
    if (hasAdvancedExceptionFilters(query)) {
      const filteredTransaction = database.transaction([
        OBJECT_STORES.decisions,
        OBJECT_STORES.transactions,
        OBJECT_STORES.ruleResults,
        OBJECT_STORES.duplicateMatches,
        OBJECT_STORES.reviewState,
      ], "readonly");
      const filteredDecisions = filteredTransaction.objectStore(OBJECT_STORES.decisions);
      const filteredIndex = query.status
        ? filteredDecisions.index("statusOrder")
        : filteredDecisions.index("exceptionOrder");
      const transactions = filteredTransaction.objectStore(OBJECT_STORES.transactions);
      const duplicates = filteredTransaction.objectStore(OBJECT_STORES.duplicateMatches);
      const rules = filteredTransaction.objectStore(OBJECT_STORES.ruleResults);
      const reviews = filteredTransaction.objectStore(OBJECT_STORES.reviewState);
      const offset = (page - 1) * pageSize;
      const items: ExceptionsPageResult["items"] = [];
      let totalItems = 0;
      const needsDuplicates = Boolean(query.duplicateType || query.quickFilter === "DUPLICATE");
      const needsRules = query.quickFilter === "AMOUNT_VIOLATION" || query.quickFilter === "MISSING_PO";
      const needsReviews = Boolean(query.reviewStatus);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          reject(filteredTransaction.error ?? new Error("Exception query failed."));
        };
        filteredTransaction.onabort = fail;
        filteredTransaction.onerror = fail;
        const cursorRequest = filteredIndex.openCursor(range);
        cursorRequest.onerror = fail;
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            settled = true;
            resolve();
            return;
          }
          const decisionRecord = cursor.value as DecisionRecord;
          let transactionRecord: Transaction | undefined;
          let duplicateRecord: DuplicateRecord | undefined;
          let ruleRecord: RuleRecord | undefined;
          let reviewRecord: ReviewRecord | undefined;
          let pending = 1 + Number(needsDuplicates) + Number(needsRules) + Number(needsReviews);
          const complete = () => {
            pending -= 1;
            if (pending > 0) return;
            if (transactionRecord && matchesExceptionQuery(transactionRecord, query, {
              duplicateMatches: duplicateRecord?.matches,
              failedRules: ruleRecord?.results,
              reviewActions: reviewRecord?.actions,
            })) {
              if (totalItems >= offset && items.length < pageSize) {
                items.push({ transaction: transactionRecord, decision: decisionRecord.decision });
              }
              totalItems += 1;
            }
            cursor.continue();
          };
          const transactionRequest = transactions.get(decisionRecord.transactionId) as IDBRequest<Transaction | undefined>;
          transactionRequest.onsuccess = () => { transactionRecord = transactionRequest.result; complete(); };
          transactionRequest.onerror = fail;
          if (needsDuplicates) {
            const request = duplicates.get(decisionRecord.transactionId) as IDBRequest<DuplicateRecord | undefined>;
            request.onsuccess = () => { duplicateRecord = request.result; complete(); };
            request.onerror = fail;
          }
          if (needsRules) {
            const request = rules.get(decisionRecord.transactionId) as IDBRequest<RuleRecord | undefined>;
            request.onsuccess = () => { ruleRecord = request.result; complete(); };
            request.onerror = fail;
          }
          if (needsReviews) {
            const request = reviews.get(decisionRecord.transactionId) as IDBRequest<ReviewRecord | undefined>;
            request.onsuccess = () => { reviewRecord = request.result; complete(); };
            request.onerror = fail;
          }
        };
      });
      return {
        items,
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
        queryMs: performance.now() - startedAt,
      };
    }
    const totalItemsPromise = requestResult(index.count(range));
    const recordsPromise = new Promise<DecisionRecord[]>((resolve, reject) => {
      const records: DecisionRecord[] = [];
      const offset = (page - 1) * pageSize;
      let advanced = false;
      const request = index.openCursor(range);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || records.length === pageSize) {
          resolve(records);
          return;
        }
        if (offset > 0 && !advanced) {
          advanced = true;
          cursor.advance(offset);
          return;
        }
        records.push(cursor.value as DecisionRecord);
        cursor.continue();
      };
    });
    const [totalItems, records] = await Promise.all([totalItemsPromise, recordsPromise]);
    const transactionStore = database
      .transaction(OBJECT_STORES.transactions, "readonly")
      .objectStore(OBJECT_STORES.transactions);
    const transactions = await Promise.all(
      records.map(({ transactionId }) =>
        requestResult(transactionStore.get(transactionId) as IDBRequest<Transaction | undefined>),
      ),
    );
    const items = records.flatMap((record, indexPosition) => {
      const storedTransaction = transactions[indexPosition];
      return storedTransaction
        ? [{ transaction: storedTransaction, decision: record.decision }]
        : [];
    });
    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      queryMs: performance.now() - startedAt,
    };
  }

  async getBatchSummary(): Promise<BatchSummary | undefined> {
    return (await this.getCurrentBatchMetadata())?.batchSummary;
  }

  getTransaction(transactionId: string): Promise<Transaction | undefined> {
    return this.getRecord(OBJECT_STORES.transactions, transactionId);
  }

  getTransactionsForBatch(batchId: string): Promise<Transaction[]> {
    return this.byIndex(OBJECT_STORES.transactions, "batchId", batchId);
  }

  async getRuleResults(transactionId: string): Promise<RuleResult[]> {
    return (await this.getRecord<RuleRecord>(OBJECT_STORES.ruleResults, transactionId))?.results ?? [];
  }

  async getDuplicateMatches(transactionId: string): Promise<DuplicateMatch[]> {
    return (await this.getRecord<DuplicateRecord>(OBJECT_STORES.duplicateMatches, transactionId))?.matches ?? [];
  }

  async getDecision(transactionId: string): Promise<Decision | undefined> {
    return (await this.getRecord<DecisionRecord>(OBJECT_STORES.decisions, transactionId))?.decision;
  }

  async getAuditEvents(transactionId: string): Promise<AuditEvent[]> {
    const records = await this.byIndex<AuditRecord>(OBJECT_STORES.auditEvents, "transactionId", transactionId);
    return records.sort((a, b) => a.order - b.order).map(({ event }) => event);
  }

  async getReviewActions(transactionId: string): Promise<StoredReviewAction[]> {
    return (await this.getRecord<ReviewRecord>(OBJECT_STORES.reviewState, transactionId))?.actions ?? [];
  }

  async getAuditEventCount(batchId: string): Promise<number> {
    const database = await this.database();
    return requestResult(
      database.transaction(OBJECT_STORES.auditEvents, "readonly")
        .objectStore(OBJECT_STORES.auditEvents).index("batchId").count(batchId),
    );
  }

  async saveAnalyzedBatch(batch: PersistedBatch): Promise<StorageWriteResult> {
    const metadata: BatchRecord = { batchId: batch.batchId, createdAt: batch.createdAt, batchSummary: batch.batchSummary, policySnapshot: batch.policySnapshot, current: 1 };
    const rules: RuleRecord[] = batch.transactions.flatMap(({ id }) => {
      const results = (batch.ruleResults[id] ?? []).filter(({ status }) => status === "FAIL");
      return results.length ? [{ transactionId: id, batchId: batch.batchId, results }] : [];
    });
    const duplicates: DuplicateRecord[] = batch.transactions.flatMap(({ id }) => {
      const matches = batch.duplicateMatches[id] ?? [];
      return matches.length
        ? [{
            transactionId: id,
            batchId: batch.batchId,
            matches,
            matchedTransactionIds: matches.map(({ matchedTransactionId }) => matchedTransactionId),
          }]
        : [];
    });
    const decisions: DecisionRecord[] = batch.transactions.flatMap(({ id: transactionId }, order) => {
      const decision = batch.decisions[transactionId];
      return decision
        ? [{
            transactionId,
            batchId: batch.batchId,
            status: decision.status,
            statusRank: statusRank(decision.status),
            order,
            decision,
          }]
        : [];
    });
    const reviews: ReviewRecord[] = Object.entries(batch.reviewActions).map(([transactionId, actions]) => ({ transactionId, batchId: batch.batchId, actions }));
    const audits: AuditRecord[] = batch.auditEvents.map((event, order) => ({ id: event.id, batchId: batch.batchId, transactionId: event.transactionId, order, event }));
    const records: unknown[] = [metadata, ...batch.transactions, ...rules, ...duplicates, ...decisions, ...reviews, ...audits];
    const startedAt = performance.now();
    try {
      const database = await this.database();
      const stores = [...ANALYSIS_STORES];
      const transaction = database.transaction(stores, "readwrite");
      const done = transactionDone(transaction);
      for (const store of stores) transaction.objectStore(store).clear();
      transaction.objectStore(OBJECT_STORES.batches).put(metadata);
      for (const record of batch.transactions) transaction.objectStore(OBJECT_STORES.transactions).put(record);
      for (const record of rules) transaction.objectStore(OBJECT_STORES.ruleResults).put(record);
      for (const record of duplicates) transaction.objectStore(OBJECT_STORES.duplicateMatches).put(record);
      for (const record of decisions) transaction.objectStore(OBJECT_STORES.decisions).put(record);
      for (const record of reviews) transaction.objectStore(OBJECT_STORES.reviewState).put(record);
      for (const record of audits) transaction.objectStore(OBJECT_STORES.auditEvents).put(record);
      await done;
      updateBrowserMarker(batch.batchId);
      return storageResult(true, startedAt, records);
    } catch (error) {
      return storageResult(false, startedAt, records, error);
    }
  }

  async appendAuditEvents(batchId: string, events: readonly AuditEvent[]): Promise<StorageWriteResult> {
    const startOrder = await this.getAuditEventCount(batchId);
    const records: AuditRecord[] = events.map((event, index) => ({ id: event.id, batchId, transactionId: event.transactionId, order: startOrder + index, event }));
    const startedAt = performance.now();
    try {
      const database = await this.database();
      const transaction = database.transaction(OBJECT_STORES.auditEvents, "readwrite");
      const done = transactionDone(transaction);
      for (const record of records) transaction.objectStore(OBJECT_STORES.auditEvents).put(record);
      await done;
      return storageResult(true, startedAt, records);
    } catch (error) {
      return storageResult(false, startedAt, records, error);
    }
  }

  async saveReviewAction(batchId: string, transactionId: string, reviewAction: StoredReviewAction, auditEvent: AuditEvent): Promise<StorageWriteResult> {
    const startedAt = performance.now();
    try {
      const database = await this.database();
      const transaction = database.transaction([OBJECT_STORES.reviewState, OBJECT_STORES.auditEvents], "readwrite");
      const done = transactionDone(transaction);
      const reviews = transaction.objectStore(OBJECT_STORES.reviewState);
      const audits = transaction.objectStore(OBJECT_STORES.auditEvents);
      const existingReview = await requestResult(
        reviews.get(transactionId) as IDBRequest<ReviewRecord | undefined>,
      );
      const order = await requestResult(audits.index("batchId").count(batchId));
      const review: ReviewRecord = {
        transactionId,
        batchId,
        actions: [...(existingReview?.actions ?? []), reviewAction],
      };
      const audit: AuditRecord = { id: auditEvent.id, batchId, transactionId, order, event: auditEvent };
      reviews.put(review);
      audits.put(audit);
      await done;
      return storageResult(true, startedAt, [review, audit]);
    } catch (error) {
      return storageResult(false, startedAt, [reviewAction, auditEvent], error);
    }
  }

  async clear(): Promise<void> {
    const database = await this.database();
    const stores = Object.values(OBJECT_STORES);
    const transaction = database.transaction(stores, "readwrite");
    const done = transactionDone(transaction);
    for (const store of stores) transaction.objectStore(store).clear();
    await done;
    updateBrowserMarker();
  }

  async listPolicies(): Promise<FinancePolicy[]> {
    const database = await this.database();
    const records = await requestResult(
      database.transaction(OBJECT_STORES.policies, "readonly")
        .objectStore(OBJECT_STORES.policies).getAll() as IDBRequest<FinancePolicy[]>,
    );
    return records.map((record) => financePolicySchema.parse(record)).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async getActivePolicy(): Promise<FinancePolicy | undefined> {
    const database = await this.database();
    const setting = await requestResult(
      database.transaction(OBJECT_STORES.settings, "readonly")
        .objectStore(OBJECT_STORES.settings).get("activePolicyId") as IDBRequest<SettingRecord | undefined>,
    );
    if (!setting) return undefined;
    const policy = await this.getRecord<FinancePolicy>(OBJECT_STORES.policies, setting.value);
    return policy ? financePolicySchema.parse(policy) : undefined;
  }

  async savePolicy(policy: FinancePolicy): Promise<void> {
    const validated = financePolicySchema.parse(policy);
    const database = await this.database();
    const transaction = database.transaction(OBJECT_STORES.policies, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(OBJECT_STORES.policies).put(validated);
    await done;
  }

  async activatePolicy(policyId: string, activatedAt: string): Promise<FinancePolicy> {
    const policies = await this.listPolicies();
    const updated = activatePolicySet(policies, policyId, activatedAt);
    const active = updated.find(({ id }) => id === policyId)!;
    const database = await this.database();
    const transaction = database.transaction(
      [OBJECT_STORES.policies, OBJECT_STORES.settings],
      "readwrite",
    );
    const done = transactionDone(transaction);
    const policyStore = transaction.objectStore(OBJECT_STORES.policies);
    for (const policy of updated) policyStore.put(policy);
    transaction.objectStore(OBJECT_STORES.settings).put({ key: "activePolicyId", value: policyId });
    await done;
    return active;
  }
}

let browserPersistence: IndexedDbPersistence | undefined;

export function getBrowserPersistence(): IndexedDbPersistence | undefined {
  if (typeof indexedDB === "undefined") return undefined;
  browserPersistence ??= new IndexedDbPersistence(indexedDB);
  return browserPersistence;
}
