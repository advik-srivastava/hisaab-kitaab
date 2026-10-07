import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";
import type { FinancePolicy } from "../../types/policies";

export interface RuleEvaluationOptions {
  referenceDate?: Date | string;
  policy?: FinancePolicy;
}

export interface RuleContext {
  referenceDate: string;
  policy: FinancePolicy;
}

export type RuleEvaluator = (
  transaction: Transaction,
  context: RuleContext,
) => RuleResult;
