import type { AuditEvent } from "../../types/audit";
import type { BatchSummary, Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { DuplicateDetectionMetrics } from "../duplicates";
import type { IngestionFileError } from "../ingestion";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import type { StorageLike, StorageWriteResult } from "../../lib/storage";

export interface ProcessingMetrics {
  ingestionMs: number;
  rulesMs: number;
  duplicateMs: number;
  decisionsMs: number;
  serializationMs: number;
  persistenceMs: number;
  serializedStateBytes: number;
  duplicateDetection: DuplicateDetectionMetrics;
}

export interface ProcessBatchOptions {
  referenceDate?: Date | string;
  storage?: StorageLike;
  now?: () => Date;
}

export interface ProcessBatchResult {
  batchId: string;
  createdAt: string;
  transactions: Transaction[];
  ruleResults: Record<string, RuleResult[]>;
  duplicateMatches: Record<string, DuplicateMatch[]>;
  decisions: Record<string, Decision>;
  batchSummary: BatchSummary;
  auditEvents: AuditEvent[];
  fileErrors: IngestionFileError[];
  filesProcessed: number;
  rowsProcessed: number;
  processingMetrics: ProcessingMetrics;
  persistence: StorageWriteResult;
}
