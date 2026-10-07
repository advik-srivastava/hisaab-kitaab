import { File as NodeFile } from "node:buffer";

import { beforeAll, describe, expect, it } from "vitest";

import { applyReviewAction } from "../../src/core/audit";
import { defaultFinancePolicy } from "../../src/config/defaultPolicy";
import {
  findDuplicates,
  type DuplicateDetectionMetrics,
} from "../../src/core/duplicates";
import { processBatch, type ProcessBatchResult } from "../../src/core/pipeline";
import {
  getAuditEvents,
  getDuplicateMatches,
  getReviewActions,
  getRuleResults,
  loadState,
  serializedSizeBytes,
  type StorageLike,
} from "../../src/lib/storage";
import type { Transaction } from "../../src/types/transaction";
import { MemoryPersistence } from "../storage/memoryPersistence";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class QuotaStorage implements StorageLike {
  getItem(): string | null {
    return null;
  }

  setItem(): void {
    const error = new Error("Storage quota exceeded");
    error.name = "QuotaExceededError";
    throw error;
  }

  removeItem(): void {}
}

function csvFile(content: string, name = "scale.csv"): File {
  const file = new NodeFile([content], name, { type: "text/csv" });
  Object.defineProperty(file, "webkitRelativePath", { value: "" });
  return file as unknown as File;
}

function generatedTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `TXN-${String(index + 1).padStart(5, "0")}`,
    batchId: "scale-batch",
    vendorName: `Vendor ${index}`,
    normalizedVendor: `vendor ${index}`,
    invoiceNumber: `INV-${index}`,
    invoiceDate: "2026-09-19",
    amount: 1000 + index,
    currency: "INR",
    expenseCategory: "Office",
    sourceFile: "scale.xlsx",
    sourceSheet: "Data",
    sourceRow: index + 2,
    createdAt: "2026-09-20T00:00:00.000Z",
  }));
}

function generatedCsv(count: number): string {
  const rows = Array.from(
    { length: count },
    (_, index) =>
      `Vendor ${index},INV-${index},2026-09-19,${1000 + index},INR,Office,PO-${index}`,
  );
  return [
    "Vendor,Invoice,Invoice Date,Amount,Currency,Category,PO",
    ...rows,
  ].join("\n");
}

const fixedOptions = {
  referenceDate: "2026-09-20",
  now: () => new Date("2026-09-20T12:00:00.000Z"),
  policy: defaultFinancePolicy,
};

describe("duplicate candidate blocking at scale", () => {
  it.each([100, 500, 2000])(
    "blocks a generated %i-row batch before pair evaluation",
    (count) => {
      const metrics: DuplicateDetectionMetrics = {
        totalTransactions: 0,
        candidatePairs: 0,
        evaluatedPairs: 0,
        fuzzyComparisons: 0,
      };
      expect(findDuplicates(generatedTransactions(count), metrics)).toEqual([]);
      expect(metrics).toEqual({
        totalTransactions: count,
        candidatePairs: 0,
        evaluatedPairs: 0,
        fuzzyComparisons: 0,
      });
    },
  );

  it("indexes exact matches without all-pairs fuzzy comparison", () => {
    const rows = generatedTransactions(2000);
    rows[1999] = {
      ...rows[1999],
      normalizedVendor: rows[0].normalizedVendor,
      vendorName: rows[0].vendorName,
      invoiceNumber: rows[0].invoiceNumber,
      amount: 999999,
    };
    const metrics: DuplicateDetectionMetrics = {
      totalTransactions: 0,
      candidatePairs: 0,
      evaluatedPairs: 0,
      fuzzyComparisons: 0,
    };

    const matches = findDuplicates(rows, metrics);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe("EXACT");
    expect(metrics).toMatchObject({
      candidatePairs: 1,
      evaluatedPairs: 1,
      fuzzyComparisons: 0,
    });
  });
});

describe("2,000-row pipeline hardening", () => {
  const storage = new MemoryStorage();
  let result: ProcessBatchResult;
  let beforeBytes = 0;
  let pipelineWrites = 0;

  beforeAll(async () => {
    result = await processBatch([csvFile(generatedCsv(2000))], {
      ...fixedOptions,
      storage,
    });
    const persisted = loadState(storage);
    beforeBytes = serializedSizeBytes({
      ...persisted,
      currentBatch: persisted.currentBatch
        ? { ...persisted.currentBatch, ruleResults: result.ruleResults }
        : null,
    });
    pipelineWrites = storage.writes;
  }, 30_000);

  it("completes without throwing and exposes stage measurements", () => {
    expect(result.transactions).toHaveLength(2000);
    expect(result.persistence.success).toBe(true);
    expect(result.processingMetrics).toMatchObject({
      serializedStateBytes: expect.any(Number),
      duplicateDetection: { candidatePairs: 0, fuzzyComparisons: 0 },
    });
    expect(result.processingMetrics.ingestionMs).toBeGreaterThanOrEqual(0);
    expect(result.processingMetrics.rulesMs).toBeGreaterThanOrEqual(0);
    expect(result.processingMetrics.duplicateMs).toBeGreaterThanOrEqual(0);
    expect(result.processingMetrics.decisionsMs).toBeGreaterThanOrEqual(0);
    expect(result.processingMetrics.persistenceMs).toBeGreaterThanOrEqual(0);
    expect(pipelineWrites).toBe(2);
  });

  it("substantially reduces persisted size by dropping PASS results", () => {
    expect(result.processingMetrics.serializedStateBytes).toBeLessThan(
      beforeBytes * 0.5,
    );
    expect(getRuleResults(result.transactions[0].id, storage)).toEqual([]);
  });

  it("keeps decisions and meaningful audit history", () => {
    expect(result.decisions[result.transactions[0].id].status).toBe("AUTO_PASS");
    expect(getAuditEvents(result.transactions[0].id, storage)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "STATUS_ASSIGNED" }),
      ]),
    );
  });

  it("preserves reviewer history after the scale batch", () => {
    const transactionId = result.transactions[0].id;
    const review = applyReviewAction(
      { transactionId, action: "APPROVE", reviewer: "Scale Reviewer" },
      { storage, now: fixedOptions.now },
    );
    expect(review).toBeDefined();
    expect(getReviewActions(transactionId, storage).at(-1)?.reviewer).toBe(
      "Scale Reviewer",
    );
  });
});

