import { describe, expect, it } from "vitest";

import { auditEventSchema } from "./audit";
import { batchSummarySchema, decisionSchema } from "./decisions";
import { duplicateMatchSchema } from "./duplicates";
import { ruleResultSchema } from "./rules";
import { transactionSchema } from "./transaction";

describe("shared contracts", () => {
  it("accepts a transaction with missing business fields", () => {
    expect(
      transactionSchema.parse({
        id: "transaction-1",
        batchId: "batch-1",
        sourceFile: "invoices.xlsx",
        sourceRow: 2,
        createdAt: "2026-09-19T00:00:00.000Z",
      }),
    ).toMatchObject({ id: "transaction-1", batchId: "batch-1" });
  });

  it("rejects unsupported rule, duplicate, and decision statuses", () => {
    expect(
      ruleResultSchema.safeParse({
        ruleId: "currency",
        ruleName: "Supported currency",
        status: "SKIP",
        severity: "MEDIUM",
        actualValue: "USD",
        expectedValue: "INR",
        explanation: "Currency is unsupported.",
      }).success,
    ).toBe(false);

    expect(
      duplicateMatchSchema.safeParse({
        currentTransactionId: "transaction-1",
        matchedTransactionId: "transaction-2",
        matchType: "SIMILAR",
        vendorSimilarity: 95,
        amountMatch: true,
        invoiceNumberMatch: false,
        dateDifferenceDays: 1,
        confidenceBand: "HIGH",
        evidence: ["Same amount"],
      }).success,
    ).toBe(false);

    expect(
      decisionSchema.safeParse({
        status: "APPROVED",
        riskPriority: 0,
        headline: "Clear",
        summary: "No issues found.",
        recommendedAction: "None",
      }).success,
    ).toBe(false);
  });

  it("accepts audit events and batch summaries", () => {
    expect(
      auditEventSchema.safeParse({
        id: "audit-1",
        transactionId: "transaction-1",
        batchId: "batch-1",
        timestamp: "2026-09-19T00:00:00.000Z",
        actorType: "SYSTEM",
        actorId: null,
        action: "DECISION_CREATED",
        oldStatus: null,
        newStatus: "AUTO_PASS",
        note: null,
      }).success,
    ).toBe(true);

    expect(
      batchSummarySchema.safeParse({
        totalProcessed: 10,
        autoPassed: 6,
        needsReview: 3,
        highRisk: 1,
        duplicateCandidates: 2,
        potentialExposure: 15000,
      }).success,
    ).toBe(true);
  });
});
