import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXCEPTION_PAGE_SIZE,
  getExceptionsPage,
  saveAnalyzedBatchAsync,
  type AnalyzedBatchInput,
} from "../../src/lib/storage";
import type { Decision, DecisionStatus } from "../../src/types/decisions";
import type { Transaction } from "../../src/types/transaction";
import { storedTransaction } from "./fixtures";
import { MemoryPersistence } from "./memoryPersistence";

function decision(status: DecisionStatus): Decision {
  return {
    status,
    riskPriority: status === "HIGH_RISK" ? 80 : status === "REVIEW" ? 50 : 0,
    headline: `${status} transaction`,
    summary: `${status} summary`,
    recommendedAction: `${status} action`,
  };
}

function batch(statuses: DecisionStatus[]): AnalyzedBatchInput {
  const transactions: Transaction[] = statuses.map((status, index) => ({
    ...storedTransaction,
    id: `TXN-${String(index).padStart(5, "0")}`,
    invoiceNumber: `INV-${index}`,
    sourceRow: index + 2,
  }));
  return {
    batchId: storedTransaction.batchId,
    createdAt: storedTransaction.createdAt,
    transactions,
    ruleResults: Object.fromEntries(transactions.map(({ id }) => [id, []])),
    duplicateMatches: Object.fromEntries(transactions.map(({ id }) => [id, []])),
    decisions: Object.fromEntries(
      transactions.map(({ id }, index) => [id, decision(statuses[index])]),
    ),
  };
}

async function storedBatch(statuses: DecisionStatus[]) {
  const persistence = new MemoryPersistence();
  await saveAnalyzedBatchAsync(batch(statuses), persistence);
  return persistence;
}

describe("exception storage pagination", () => {
  it("returns bounded pages with correct totals, remainders, and boundaries", async () => {
    const persistence = await storedBatch([
      ...Array<DecisionStatus>(63).fill("HIGH_RISK"),
      ...Array<DecisionStatus>(54).fill("REVIEW"),
      ...Array<DecisionStatus>(20).fill("AUTO_PASS"),
    ]);
    const first = await getExceptionsPage({ batchId: "batch-1" }, persistence);
    const second = await getExceptionsPage({ batchId: "batch-1", page: 2 }, persistence);
    const final = await getExceptionsPage({ batchId: "batch-1", page: 3 }, persistence);

    expect(first.pageSize).toBe(DEFAULT_EXCEPTION_PAGE_SIZE);
    expect(first.items).toHaveLength(50);
    expect(first.totalItems).toBe(117);
    expect(first.totalPages).toBe(3);
    expect(second.items).toHaveLength(50);
    expect(second.items[0].transaction.id).toBe("TXN-00050");
    expect(final.items).toHaveLength(17);
    expect(first.page <= 1).toBe(true);
    expect(final.page >= final.totalPages).toBe(true);
  });

  it("filters statuses and always excludes automatic passes", async () => {
    const persistence = await storedBatch([
      "AUTO_PASS", "REVIEW", "HIGH_RISK", "REVIEW", "AUTO_PASS", "HIGH_RISK",
    ]);
    const all = await getExceptionsPage({ batchId: "batch-1" }, persistence);
    const highRisk = await getExceptionsPage(
      { batchId: "batch-1", status: "HIGH_RISK" },
      persistence,
    );
    const review = await getExceptionsPage(
      { batchId: "batch-1", status: "REVIEW" },
      persistence,
    );

    expect(all.items.map(({ decision: item }) => item.status)).toEqual([
      "HIGH_RISK", "HIGH_RISK", "REVIEW", "REVIEW",
    ]);
    expect(highRisk.totalItems).toBe(2);
    expect(highRisk.items.every(({ decision: item }) => item.status === "HIGH_RISK")).toBe(true);
    expect(review.totalItems).toBe(2);
    expect(review.items.every(({ decision: item }) => item.status === "REVIEW")).toBe(true);
  });

  it("uses deterministic status and insertion ordering without page duplicates", async () => {
    const statuses = Array.from<unknown, DecisionStatus>({ length: 123 }, (_, index) =>
      index % 3 === 0 ? "HIGH_RISK" : "REVIEW",
    );
    const persistence = await storedBatch(statuses);
    const pages = await Promise.all([1, 2, 3].map((page) =>
      getExceptionsPage({ batchId: "batch-1", page }, persistence),
    ));
    const ids = pages.flatMap(({ items }) => items.map(({ transaction }) => transaction.id));
    const repeated = await getExceptionsPage({ batchId: "batch-1" }, persistence);

    expect(new Set(ids).size).toBe(ids.length);
    const ranks = ids.map((id) => persistence.decisions.get(id)?.status === "HIGH_RISK" ? 0 : 1);
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    expect(repeated.items).toEqual(pages[0].items);
  });

  it.each([2_000, 10_000])(
    "returns only the first 50 exceptions from %,i stored rows without full-batch loading",
    async (rowCount) => {
      const statuses = Array.from<unknown, DecisionStatus>({ length: rowCount }, (_, index) =>
        index % 5 === 0 ? "AUTO_PASS" : index % 2 === 0 ? "HIGH_RISK" : "REVIEW",
      );
      const persistence = await storedBatch(statuses);
      const page = await getExceptionsPage({ batchId: "batch-1" }, persistence);

      expect(page.items).toHaveLength(50);
      expect(page.totalItems).toBe(statuses.filter((status) => status !== "AUTO_PASS").length);
      expect(persistence.getCurrentBatchCalls).toBe(0);
      expect(page.queryMs).toBeGreaterThanOrEqual(0);
    },
  );

  it("keeps filtered totals correct at 10,000-row scale", async () => {
    const statuses = Array.from<unknown, DecisionStatus>({ length: 10_000 }, (_, index) =>
      index % 4 === 0 ? "HIGH_RISK" : index % 4 === 1 ? "REVIEW" : "AUTO_PASS",
    );
    const persistence = await storedBatch(statuses);
    const highRisk = await getExceptionsPage(
      { batchId: "batch-1", status: "HIGH_RISK" },
      persistence,
    );
    const review = await getExceptionsPage(
      { batchId: "batch-1", status: "REVIEW" },
      persistence,
    );

    expect(highRisk.items).toHaveLength(50);
    expect(highRisk.totalItems).toBe(2_500);
    expect(review.items).toHaveLength(50);
    expect(review.totalItems).toBe(2_500);
    expect(persistence.getCurrentBatchCalls).toBe(0);
  });
});
