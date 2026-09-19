import type { AuditEvent } from "../../src/types/audit";
import type { Decision } from "../../src/types/decisions";
import type { DuplicateMatch } from "../../src/types/duplicates";
import type { RuleResult } from "../../src/types/rules";
import type { Transaction } from "../../src/types/transaction";
import type { AnalyzedBatchInput } from "../../src/lib/storage";

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
    transactions: [storedTransaction],
    ruleResults: { "TXN-001": [storedRule] },
    duplicateMatches: { "TXN-001": [storedDuplicate] },
    decisions: { "TXN-001": storedDecision },
    auditEvents: [storedAuditEvent],
  };
}
