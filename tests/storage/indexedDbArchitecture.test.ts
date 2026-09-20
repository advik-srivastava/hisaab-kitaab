import { describe, expect, it } from "vitest";

import { applyReviewActionAsync } from "../../src/core/audit";
import {
  DATABASE_NAME,
  OBJECT_STORES,
  getAuditEventsAsync,
  getDecisionAsync,
  getDuplicateMatchesAsync,
  getRuleResultsAsync,
  getTransactionAsync,
  resetDemoDataAsync,
  saveAnalyzedBatchAsync,
  type AnalyzedBatchInput,
} from "../../src/lib/storage";
import type { RuleResult } from "../../src/types/rules";
import { analyzedBatch, storedDecision, storedRule, storedTransaction } from "./fixtures";
import { MemoryPersistence } from "./memoryPersistence";

const passRule: RuleResult = { ...storedRule, status: "PASS" };

describe("async normalized persistence", () => {
  it("defines the IndexedDB database and normalized stores", () => {
    expect(DATABASE_NAME).toBe("hisaab-kitaab");
    expect(Object.values(OBJECT_STORES)).toEqual([
      "batches",
      "transactions",
      "ruleResults",
      "duplicateMatches",
      "decisions",
      "reviewState",
      "auditEvents",
    ]);
  });

  it("reloads summary, transaction, failed rules, duplicates, decision, and audit", async () => {
    const persistence = new MemoryPersistence();
    const input = analyzedBatch();
    await saveAnalyzedBatchAsync(input, persistence);
    expect((await persistence.getCurrentBatch())?.batchSummary).toEqual(input.batchSummary);
    expect(await getTransactionAsync("TXN-001", persistence)).toEqual(storedTransaction);
    expect(await getRuleResultsAsync("TXN-001", persistence)).toEqual([storedRule]);
    expect(await getDuplicateMatchesAsync("TXN-001", persistence)).toEqual(input.duplicateMatches["TXN-001"]);
    expect(await getDecisionAsync("TXN-001", persistence)).toEqual(storedDecision);
    expect(await getAuditEventsAsync("TXN-001", persistence)).toEqual(input.auditEvents);
  });

  it.each(["APPROVE", "REJECT", "MARK_NOT_DUPLICATE"] as const)(
    "%s persists review and audit history without changing evidence",
    async (action) => {
      const persistence = new MemoryPersistence();
      const input = analyzedBatch();
      await saveAnalyzedBatchAsync(input, persistence);
      const result = await applyReviewActionAsync(
        { transactionId: "TXN-001", action, reviewer: "Finance Reviewer" },
        { persistence, now: () => new Date("2026-09-20T12:00:00.000Z") },
      );
      expect(result?.persistence.success).toBe(true);
      expect((await persistence.getReviewActions("TXN-001")).at(-1)?.action).toBe(action);
      expect((await persistence.getAuditEvents("TXN-001")).at(-1)?.action).toBe(action);
      expect(await getDuplicateMatchesAsync("TXN-001", persistence)).toEqual(input.duplicateMatches["TXN-001"]);
      expect(await getDecisionAsync("TXN-001", persistence)).toEqual(storedDecision);
    },
  );

  it("stores 10,000 records without a localStorage state blob", async () => {
    const persistence = new MemoryPersistence();
    const transactions = Array.from({ length: 10_000 }, (_, index) => ({
      ...storedTransaction,
      id: `TXN-${index}`,
      invoiceNumber: `INV-${index}`,
      sourceRow: index + 2,
    }));
    const input: AnalyzedBatchInput = {
      batchId: "batch-1",
      createdAt: storedTransaction.createdAt,
      transactions,
      ruleResults: Object.fromEntries(transactions.map(({ id }, index) => [id, index ? [passRule] : [passRule, storedRule]])),
      duplicateMatches: Object.fromEntries(transactions.map(({ id }) => [id, []])),
      decisions: Object.fromEntries(transactions.map(({ id }) => [id, storedDecision])),
    };
    expect((await saveAnalyzedBatchAsync(input, persistence)).persistence.success).toBe(true);
    expect(persistence.transactions.size).toBe(10_000);
    expect(persistence.rules.get("TXN-0")).toEqual([storedRule]);
    expect(persistence.rules.get("TXN-9999")).toEqual([]);
  });

  it("reset clears async application state", async () => {
    const persistence = new MemoryPersistence();
    await saveAnalyzedBatchAsync(analyzedBatch(), persistence);
    await resetDemoDataAsync(persistence);
    expect(await persistence.getCurrentBatch()).toBeUndefined();
  });
});
