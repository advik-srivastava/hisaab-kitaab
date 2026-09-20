import type { AuditEvent } from "../../types/audit";
import type { BatchSummary, Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { DuplicateDetectionMetrics } from "../duplicates";
import type { IngestionFileError } from "../ingestion";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import type { PersistenceAdapter, StorageLike, StorageWriteResult } from "../../lib/storage";

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

export type ProcessingStage =
  | "READING_FILES"
  | "NORMALIZING"
  | "EVALUATING_RULES"
  | "CHECKING_DUPLICATES"
  | "MAKING_DECISIONS"
  | "SAVING_RESULTS"
  | "COMPLETE";

export interface ProcessingProgress {
  stage: ProcessingStage;
  processed?: number;
  total?: number;
}

export interface AnalyzeBatchOptions {
  referenceDate?: Date | string;
  now?: () => Date;
  onProgress?: (progress: ProcessingProgress) => void;
}

export interface ProcessBatchOptions {
  referenceDate?: Date | string;
  storage?: StorageLike;
  persistence?: PersistenceAdapter;
  now?: () => Date;
}

export interface BatchAnalysisResult {
  batchId: string;
  createdAt: string;
  transactions: Transaction[];
  ruleResults: Record<string, RuleResult[]>;
  duplicatePairs: DuplicateMatch[];
  duplicateMatches: Record<string, DuplicateMatch[]>;
  decisions: Record<string, Decision>;
  batchSummary: BatchSummary;
  fileErrors: IngestionFileError[];
  filesProcessed: number;
  rowsProcessed: number;
  processingMetrics: ProcessingMetrics;
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
