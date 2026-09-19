import type { AuditEvent } from "../../types/audit";
import type { Decision } from "../../types/decisions";
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