describe("scale evidence and storage failure handling", () => {
  it("persists 2,000 pipeline records through the async adapter", async () => {
    const persistence = new MemoryPersistence();
    const analyzed = await processBatch([csvFile(generatedCsv(2000))], {
      ...fixedOptions,
      persistence,
    });
    expect(analyzed.persistence.success).toBe(true);
    expect(persistence.transactions.size).toBe(2000);
    expect(persistence.audits).toHaveLength(2001);
  }, 30_000);

  it("returns a controlled async persistence failure", async () => {
    const persistence = new MemoryPersistence();
    persistence.saveAnalyzedBatch = async () => ({
      success: false,
      serializedBytes: 0,
      serializationMs: 0,
      writeMs: 0,
      error: { code: "WRITE_FAILED", message: "IndexedDB write failed." },
    });
    const analyzed = await processBatch([csvFile(generatedCsv(1))], {
      ...fixedOptions,
      persistence,
    });
    expect(analyzed.transactions).toHaveLength(1);
    expect(analyzed.persistence).toMatchObject({ success: false, error: { code: "WRITE_FAILED" } });
  });

  it("retains failed rules, duplicate evidence, and unchanged decisions", async () => {
    const storage = new MemoryStorage();
    const csv = [
      "Vendor,Invoice,Invoice Date,Amount,Currency,Category,PO",
      "Contoso,INV-1,2026-09-19,10000.01,INR,Hotel,PO-1",
      "Contoso,INV-1,2026-09-19,10000.01,INR,Hotel,PO-1",
    ].join("\n");
    const analyzed = await processBatch([csvFile(csv)], {
      ...fixedOptions,
      storage,
    });
    const firstId = analyzed.transactions[0].id;

    expect(getRuleResults(firstId, storage)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "FAIL", ruleId: "LIMIT_HOTEL" }),
      ]),
    );
    expect(getDuplicateMatches(firstId, storage)[0].matchType).toBe("EXACT");
    expect(analyzed.decisions[firstId].status).toBe("HIGH_RISK");
  });

  it("returns a structured quota error instead of throwing", async () => {
    const analyzed = await processBatch([csvFile(generatedCsv(1))], {
      ...fixedOptions,
      storage: new QuotaStorage(),
    });
    expect(analyzed.transactions).toHaveLength(1);
    expect(analyzed.persistence).toMatchObject({
      success: false,
      error: { code: "QUOTA_EXCEEDED" },
    });
    expect(analyzed.auditEvents).toEqual([]);
  });

  it("preserves the 16-row decision and duplicate regression profile", async () => {
    const clean = Array.from(
      { length: 12 },
      (_, index) =>
        `Clean ${index},C-${index},2026-09-19,${200 + index},INR,Office,PO-${index}`,
    );
    const rows = [
      ...clean,
      "Meals Vendor,M-1,2026-09-19,2000.01,INR,Meals,PO-M",
      "Hotel Vendor,H-1,2026-09-19,10000.01,INR,Hotel,PO-H",
      "Duplicate Vendor,D-1,2026-09-19,100,INR,Office,PO-D1",
      "Duplicate Vendor,D-1,2026-09-19,100,INR,Office,PO-D2",
    ];
    const analyzed = await processBatch([
      csvFile(
        [
          "Vendor,Invoice,Invoice Date,Amount,Currency,Category,PO",
          ...rows,
        ].join("\n"),
      ),
    ], { ...fixedOptions, storage: new MemoryStorage() });

    expect(analyzed.batchSummary).toMatchObject({
      totalProcessed: 16,
      autoPassed: 12,
      needsReview: 1,
      highRisk: 3,
      duplicateCandidates: 2,
      potentialExposure: 10200.01,
    });
    expect(
      Object.values(analyzed.duplicateMatches)
        .flat()
        .every(({ matchType }) => matchType === "EXACT"),
    ).toBe(true);
  });
});
