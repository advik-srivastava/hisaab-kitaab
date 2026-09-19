import type { AuditEvent } from "../../types/audit";
import type { BatchSummary, Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";

export const STORAGE_VERSION = 1 as const;
export const STORAGE_KEY = "hisaab-kitaab:v1";

export type ReviewAction = "APPROVE" | "REJECT" | "MARK_NOT_DUPLICATE";

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
