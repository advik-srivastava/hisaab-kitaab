import { describe, expect, it } from "vitest";

import type { AuditEvent } from "../../src/types/audit";
import type { Decision } from "../../src/types/decisions";
import type { DuplicateMatch } from "../../src/types/duplicates";
import type { RuleResult } from "../../src/types/rules";
import type { Transaction } from "../../src/types/transaction";
import {
  STORAGE_KEY,
  clearState,
  createInitialState,
  getAuditEvents,
  getDecision,
  getDuplicateMatches,
  getRuleResults,
  getTransaction,
  loadState,
  resetDemoData,
  saveAnalyzedBatch,
  saveState,
  type AnalyzedBatchInput,
} from "../../src/lib/storage";
import { MemoryStorage } from "./memoryStorage";

export const storedTransaction: Transaction = {
  id: "TXN-001",
  batchId: "batch-1",
  vendorName: "Contoso Ltd",
  normalizedVendor: "contoso ltd",
  invoiceNumber: "INV-001",
  invoiceDate: "2026-09-19",
  amount: 18500,
  currency: "INR",
  expenseCategory: "Hotel",
  employeeId: undefined,
  department: "Finance",
  purchaseOrder: undefined,
  description: undefined,
  sourceFile: "transactions.csv",
  sourceSheet: "CSV",
  sourceRow: 2,
  createdAt: "2026-09-19T00:00:00.000Z",
};

export const storedRule: RuleResult = {
  ruleId: "LIMIT_HOTEL",
  ruleName: "Hotel expense limit",
  status: "FAIL",
  severity: "HIGH",
  actualValue: 18500,
  expectedValue: 10000,
  explanation: "Hotel amount ₹18,500 exceeds the configured ₹10,000 policy limit.",
};

export const storedDuplicate: DuplicateMatch = {
  currentTransactionId: "TXN-001",
  matchedTransactionId: "TXN-009",
  matchType: "EXACT",
  vendorSimilarity: 100,
  amountMatch: true,
  invoiceNumberMatch: true,
  dateDifferenceDays: 0,
  confidenceBand: "HIGH",
  evidence: ["Same normalized vendor.", "Same invoice number."],
};

export const storedDecision: Decision = {
  status: "HIGH_RISK",
  riskPriority: 100,
  headline: "Exact duplicate requires immediate review",
  summary: "Transaction matches TXN-009 on normalized vendor and invoice number.",
  recommendedAction: "Verify the matched invoice before releasing payment.",
};

export const storedAuditEvent: AuditEvent = {
  id: "audit-1",
  transactionId: "TXN-001",
  batchId: "batch-1",
  timestamp: "2026-09-19T01:00:00.000Z",
  actorType: "SYSTEM",
  actorId: null,
  action: "STATUS_ASSIGNED",
  oldStatus: null,
  newStatus: "HIGH_RISK",
  note: null,
};

export function analyzedBatch(): AnalyzedBatchInput {
  return {
    batchId: "batch-1",
    createdAt: "2026-09-19T00:00:00.000Z",
    batchSummary: {
      totalProcessed: 1,
      autoPassed: 0,
      needsReview: 0,
      highRisk: 1,
      duplicateCandidates: 1,
      potentialExposure: 18500,
    },
    transactions: [storedTransaction],
    ruleResults: { "TXN-001": [storedRule] },
    duplicateMatches: { "TXN-001": [storedDuplicate] },
    decisions: { "TXN-001": storedDecision },
    auditEvents: [storedAuditEvent],
  };
}

describe("browser-safe persisted storage", () => {
  it("loads default state from empty storage", () => {
    expect(loadState(new MemoryStorage())).toEqual(createInitialState());
  });

  it("saves and loads state", () => {
    const storage = new MemoryStorage();
    const state = saveAnalyzedBatch(analyzedBatch(), storage);
    expect(saveState(state, storage)).toBe(true);
    expect(loadState(storage)).toEqual(state);
  });

  it("persists a transaction", () => {
    const storage = new MemoryStorage();
    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(getTransaction("TXN-001", storage)).toEqual(storedTransaction);
  });

  it("persists rule results", () => {
    const storage = new MemoryStorage();
    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(getRuleResults("TXN-001", storage)).toEqual([storedRule]);
  });

  it("persists duplicate evidence", () => {
    const storage = new MemoryStorage();
    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(getDuplicateMatches("TXN-001", storage)).toEqual([storedDuplicate]);
  });

  it("persists a system decision", () => {
    const storage = new MemoryStorage();
    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(getDecision("TXN-001", storage)).toEqual(storedDecision);
  });

  it("persists audit events", () => {
    const storage = new MemoryStorage();
    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(getAuditEvents("TXN-001", storage)).toEqual([storedAuditEvent]);
  });

  it("persists BatchSummary across save and load", () => {
    const storage = new MemoryStorage();
    const input = analyzedBatch();
    saveAnalyzedBatch(input, storage);
    expect(loadState(storage).currentBatch?.batchSummary).toEqual(
      input.batchSummary,
    );
  });

  it("clear and reset restore empty state", () => {
    const storage = new MemoryStorage();
    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(loadState(storage).currentBatch?.batchSummary).toBeDefined();
    clearState(storage);
    expect(loadState(storage)).toEqual(createInitialState());

    saveAnalyzedBatch(analyzedBatch(), storage);
    expect(resetDemoData(storage)).toEqual(createInitialState());
    expect(loadState(storage)).toEqual(createInitialState());
  });

  it("loads older v1 batch data without a summary", () => {
    const storage = new MemoryStorage();
    const legacyInput = analyzedBatch();
    delete legacyInput.batchSummary;
    saveAnalyzedBatch(legacyInput, storage);
    const loaded = loadState(storage).currentBatch;
    expect(loaded?.batchId).toBe("batch-1");
    expect(loaded?.transactions[0].id).toBe(storedTransaction.id);
    expect(loaded?.batchSummary).toBeUndefined();
  });

  it("falls back safely for invalid JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{invalid json");
    expect(loadState(storage)).toEqual(createInitialState());
  });

  it("falls back safely for unsupported versions and wrong shapes", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, currentBatch: null }));
    expect(loadState(storage)).toEqual(createInitialState());

    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, currentBatch: {} }));
    expect(loadState(storage)).toEqual(createInitialState());
  });

  it("is safe without window during SSR or Node execution", () => {
    expect(() => loadState()).not.toThrow();
    expect(() => clearState()).not.toThrow();
    expect(saveState(createInitialState())).toBe(false);
  });
});
