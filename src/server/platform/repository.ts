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
  ReviewRecord,
  SavedFilterRecord,
  ServerBatchBundle,
  ServerExceptionItem,
  SourceFileRecord,
  UserRecord,
} from "./types";

export interface PlatformRepository {
  putOrganization(organization: OrganizationRecord): Promise<void>;
  putUser(user: UserRecord): Promise<void>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  getUser(organizationId: string, userId: string): Promise<UserRecord | undefined>;
  listUsers(organizationId: string): Promise<UserRecord[]>;

  saveBatchBundle(bundle: ServerBatchBundle): Promise<void>;
  getBatch(organizationId: string, batchId: string): Promise<BatchRecord | undefined>;
  listBatches(organizationId: string): Promise<BatchHistoryItem[]>;
  queryExceptions(organizationId: string, query: ExceptionQuery): Promise<ExceptionPage>;
  getException(organizationId: string, transactionId: string): Promise<ServerExceptionItem | undefined>;
  getSourceFiles(organizationId: string, batchId: string): Promise<SourceFileRecord[]>;
  findSourceFileByHash(organizationId: string, sha256: string): Promise<SourceFileRecord | undefined>;
  saveSourceFile(record: SourceFileRecord): Promise<void>;

  saveAssignment(record: AssignmentRecord, expectedVersion: number): Promise<ServerExceptionItem>;
  saveReview(record: ReviewRecord, expectedVersion: number): Promise<ServerExceptionItem>;

  appendAudit(event: PlatformAuditEvent): Promise<void>;
  listAudit(organizationId: string, filters?: { batchId?: string; transactionId?: string }): Promise<PlatformAuditEvent[]>;

  saveFilter(filter: SavedFilterRecord): Promise<void>;
  listFilters(organizationId: string, userId: string): Promise<SavedFilterRecord[]>;
  deleteFilter(organizationId: string, userId: string, filterId: string): Promise<void>;

  savePolicy(policy: PolicySetRecord): Promise<void>;
  listPolicies(organizationId: string): Promise<PolicySetRecord[]>;
  getActivePolicy(organizationId: string): Promise<PolicySetRecord | undefined>;

  saveNotification(notification: NotificationRecord): Promise<void>;
  listNotifications(organizationId: string, userId: string): Promise<NotificationRecord[]>;
  saveExport(record: ExportRecord): Promise<void>;
  listExports(organizationId: string): Promise<ExportRecord[]>;
  clear(): Promise<void>;
}
