import type { AuditEvent } from "../../types/audit";
import type { Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import { getBrowserPersistence } from "./indexedDb";
import { loadState, saveStateWithResult } from "./storage";
import { DEFAULT_EXCEPTION_PAGE_SIZE } from "./types";
import type {
  AnalyzedBatchInput,
  BatchMetadata,
  ExceptionsPageQuery,
  ExceptionsPageResult,
  PersistedState,
  PersistenceAdapter,
  StorageLike,
  StoredReviewAction,
  StorageWriteResult,
} from "./types";

export type PersistenceTarget = PersistenceAdapter | StorageLike;

function isPersistenceAdapter(target: PersistenceTarget | undefined): target is PersistenceAdapter {
  return typeof (target as PersistenceAdapter | undefined)?.getCurrentBatch === "function";
}

function stateForInput(input: AnalyzedBatchInput): PersistedState {
  const ruleResults = Object.fromEntries(
    Object.entries(input.ruleResults).map(([transactionId, results]) => [
      transactionId,
      results.filter(({ status }) => status === "FAIL"),
    ]),
  );
  return {
    version: 1,
    currentBatch: {
      ...input,
      ruleResults,
      auditEvents: input.auditEvents ?? [],
      reviewActions: {},
    },
  };
}

export interface SaveAnalyzedBatchResult {
  state: PersistedState;
  persistence: StorageWriteResult;
}

export function saveAnalyzedBatchWithResult(
  input: AnalyzedBatchInput,
  storage?: StorageLike,
): SaveAnalyzedBatchResult {
  const state = stateForInput(input);
  return { state, persistence: saveStateWithResult(state, storage) };
}

export async function saveAnalyzedBatchAsync(
  input: AnalyzedBatchInput,
  target?: PersistenceTarget,
): Promise<SaveAnalyzedBatchResult> {
  if (target && !isPersistenceAdapter(target)) {
    return saveAnalyzedBatchWithResult(input, target);
  }
  const state = stateForInput(input);
  const adapter = target ?? getBrowserPersistence();
  if (!adapter || !state.currentBatch) {
    return {
      state,
      persistence: {
        success: false,
        serializedBytes: 0,
        serializationMs: 0,
        writeMs: 0,
        error: { code: "STORAGE_UNAVAILABLE", message: "IndexedDB is unavailable." },
      },
    };
  }
  return { state, persistence: await adapter.saveAnalyzedBatch(state.currentBatch) };
}

export function saveAnalyzedBatch(
  input: AnalyzedBatchInput,
  storage?: StorageLike,
): PersistedState {
  return saveAnalyzedBatchWithResult(input, storage).state;
}

export function getTransaction(
  transactionId: string,
  storage?: StorageLike,
): Transaction | undefined {
  return loadState(storage).currentBatch?.transactions.find(
    ({ id }) => id === transactionId,
  );
}

export function getDecision(
  transactionId: string,
  storage?: StorageLike,
): Decision | undefined {
  return loadState(storage).currentBatch?.decisions[transactionId];
}

export function getRuleResults(
  transactionId: string,
  storage?: StorageLike,
): RuleResult[] {
  return loadState(storage).currentBatch?.ruleResults[transactionId] ?? [];
}

export function getDuplicateMatches(
  transactionId: string,
  storage?: StorageLike,
): DuplicateMatch[] {
  return loadState(storage).currentBatch?.duplicateMatches[transactionId] ?? [];
}

export function getAuditEvents(
  transactionId: string,
  storage?: StorageLike,
): AuditEvent[] {
  return (
    loadState(storage).currentBatch?.auditEvents.filter(
      (event) => event.transactionId === transactionId,
    ) ?? []
  );
}

export function getReviewActions(
  transactionId: string,
  storage?: StorageLike,
): StoredReviewAction[] {
  return loadState(storage).currentBatch?.reviewActions[transactionId] ?? [];
}

function adapterFor(target?: PersistenceTarget): PersistenceAdapter | undefined {
  return isPersistenceAdapter(target) ? target : getBrowserPersistence();
}

export async function getCurrentBatch(target?: PersistenceTarget) {
  if (target && !isPersistenceAdapter(target)) return loadState(target).currentBatch;
  return (await adapterFor(target)?.getCurrentBatch()) ?? null;
}

export async function getCurrentBatchMetadata(
  target?: PersistenceTarget,
): Promise<BatchMetadata | undefined> {
  if (target && !isPersistenceAdapter(target)) {
    const batch = loadState(target).currentBatch;
    return batch
      ? { batchId: batch.batchId, createdAt: batch.createdAt, batchSummary: batch.batchSummary }
      : undefined;
  }
  return adapterFor(target)?.getCurrentBatchMetadata();
}

export async function getExceptionsPage(
  query: ExceptionsPageQuery,
  target?: PersistenceTarget,
): Promise<ExceptionsPageResult> {
  const adapter = adapterFor(target);
  if (!target || isPersistenceAdapter(target)) {
    if (adapter) return adapter.getExceptionsPage(query);
    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_EXCEPTION_PAGE_SIZE));
    return { items: [], page, pageSize, totalItems: 0, totalPages: 0, queryMs: 0 };
  }

  const startedAt = performance.now();
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_EXCEPTION_PAGE_SIZE));
  const batch = loadState(target).currentBatch;
  const items = (batch?.transactions ?? [])
    .flatMap((transaction, order) => {
      const decision = batch?.decisions[transaction.id];
      return decision ? [{ transaction, decision, order }] : [];
    })
    .filter(({ transaction, decision }) =>
      transaction.batchId === query.batchId
      && (query.status ? decision.status === query.status : decision.status !== "AUTO_PASS"),
    )
    .sort((left, right) => {
      const leftRank = left.decision.status === "HIGH_RISK" ? 0 : 1;
      const rightRank = right.decision.status === "HIGH_RISK" ? 0 : 1;
      return leftRank - rightRank || left.order - right.order;
    });
  const totalItems = items.length;
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize).map(({ transaction, decision }) => ({ transaction, decision })),
    page,
    pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    queryMs: performance.now() - startedAt,
  };
}

