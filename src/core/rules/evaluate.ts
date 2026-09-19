import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import { ruleEvaluators } from "./evaluators";
import { toReferenceDate } from "./helpers";
import type { RuleEvaluationOptions } from "./types";

export function evaluateRules(
  transaction: Transaction,
  options: RuleEvaluationOptions = {},
): RuleResult[] {
  const referenceDate = toReferenceDate(options.referenceDate ?? new Date());
  const context = { referenceDate };
  return ruleEvaluators.map((evaluate) => evaluate(transaction, context));
}
