import { describe, expect, it } from "vitest";

import { EnvironmentDemoAuthProvider, createSessionToken, hashDemoPassword, verifySessionToken } from "../../src/server/auth";
import { getManagedBackupConfiguration, requireManagedRecoveryConfiguration } from "../../src/server/backups/configuration";
import { getServerConfiguration, integrationStatus } from "../../src/server/config";
import { InMemoryProcessingJobQueue, assertJobTransition } from "../../src/server/jobs/jobs";
import { EmailNotificationProvider, TeamsNotificationProvider } from "../../src/server/notifications/providers";
import { MemoryPlatformRepository } from "../../src/server/platform";
import { expiredRetentionCandidates } from "../../src/server/retention/policy";
import { inspectUpload, InMemoryObjectStorage, SecureUploadService } from "../../src/server/uploads";
import { fixedNow, principals } from "./fixtures";

describe("platform infrastructure boundaries", () => {
  it("creates and verifies expiring signed sessions", () => {
    const secret = "a-secure-test-secret-that-is-at-least-32-characters";
    const token = createSessionToken(principals.admin, secret, fixedNow, 60);
    expect(verifySessionToken(token, secret, fixedNow)).toEqual(principals.admin);
    expect(verifySessionToken(`${token}bad`, secret, fixedNow)).toBeUndefined();
    expect(verifySessionToken(token, secret, new Date(fixedNow.getTime() + 61_000))).toBeUndefined();
  });

  it("authenticates only environment-configured scrypt credentials", async () => {
    const salt = "test-salt";
    const provider = new EnvironmentDemoAuthProvider(JSON.stringify([{
      ...principals.admin,
      passwordSalt: salt,
      passwordHash: hashDemoPassword("correct horse", salt),
    }]));
    expect(await provider.authenticate({ email: principals.admin.email, password: "correct horse" })).toEqual(principals.admin);
    expect(await provider.authenticate({ email: principals.admin.email, password: "wrong" })).toBeUndefined();
  });

  it("validates extension, MIME, content signature, size, and SHA-256", () => {
    const csv = inspectUpload("Invoices.CSV", "text/csv", new TextEncoder().encode("Vendor,Amount\nContoso,100"));
    expect(csv).toMatchObject({ extension: "csv", byteSize: 25 });
    expect(csv.sha256).toHaveLength(64);
    expect(csv.storageFilename).not.toContain("Invoices");
    expect(() => inspectUpload("fake.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new TextEncoder().encode("not zip"))).toThrow("signature");
    expect(() => inspectUpload("bad.exe", "application/octet-stream", new Uint8Array([1]))).toThrow("Only CSV and XLSX");
    expect(() => inspectUpload("huge.csv", "text/csv", new Uint8Array(11), 10)).toThrow("exceeds");
  });

  it("stores uploads as PENDING_SCAN and detects duplicate content", async () => {
    const repository = new MemoryPlatformRepository();
    const service = new SecureUploadService(repository, new InMemoryObjectStorage(), () => fixedNow);
    const file = { name: "finance.csv", type: "text/csv", bytes: new TextEncoder().encode("Vendor,Amount\nContoso,100") };
    const first = await service.upload(principals.manager, "batch-1", file);
    const second = await service.upload(principals.manager, "batch-2", file);
    expect(first).toMatchObject({ duplicateUpload: false, file: { scanStatus: "PENDING_SCAN" } });
    expect(second.duplicateUpload).toBe(true);
  });

  it("records a real scanner result and audit without treating upload as clean", async () => {
    const repository = new MemoryPlatformRepository();
    const service = new SecureUploadService(repository, new InMemoryObjectStorage(), () => fixedNow);
    const uploaded = await service.upload(principals.manager, "batch-1", {
      name: "finance.csv", type: "text/csv", bytes: new TextEncoder().encode("Vendor,Amount\nContoso,100"),
    });
    expect(uploaded.file.scanStatus).toBe("PENDING_SCAN");
    const scanned = await service.recordScanResult(principals.manager, "batch-1", uploaded.file.id, { scan: async () => "CLEAN" });
    expect(scanned.scanStatus).toBe("CLEAN");
    expect((await repository.listAudit("org-alpha", { batchId: "batch-1" })).map(({ action }) => action)).toEqual(["FILE_UPLOADED", "FILE_SCAN_RESULT"]);
  });

  it("enforces the server processing job state machine", async () => {
    const queue = new InMemoryProcessingJobQueue(() => fixedNow);
    const queued = await queue.enqueue({ organizationId: "org-alpha", batchId: "batch-1" });
    const processing = await queue.update("org-alpha", queued.id, "PROCESSING", { progressStage: "EVALUATING_RULES", processed: 10, total: 100 });
    const complete = await queue.update("org-alpha", queued.id, "COMPLETED", { processed: 100 });
    expect(processing.startedAt).toBe(fixedNow.toISOString());
    expect(complete.completedAt).toBe(fixedNow.toISOString());
    expect(() => assertJobTransition("COMPLETED", "PROCESSING")).toThrow("cannot move");
  });

  it("selects retention candidates without hard-deleting evidence", () => {
    const expired = expiredRetentionCandidates([
      { id: "old", kind: "uploadedFile", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", kind: "auditEvent", createdAt: "2026-09-20T00:00:00.000Z" },
    ], { uploadedFilesDays: 30, transactionDataDays: 365, auditEventsDays: 2555, reportsDays: 90 }, fixedNow);
    expect(expired.map(({ id }) => id)).toEqual(["old"]);
  });

  it("reports external services as configuration required without fake success", () => {
    const status = integrationStatus(getServerConfiguration({ APP_MODE: "SERVER" } as unknown as NodeJS.ProcessEnv));
    expect(status).toMatchObject({ database: "CONFIGURATION_REQUIRED", blobStorage: "CONFIGURATION_REQUIRED", serviceBus: "CONFIGURATION_REQUIRED", monitoring: "CONFIGURATION_REQUIRED" });
  });

  it("requires verified managed backup and recovery configuration", () => {
    const missing = getManagedBackupConfiguration({} as NodeJS.ProcessEnv);
    expect(() => requireManagedRecoveryConfiguration(missing)).toThrow("MANAGED BACKUP CONFIGURATION REQUIRED");
    expect(requireManagedRecoveryConfiguration({
      databasePointInTimeRestoreConfigured: true,
      objectVersioningConfigured: true,
      objectSoftDeleteConfigured: true,
      recoveryRunbookUrl: "https://operations.example/runbooks/restore",
    }).recoveryRunbookUrl).toContain("restore");
  });

  it("does not fake unconfigured email or Teams delivery", async () => {
    const message = { recipient: "finance@example.test", subject: "Assigned", message: "Review required." };
    await expect(new EmailNotificationProvider().send(message)).rejects.toMatchObject({ code: "CONFIGURATION_REQUIRED" });
    await expect(new TeamsNotificationProvider().send(message)).rejects.toMatchObject({ code: "CONFIGURATION_REQUIRED" });
  });
});
