import type { BatchSummary, Decision, DecisionStatus } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";

export type AppMode = "LOCAL_DEMO" | "SERVER";
export type UserRole = "ADMIN" | "FINANCE_MANAGER" | "REVIEWER" | "AUDITOR";
export type ReviewAction = "APPROVE" | "REJECT" | "MARK_NOT_DUPLICATE";
export type BatchProcessingStatus =
  | "UPLOADING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED";
export type FileScanStatus = "PENDING_SCAN" | "CLEAN" | "INFECTED" | "SCAN_FAILED";
export type PolicyState = "DRAFT" | "ACTIVE" | "RETIRED";
export type ReviewState = "UNREVIEWED" | "REVIEWED";
export type AgeBucket = "LT_1_DAY" | "ONE_TO_THREE_DAYS" | "FOUR_TO_SEVEN_DAYS" | "SEVEN_PLUS_DAYS";

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: UserRole;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface UserRecord {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface SourceFileRecord {
  id: string;
  organizationId: string;
  batchId: string;
  originalFilename: string;
  storageFilename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  scanStatus: FileScanStatus;
  blobKey?: string;
  uploadedAt: string;
}

export interface BatchRecord {
  id: string;
  organizationId: string;
  uploadedBy: string;
  uploadedAt: string;
  processedAt?: string;
  updatedAt: string;
  status: BatchProcessingStatus;
  policyVersionId: string;
  fileCount: number;
  filesProcessed: number;
  processingErrors: string[];
  summary: BatchSummary;
}

export interface AssignmentRecord {
  transactionId: string;
  organizationId: string;
  reviewerId: string;
  assignedBy: string;
  assignedAt: string;
  version: number;
}

export interface ReviewRecord {
  transactionId: string;
  organizationId: string;
  action: ReviewAction;
  reviewerId: string;
  reviewerName: string;
  note: string | null;
  reviewedAt: string;
  version: number;
}

export type PlatformAuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "BATCH_CREATED"
  | "FILE_UPLOADED"
  | "FILE_SCAN_RESULT"
  | "PROCESSING_STARTED"
  | "PROCESSING_COMPLETED"
  | "PROCESSING_FAILED"
  | "DUPLICATE_DETECTED"
  | "STATUS_ASSIGNED"
  | "REVIEWER_ASSIGNED"
  | "REVIEWER_REASSIGNED"
  | ReviewAction
  | "POLICY_CHANGED"
  | "EXPORT_CREATED";

export interface PlatformAuditEvent {
  id: string;
  organizationId: string;
  timestamp: string;
  actorId: string | null;
  actorRole: UserRole | "SYSTEM";
  action: PlatformAuditAction;
  batchId?: string;
  transactionId?: string;
  note?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SavedFilterRecord {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  query: ExceptionQuery;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyDefinition {
  supportedCurrencies: string[];
  expenseLimits: { Meals: number; Taxi: number; Hotel: number };
  purchaseOrderRequiredAbove: number;
  requiredFields: Array<"vendorName" | "invoiceNumber" | "invoiceDate" | "amount" | "currency">;
}

export interface PolicySetRecord {
  id: string;
  organizationId: string;
  version: number;
  name: string;
  state: PolicyState;
  effectiveAt?: string;
  definition: PolicyDefinition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  organizationId: string;
  userId: string;
  type: "BATCH_COMPLETED" | "BATCH_FAILED" | "EXCEPTION_ASSIGNED" | "HIGH_RISK_ASSIGNED" | "EXCEPTION_REASSIGNED";
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  transactionId?: string;
  batchId?: string;
}

export interface ExportRecord {
  id: string;
  organizationId: string;
  requestedBy: string;
  kind: "EXCEPTIONS_CSV" | "EXCEPTIONS_XLSX" | "AUDIT_CSV" | "BATCH_REPORT";
  createdAt: string;
  query?: ExceptionQuery;
  batchId?: string;
}

export interface RetentionPolicy {
  uploadedFilesDays: number;
  transactionDataDays: number;
  auditEventsDays: number;
  reportsDays: number;
}

export interface ExceptionQuery {
  batchId?: string;
  status?: "ALL" | "HIGH_RISK" | "REVIEW";
  search?: string;
  assignedReviewerId?: string;
  unassigned?: boolean;
  department?: string;
  expenseCategory?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  duplicateType?: "EXACT" | "PROBABLE" | "FUZZY";
  reviewStatus?: ReviewState;
  ageBucket?: AgeBucket;
  page?: number;
  pageSize?: number;
  sortBy?: "risk" | "amount" | "invoiceDate" | "vendor" | "duplicateSimilarity";
  sortDirection?: "asc" | "desc";
}

export interface ServerExceptionItem {
  transaction: Transaction;
  decision: Decision;
  failedRules: RuleResult[];
  duplicateMatches: DuplicateMatch[];
  assignment?: AssignmentRecord;
  review?: ReviewRecord;
  version: number;
}

export interface ServerExceptionDetail extends ServerExceptionItem {
  matchedTransaction?: Transaction;
  auditEvents: PlatformAuditEvent[];
}

export interface ExceptionPage {
  items: ServerExceptionItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ServerBatchBundle {
  batch: BatchRecord;
  sourceFiles: SourceFileRecord[];
  transactions: Transaction[];
  ruleResults: Record<string, RuleResult[]>;
  duplicateMatches: Record<string, DuplicateMatch[]>;
  decisions: Record<string, Decision>;
  auditEvents: PlatformAuditEvent[];
}

export interface ReviewProgress {
  exceptions: number;
  reviewed: number;
  remaining: number;
  percentage: number;
}

export interface BatchHistoryItem extends BatchRecord {
  reviewProgress: ReviewProgress;
}

export interface TrendPoint {
  batchId: string;
  processedAt: string;
  transactionsProcessed: number;
  autoClearRate: number;
  reviewVolume: number;
  highRiskVolume: number;
  duplicateCandidates: number;
  potentialExposure: number;
  reviewCompletionHours?: number;
}

export interface AgingSummary {
  buckets: Record<AgeBucket, number>;
  oldestUnresolved?: {
    transactionId: string;
    ageDays: number;
    assignedReviewerId?: string;
    status: DecisionStatus;
  };
}
