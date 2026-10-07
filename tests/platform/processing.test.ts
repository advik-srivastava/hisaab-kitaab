import { File as NodeFile } from "node:buffer";

import { describe, expect, it } from "vitest";

import { analyzeBatch } from "../../src/core/pipeline";
import { defaultFinancePolicy } from "../../src/config/defaultPolicy";
import { MemoryPlatformRepository } from "../../src/server/platform";
import { ServerBatchProcessingService } from "../../src/server/processing/service";
import { fixedNow, principals } from "./fixtures";

function csvFile(contents: string): File {
  const file = new NodeFile([contents], "server.csv", { type: "text/csv" });
  Object.defineProperty(file, "webkitRelativePath", { value: "" });
  return file as unknown as File;
}

describe("server batch processing composition", () => {
  it("persists canonical analysis with policy, failed evidence, decisions, audit, and notification", async () => {
    const repository = new MemoryPlatformRepository();
    const analysis = await analyzeBatch([
      csvFile("Vendor,Invoice,Invoice Date,Amount,Currency,Category\nContoso,INV-1,2026-09-20,2500,INR,Meals"),
    ], { referenceDate: "2026-09-24", now: () => fixedNow, policy: defaultFinancePolicy });
    const service = new ServerBatchProcessingService(repository, () => fixedNow);
    const batch = await service.persistAnalysis(principals.manager, analysis, [{
      id: "file-server", organizationId: "org-alpha", batchId: analysis.batchId,
      originalFilename: "server.csv", storageFilename: "safe.csv", contentType: "text/csv",
      byteSize: 100, sha256: "hash", scanStatus: "PENDING_SCAN", uploadedAt: fixedNow.toISOString(),
    }], "policy-v7");

    const transactionId = analysis.transactions[0].id;
    const stored = await repository.getException("org-alpha", transactionId);
    expect(batch).toMatchObject({ policyVersionId: "policy-v7", status: "COMPLETED", summary: analysis.batchSummary });
    expect(stored?.failedRules.every(({ status }) => status === "FAIL")).toBe(true);
    expect(stored?.decision).toEqual(analysis.decisions[transactionId]);
    expect((await repository.listAudit("org-alpha", { batchId: analysis.batchId })).map(({ action }) => action)).toContain("STATUS_ASSIGNED");
    expect(await repository.listNotifications("org-alpha", principals.manager.userId)).toEqual([
      expect.objectContaining({ type: "BATCH_COMPLETED", batchId: analysis.batchId }),
    ]);
  });

  it("denies cross-tenant source-file persistence", async () => {
    const repository = new MemoryPlatformRepository();
    const analysis = await analyzeBatch([
      csvFile("Vendor,Invoice,Invoice Date,Amount,Currency\nContoso,INV-1,2026-09-20,100,INR"),
    ], { referenceDate: "2026-09-24", now: () => fixedNow, policy: defaultFinancePolicy });
    const service = new ServerBatchProcessingService(repository, () => fixedNow);
    await expect(service.persistAnalysis(principals.manager, analysis, [{
      id: "foreign-file", organizationId: "org-beta", batchId: analysis.batchId,
      originalFilename: "server.csv", storageFilename: "safe.csv", contentType: "text/csv",
      byteSize: 100, sha256: "hash", scanStatus: "PENDING_SCAN", uploadedAt: fixedNow.toISOString(),
    }], "policy-v1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