export async function getBatchSummary(target?: PersistenceTarget) {
  if (target && !isPersistenceAdapter(target)) return loadState(target).currentBatch?.batchSummary;
  return adapterFor(target)?.getBatchSummary();
}

export async function getTransactionAsync(transactionId: string, target?: PersistenceTarget) {
  if (target && !isPersistenceAdapter(target)) return getTransaction(transactionId, target);
  return adapterFor(target)?.getTransaction(transactionId);
}

export async function getTransactionsForBatch(batchId: string, target?: PersistenceTarget): Promise<Transaction[]> {
  if (target && !isPersistenceAdapter(target)) {
    return loadState(target).currentBatch?.transactions.filter((item) => item.batchId === batchId) ?? [];
  }
  return (await adapterFor(target)?.getTransactionsForBatch(batchId)) ?? [];
}

export async function getRuleResultsAsync(transactionId: string, target?: PersistenceTarget): Promise<RuleResult[]> {
  if (target && !isPersistenceAdapter(target)) return getRuleResults(transactionId, target);
  return (await adapterFor(target)?.getRuleResults(transactionId)) ?? [];
}

export async function getDuplicateMatchesAsync(transactionId: string, target?: PersistenceTarget): Promise<DuplicateMatch[]> {
  if (target && !isPersistenceAdapter(target)) return getDuplicateMatches(transactionId, target);
  return (await adapterFor(target)?.getDuplicateMatches(transactionId)) ?? [];
}

export async function getDecisionAsync(transactionId: string, target?: PersistenceTarget): Promise<Decision | undefined> {
  if (target && !isPersistenceAdapter(target)) return getDecision(transactionId, target);
  return adapterFor(target)?.getDecision(transactionId);
}

export async function getAuditEventsAsync(transactionId: string, target?: PersistenceTarget): Promise<AuditEvent[]> {
  if (target && !isPersistenceAdapter(target)) return getAuditEvents(transactionId, target);
  return (await adapterFor(target)?.getAuditEvents(transactionId)) ?? [];
}

export async function getReviewActionsAsync(transactionId: string, target?: PersistenceTarget): Promise<StoredReviewAction[]> {
  if (target && !isPersistenceAdapter(target)) return getReviewActions(transactionId, target);
  return (await adapterFor(target)?.getReviewActions(transactionId)) ?? [];
}
