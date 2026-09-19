import type { Decision } from "../../types/decisions";
import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";
import {
  pluralizeDays,
  selectPrimaryFinding,
  type PrimaryFinding,
} from "./helpers";

function priority(base: number, findingCount: number): number {
  return Math.min(base + (findingCount > 1 ? 10 : 0), 100);
}

function policyDecision(
  finding: Extract<PrimaryFinding, { rule: RuleResult }>,
  riskPriority: number,
  highRisk: boolean,
): Decision {
  return {
    status: highRisk ? "HIGH_RISK" : "REVIEW",
    riskPriority,
    headline: `${finding.rule.ruleName} requires ${highRisk ? "immediate " : ""}review`,
    summary: finding.rule.explanation,
    recommendedAction: highRisk
      ? "Review the flagged high-severity policy exception before approval."
      : "Review the flagged policy exception before approval.",
  };
}

function duplicateDecision(
  finding: Extract<PrimaryFinding, { duplicate: DuplicateMatch }>,
  riskPriority: number,
): Decision {
  const match = finding.duplicate;

  if (finding.kind === "EXACT") {
    return {
      status: "HIGH_RISK",
      riskPriority,
      headline: "Exact duplicate requires immediate review",
      summary: `Transaction matches ${match.matchedTransactionId} on normalized vendor and invoice number.`,
      recommendedAction:
        "Verify whether the matched invoice has already been submitted or paid before releasing payment.",
    };
  }

  if (finding.kind === "PROBABLE") {
    const dateFact =
      match.dateDifferenceDays === null
        ? "with matching date evidence"
        : `with invoice dates ${pluralizeDays(match.dateDifferenceDays)} apart`;
    return {
      status: "REVIEW",
      riskPriority,
      headline: "Potential duplicate requires review",
      summary: `Transaction matches ${match.matchedTransactionId} on vendor and amount, ${dateFact}.`,
      recommendedAction: "Compare the transaction with the matched record before approval.",
    };
  }

  const similarityFact =
    match.vendorSimilarity === null
      ? ""
      : ` Vendor similarity is ${match.vendorSimilarity}%.`;
  return {
    status: "REVIEW",
    riskPriority,
    headline: "Similar transaction requires review",
    summary: `Vendor details are similar to ${match.matchedTransactionId} and the amount/date conditions also match.${similarityFact}`,
    recommendedAction: "Compare the transaction with the matched record before approval.",
  };
}

export function makeDecision(
  ruleResults: readonly RuleResult[],
  duplicateMatches: readonly DuplicateMatch[],
): Decision {
  const failedRules = ruleResults.filter(({ status }) => status === "FAIL");
  const findingCount = failedRules.length + duplicateMatches.length;
  const primary = selectPrimaryFinding(failedRules, duplicateMatches);

  if (!primary) {
    return {
      status: "AUTO_PASS",
      riskPriority: 0,
      headline: "Ready for automatic clearance",
      summary: "No policy exceptions or duplicate indicators were detected.",
      recommendedAction: "No manual review required.",
    };
  }

  if (primary.kind === "EXACT") {
    return duplicateDecision(primary, priority(90, findingCount));
  }

  if (primary.kind === "HIGH_RULE") {
    return policyDecision(primary, priority(80, findingCount), true);
  }

  if (primary.kind === "PROBABLE" || primary.kind === "FUZZY") {
    return duplicateDecision(primary, priority(50, findingCount));
  }

  return policyDecision(primary, priority(50, findingCount), false);
}
