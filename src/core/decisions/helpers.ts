import type { DuplicateMatch } from "../../types/duplicates";
import type { RuleResult } from "../../types/rules";

export type PrimaryFinding =
  | { kind: "EXACT"; duplicate: DuplicateMatch }
  | { kind: "PROBABLE"; duplicate: DuplicateMatch }
  | { kind: "FUZZY"; duplicate: DuplicateMatch }
  | { kind: "HIGH_RULE"; rule: RuleResult }
  | { kind: "MEDIUM_RULE"; rule: RuleResult }
  | { kind: "LOW_RULE"; rule: RuleResult };

export function selectPrimaryFinding(
  failedRules: readonly RuleResult[],
  duplicateMatches: readonly DuplicateMatch[],
): PrimaryFinding | undefined {
  const exact = duplicateMatches.find(({ matchType }) => matchType === "EXACT");
  if (exact) return { kind: "EXACT", duplicate: exact };

  const highRule = failedRules.find(({ severity }) => severity === "HIGH");
  if (highRule) return { kind: "HIGH_RULE", rule: highRule };

  const probable = duplicateMatches.find(({ matchType }) => matchType === "PROBABLE");
  if (probable) return { kind: "PROBABLE", duplicate: probable };

  const fuzzy = duplicateMatches.find(({ matchType }) => matchType === "FUZZY");
  if (fuzzy) return { kind: "FUZZY", duplicate: fuzzy };

  const mediumRule = failedRules.find(({ severity }) => severity === "MEDIUM");
  if (mediumRule) return { kind: "MEDIUM_RULE", rule: mediumRule };

  const lowRule = failedRules.find(({ severity }) => severity === "LOW");
  return lowRule ? { kind: "LOW_RULE", rule: lowRule } : undefined;
}

export function pluralizeDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
