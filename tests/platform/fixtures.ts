import type { Decision } from "../../src/types/decisions";
import type { Transaction } from "../../src/types/transaction";
import type { AuthenticatedPrincipal, ServerBatchBundle, UserRecord } from "../../src/server/platform";

export const fixedNow = new Date("2026-09-24T12:00:00.000Z");

export const principals: Record<"admin" | "manager" | "reviewer" | "auditor" | "outsider", AuthenticatedPrincipal> = {
  admin: { userId: "admin-1", email: "admin@alpha.test", displayName: "Admin", organizationId: "org-alpha", organizationName: "Alpha", role: "ADMIN" },
  manager: { userId: "manager-1", email: "manager@alpha.test", displayName: "Manager", organizationId: "org-alpha", organizationName: "Alpha", role: "FINANCE_MANAGER" },
  reviewer: { userId: "reviewer-1", email: "reviewer@alpha.test", displayName: "Reviewer", organizationId: "org-alpha", organizationName: "Alpha", role: "REVIEWER" },
  auditor: { userId: "auditor-1", email: "auditor@alpha.test", displayName: "Auditor", organizationId: "org-alpha", organizationName: "Alpha", role: "AUDITOR" },
  outsider: { userId: "outside-1", email: "outside@beta.test", displayName: "Outsider", organizationId: "org-beta", organizationName: "Beta", role: "ADMIN" },
};

export function users(): UserRecord[] {
  return Object.values(principals).map((principal) => ({
    id: principal.userId,
    organizationId: principal.organizationId,
    email: principal.email,
    displayName: principal.displayName,
    role: principal.role,
    active: true,
    createdAt: fixedNow.toISOString(),
  }));
}

function transaction(index: number, values: Partial<Transaction> = {}): Transaction {
  return {
    id: `TXN-${index}`,
    batchId: "batch-alpha",
    vendorName: `Vendor ${index}`,
    normalizedVendor: `vendor ${index}`,
    invoiceNumber: `INV-${index}`,
    invoiceDate: `2026-09-${String(10 + index).padStart(2, "0")}`,
    amount: index * 1000,
    currency: "INR",
    expenseCategory: index === 2 ? "Meals" : "Hotel",
    employeeId: `EMP-${index}`,
    department: index % 2 ? "Finance" : "Sales",
    purchaseOrder: `PO-${index}`,
    description: `Transaction ${index}`,
    sourceFile: "finance.xlsx",
    sourceSheet: "Invoices",
    sourceRow: index + 1,
    createdAt: new Date(fixedNow.getTime() - index * 3 * 86_400_000).toISOString(),
    ...values,
  };
}

function decision(status: Decision["status"], headline: string): Decision {
  return { status, riskPriority: status === "HIGH_RISK" ? 90 : status === "REVIEW" ? 50 : 0, headline, summary: headline, recommendedAction: "Review evidence." };
}

export function bundle(): ServerBatchBundle {
  const transactions = [
    transaction(1, { vendorName: "Contoso", amount: 14000 }),
    transaction(2, { vendorName: "Fabrikam", amount: 2500 }),
    transaction(3, { vendorName: "Duplicate Vendor", invoiceNumber: "DUP-1", amount: 100 }),
    transaction(4, { vendorName: "Duplicate Vendor", invoiceNumber: "DUP-1", amount: 100 }),
    transaction(5, { vendorName: "Clean Vendor", amount: 500, expenseCategory: "Office" }),
  ];
  const decisions = {
    "TXN-1": decision("HIGH_RISK", "Hotel policy exception"),
    "TXN-2": decision("REVIEW", "Meals policy exception"),
    "TXN-3": decision("HIGH_RISK", "Exact duplicate"),
    "TXN-4": decision("HIGH_RISK", "Exact duplicate"),
    "TXN-5": decision("AUTO_PASS", "Ready for automatic clearance"),
  };
  const duplicate = {
    matchType: "EXACT" as const,
    vendorSimilarity: 100,
    amountMatch: true,
    invoiceNumberMatch: true,
    dateDifferenceDays: 0,
    confidenceBand: "HIGH" as const,
    evidence: ["Same normalized vendor", "Same invoice number"],
  };
  return {
    batch: {
      id: "batch-alpha", organizationId: "org-alpha", uploadedBy: "admin-1",
      uploadedAt: "2026-09-01T00:00:00.000Z", processedAt: "2026-09-01T00:05:00.000Z",
      updatedAt: "2026-09-01T00:05:00.000Z", status: "COMPLETED", policyVersionId: "policy-v1",
      fileCount: 1, filesProcessed: 1, processingErrors: [],
      summary: { totalProcessed: 5, autoPassed: 1, needsReview: 1, highRisk: 3, duplicateCandidates: 2, potentialExposure: 14200 },
    },
    sourceFiles: [{
      id: "file-1", organizationId: "org-alpha", batchId: "batch-alpha", originalFilename: "finance.xlsx",
      storageFilename: "safe.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byteSize: 100, sha256: "abc", scanStatus: "PENDING_SCAN", uploadedAt: "2026-09-01T00:00:00.000Z",
    }],
    transactions,
    ruleResults: {
      "TXN-1": [{ ruleId: "LIMIT_HOTEL", ruleName: "Hotel limit", status: "FAIL", severity: "HIGH", actualValue: 14000, expectedValue: 10000, explanation: "Hotel amount exceeds policy." }],
      "TXN-2": [{ ruleId: "LIMIT_MEALS", ruleName: "Meals limit", status: "FAIL", severity: "MEDIUM", actualValue: 2500, expectedValue: 2000, explanation: "Meals amount exceeds policy." }],
    },
    duplicateMatches: {
      "TXN-1": [], "TXN-2": [],
      "TXN-3": [{ currentTransactionId: "TXN-3", matchedTransactionId: "TXN-4", ...duplicate }],
      "TXN-4": [{ currentTransactionId: "TXN-4", matchedTransactionId: "TXN-3", ...duplicate }],
      "TXN-5": [],
    },
    decisions,
    auditEvents: [{ id: "audit-1", organizationId: "org-alpha", timestamp: "2026-09-01T00:05:00.000Z", actorId: null, actorRole: "SYSTEM", action: "PROCESSING_COMPLETED", batchId: "batch-alpha" }],
  };
}
