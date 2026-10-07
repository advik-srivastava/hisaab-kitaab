import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import { defaultFinancePolicy } from "../../config/defaultPolicy";
import { createExpenseLimitEvaluators, ruleEvaluators } from "./evaluators";
import { toReferenceDate } from "./helpers";
import type { RuleEvaluationOptions } from "./types";

export function evaluateRules(
  transaction: Transaction,
  options: RuleEvaluationOptions = {},
): RuleResult[] {
  const referenceDate = toReferenceDate(options.referenceDate ?? new Date());
  const policy = options.policy ?? defaultFinancePolicy;
  const context = { referenceDate, policy };
  const evaluators = [
    ...ruleEvaluators.slice(0, -1),
    ...createExpenseLimitEvaluators(policy),
    ruleEvaluators[ruleEvaluators.length - 1],
  ];
  return evaluators.map((evaluate) => evaluate(transaction, context));
}
