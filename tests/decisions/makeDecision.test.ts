import { describe, expect, it } from "vitest";

import { makeDecision } from "../../src/core/decisions";
import { decisionSchema } from "../../src/types/decisions";
import type { DuplicateMatch, DuplicateMatchType } from "../../src/types/duplicates";
import type { RuleResult, RuleSeverity } from "../../src/types/rules";

function ruleResult(
  status: "PASS" | "FAIL",
  severity: RuleSeverity = "MEDIUM",
  overrides: Partial<RuleResult> = {},
): RuleResult {
  return {
    ruleId: "LIMIT_HOTEL",
    ruleName: "Hotel policy exception",
    status,
    severity,
    actualValue: 14500,
    expectedValue: 10000,
    explanation: "Hotel amount ₹14,500 exceeds the configured ₹10,000 policy limit.",
    ...overrides,
  };
}

function duplicateMatch(
  matchType: DuplicateMatchType,
  overrides: Partial<DuplicateMatch> = {},
): DuplicateMatch {
  return {
    currentTransactionId: "TXN-001",
    matchedTransactionId: "TXN-009",
    matchType,
    vendorSimilarity: matchType === "FUZZY" ? 94 : 100,
    amountMatch: true,
    invoiceNumberMatch: matchType === "EXACT",
    dateDifferenceDays: 2,
    confidenceBand: matchType === "FUZZY" ? "MEDIUM" : "HIGH",
    evidence: [
      "Potential duplicate detected with TXN-009.",
      "Same amount: ₹18,500.",
      "Invoice dates are 2 days apart.",
    ],
    ...overrides,
  };
}

describe("AUTO_PASS decisions", () => {
  it("returns AUTO_PASS for no findings", () => {
    expect(makeDecision([], [])).toMatchObject({
      status: "AUTO_PASS",
      headline: "Ready for automatic clearance",
    });
  });

  it("returns AUTO_PASS when all rules pass", () => {
    expect(
      makeDecision([
        ruleResult("PASS", "HIGH"),
        ruleResult("PASS", "MEDIUM"),
      ], []),
    ).toMatchObject({ status: "AUTO_PASS" });
  });

  it("uses priority zero for AUTO_PASS", () => {
    expect(makeDecision([], []).riskPriority).toBe(0);
  });

  it("does not imply that payment occurred", () => {
    const decision = makeDecision([], []);
    expect(`${decision.headline} ${decision.summary} ${decision.recommendedAction}`)
      .not.toMatch(/paid|payment (?:was|has been)/i);
  });
});

describe("REVIEW decisions", () => {
  it("returns REVIEW for one MEDIUM rule failure", () => {
    expect(makeDecision([ruleResult("FAIL", "MEDIUM")], [])).toMatchObject({
      status: "REVIEW",
      riskPriority: 50,
    });
  });

  it("returns REVIEW for one LOW rule failure", () => {
    expect(makeDecision([ruleResult("FAIL", "LOW")], [])).toMatchObject({
      status: "REVIEW",
      riskPriority: 50,
    });
  });

  it("returns REVIEW for a probable duplicate", () => {
    expect(makeDecision([], [duplicateMatch("PROBABLE")])).toMatchObject({
      status: "REVIEW",
      riskPriority: 50,
      headline: "Potential duplicate requires review",
    });
  });

  it("returns REVIEW for a fuzzy duplicate", () => {
    expect(makeDecision([], [duplicateMatch("FUZZY")])).toMatchObject({
      status: "REVIEW",
      riskPriority: 50,
      headline: "Similar transaction requires review",
    });
  });

  it("increases priority once for multiple REVIEW findings", () => {
    expect(
      makeDecision(
        [ruleResult("FAIL", "MEDIUM")],
        [duplicateMatch("PROBABLE")],
      ).riskPriority,
    ).toBe(60);
  });

  it("does not become HIGH_RISK without a HIGH condition", () => {
    const decision = makeDecision(
      [ruleResult("FAIL", "LOW"), ruleResult("FAIL", "MEDIUM")],
      [duplicateMatch("FUZZY"), duplicateMatch("PROBABLE")],
    );
    expect(decision).toMatchObject({ status: "REVIEW", riskPriority: 60 });
  });

  it("selects PROBABLE before FUZZY regardless of their input order", () => {
    const decision = makeDecision([], [
      duplicateMatch("FUZZY", { matchedTransactionId: "TXN-021" }),
      duplicateMatch("PROBABLE", { matchedTransactionId: "TXN-014" }),
    ]);
    expect(decision.summary).toContain("TXN-014");
  });

  it("selects MEDIUM before LOW while preserving order within severity", () => {
    const decision = makeDecision([
      ruleResult("FAIL", "LOW", { ruleName: "Low rule" }),
      ruleResult("FAIL", "MEDIUM", {
        ruleName: "First medium",
        explanation: "First medium explanation.",
      }),
      ruleResult("FAIL", "MEDIUM", {
        ruleName: "Second medium",
        explanation: "Second medium explanation.",
      }),
    ], []);
    expect(decision.summary).toBe("First medium explanation.");
  });
});

