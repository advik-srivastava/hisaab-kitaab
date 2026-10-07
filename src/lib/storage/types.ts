import type { AuditEvent } from "../../types/audit";
import type { BatchSummary, Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { DuplicateMatchType } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import type { PolicySnapshot } from "../../types/policies";

export const STORAGE_VERSION = 1 as const;
export const STORAGE_KEY = "hisaab-kitaab:v1";
export const BATCH_MARKER_KEY = "hisaab-kitaab:current-batch";

export type ReviewAction = "APPROVE" | "REJECT" | "MARK_NOT_DUPLICATE";
export type ExceptionStatusFilter = "HIGH_RISK" | "REVIEW";
export type DuplicateStatusFilter = DuplicateMatchType | "NONE";
export type PurchaseOrderStateFilter = "PRESENT" | "MISSING";
export type HumanReviewStatusFilter = "REVIEWED" | "UNREVIEWED";
export type ExceptionQuickFilter = "DUPLICATE" | "AMOUNT_VIOLATION" | "MISSING_PO";
export const DEFAULT_EXCEPTION_PAGE_SIZE = 50;

export interface ExceptionsPageQuery {
  batchId: string;
  status?: ExceptionStatusFilter;
  search?: string;
  expenseCategory?: string;
  currency?: string;
  department?: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  duplicateType?: DuplicateStatusFilter;
  purchaseOrderState?: PurchaseOrderStateFilter;
  reviewStatus?: HumanReviewStatusFilter;
  quickFilter?: ExceptionQuickFilter;
  page?: number;
  pageSize?: number;
}

export interface ExceptionPageItem {
  transaction: Transaction;
  decision: Decision;
}

export interface ExceptionsPageResult {
  items: ExceptionPageItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  queryMs: number;
}

export interface StoredReviewAction {
  action: ReviewAction;
  reviewer: string;
  note: string | null;
  timestamp: string;
  auditEventId: string;
}

export interface PersistedBatch {
  batchId: string;
  createdAt: string;
  batchSummary?: BatchSummary;
  policySnapshot?: PolicySnapshot;
  transactions: Transaction[];
  ruleResults: Record<string, RuleResult[]>;
  duplicateMatches: Record<string, DuplicateMatch[]>;
  decisions: Record<string, Decision>;
  auditEvents: AuditEvent[];
  reviewActions: Record<string, StoredReviewAction[]>;
}

export interface PersistedState {
  version: typeof STORAGE_VERSION;
  currentBatch: PersistedBatch | null;
}

export interface AnalyzedBatchInput {
  batchId: string;
  createdAt: string;
  batchSummary?: BatchSummary;
  policySnapshot?: PolicySnapshot;
  transactions: Transaction[];
  ruleResults: Record<string, RuleResult[]>;
  duplicateMatches: Record<string, DuplicateMatch[]>;
  decisions: Record<string, Decision>;
  auditEvents?: AuditEvent[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageWriteErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "INVALID_STATE"
  | "SERIALIZATION_FAILED"
  | "QUOTA_EXCEEDED"
  | "WRITE_FAILED";

export interface StorageWriteError {
  code: StorageWriteErrorCode;
  message: string;
}

export interface StorageWriteResult {
  success: boolean;
  serializedBytes: number;
  serializationMs: number;
  writeMs: number;
  error?: StorageWriteError;
}

export interface BatchMetadata {
  batchId: string;
  createdAt: string;
  batchSummary?: BatchSummary;
  policySnapshot?: PolicySnapshot;
}

export interface PersistenceAdapter {
  getCurrentBatchMetadata(): Promise<BatchMetadata | undefined>;
  getCurrentBatch(): Promise<PersistedBatch | undefined>;
  getExceptionsPage(query: ExceptionsPageQuery): Promise<ExceptionsPageResult>;
  getBatchSummary(): Promise<BatchSummary | undefined>;
  getTransaction(transactionId: string): Promise<Transaction | undefined>;
  getTransactionsForBatch(batchId: string): Promise<Transaction[]>;
  getRuleResults(transactionId: string): Promise<RuleResult[]>;
  getDuplicateMatches(transactionId: string): Promise<DuplicateMatch[]>;
  getDecision(transactionId: string): Promise<Decision | undefined>;
  getAuditEvents(transactionId: string): Promise<AuditEvent[]>;
  getReviewActions(transactionId: string): Promise<StoredReviewAction[]>;
  getAuditEventCount(batchId: string): Promise<number>;
  saveAnalyzedBatch(batch: PersistedBatch): Promise<StorageWriteResult>;
  appendAuditEvents(batchId: string, events: readonly AuditEvent[]): Promise<StorageWriteResult>;
  saveReviewAction(
    batchId: string,
    transactionId: string,
    reviewAction: StoredReviewAction,
    auditEvent: AuditEvent,
  ): Promise<StorageWriteResult>;
  clear(): Promise<void>;
}