describe("HIGH_RISK decisions", () => {
  it("returns HIGH_RISK for a HIGH rule failure", () => {
    expect(makeDecision([ruleResult("FAIL", "HIGH")], [])).toMatchObject({
      status: "HIGH_RISK",
      riskPriority: 80,
    });
  });

  it("returns HIGH_RISK for an exact duplicate", () => {
    expect(makeDecision([], [duplicateMatch("EXACT")]).status).toBe("HIGH_RISK");
  });

  it("uses priority 90 for a lone exact duplicate", () => {
    expect(makeDecision([], [duplicateMatch("EXACT")]).riskPriority).toBe(90);
  });

  it("increases a HIGH rule priority for an additional issue", () => {
    expect(
      makeDecision(
        [ruleResult("FAIL", "HIGH"), ruleResult("FAIL", "MEDIUM")],
        [],
      ).riskPriority,
    ).toBe(90);
  });

  it("caps priority at 100", () => {
    const decision = makeDecision(
      [
        ruleResult("FAIL", "HIGH"),
        ruleResult("FAIL", "MEDIUM"),
        ruleResult("FAIL", "LOW"),
      ],
      [duplicateMatch("EXACT"), duplicateMatch("PROBABLE")],
    );
    expect(decision.riskPriority).toBe(100);
  });

  it("uses exact duplicate as primary reason over a HIGH rule", () => {
    const decision = makeDecision(
      [ruleResult("FAIL", "HIGH")],
      [duplicateMatch("EXACT")],
    );
    expect(decision).toMatchObject({
      status: "HIGH_RISK",
      headline: "Exact duplicate requires immediate review",
    });
  });

  it("lets a HIGH rule override a probable duplicate", () => {
    const decision = makeDecision(
      [ruleResult("FAIL", "HIGH")],
      [duplicateMatch("PROBABLE")],
    );
    expect(decision).toMatchObject({
      status: "HIGH_RISK",
      summary: "Hotel amount ₹14,500 exceeds the configured ₹10,000 policy limit.",
    });
  });

  it("lets a HIGH rule override a fuzzy duplicate", () => {
    expect(
      makeDecision(
        [ruleResult("FAIL", "HIGH")],
        [duplicateMatch("FUZZY")],
      ).status,
    ).toBe("HIGH_RISK");
  });
});

describe("decision explainability", () => {
  it("includes the matched transaction ID in exact summary", () => {
    expect(
      makeDecision([], [
        duplicateMatch("EXACT", { matchedTransactionId: "TXN-777" }),
      ]).summary,
    ).toContain("TXN-777");
  });

  it("uses matched probable evidence fields in the summary", () => {
    const summary = makeDecision([], [
      duplicateMatch("PROBABLE", {
        matchedTransactionId: "TXN-014",
        dateDifferenceDays: 2,
      }),
    ]).summary;
    expect(summary).toContain("TXN-014");
    expect(summary).toContain("vendor and amount");
    expect(summary).toContain("2 days apart");
  });

  it("states fuzzy similarity as a fact, not a probability", () => {
    const summary = makeDecision([], [
      duplicateMatch("FUZZY", { vendorSimilarity: 94 }),
    ]).summary;
    expect(summary).toContain("Vendor similarity is 94%.");
    expect(summary).not.toMatch(/chance|probability/i);
  });

  it("reuses the selected RuleResult explanation", () => {
    const explanation = "Configured policy amount was exceeded by ₹4,500.";
    expect(
      makeDecision([
        ruleResult("FAIL", "MEDIUM", { explanation }),
      ], []).summary,
    ).toBe(explanation);
  });

  it("does not use fraud wording", () => {
    const decisions = [
      makeDecision([], []),
      makeDecision([ruleResult("FAIL", "HIGH")], []),
      makeDecision([], [duplicateMatch("EXACT")]),
      makeDecision([], [duplicateMatch("PROBABLE")]),
      makeDecision([], [duplicateMatch("FUZZY")]),
    ];
    expect(JSON.stringify(decisions)).not.toMatch(/fraud|criminal/i);
  });

  it("does not use AI-belief wording", () => {
    const decision = makeDecision([], [duplicateMatch("FUZZY")]);
    expect(JSON.stringify(decision)).not.toMatch(/AI believes/i);
  });

  it("returns the same Decision for the same input", () => {
    const rules = [ruleResult("FAIL", "MEDIUM")];
    const duplicates = [duplicateMatch("PROBABLE")];
    expect(makeDecision(rules, duplicates)).toEqual(makeDecision(rules, duplicates));
  });

  it("does not let PASS results increase priority", () => {
    const decision = makeDecision([
      ruleResult("FAIL", "MEDIUM"),
      ruleResult("PASS", "HIGH"),
      ruleResult("PASS", "MEDIUM"),
    ], []);
    expect(decision.riskPriority).toBe(50);
  });

  it("handles empty inputs without throwing", () => {
    expect(() => makeDecision([], [])).not.toThrow();
  });

  it("returns only fields in the existing Decision contract", () => {
    const decision = makeDecision([], [duplicateMatch("EXACT")]);
    expect(decisionSchema.safeParse(decision).success).toBe(true);
    expect(Object.keys(decision).sort()).toEqual([
      "headline",
      "recommendedAction",
      "riskPriority",
      "status",
      "summary",
    ]);
  });
});
