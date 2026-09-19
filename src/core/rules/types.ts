import type { RuleResult } from "../../types/rules";
import type { Transaction } from "../../types/transaction";

export interface RuleEvaluationOptions {
  referenceDate?: Date | string;
}

export interface RuleContext {
  referenceDate: string;
}

export type RuleEvaluator = (
  transaction: Transaction,
  context: RuleContext,
) => RuleResult;
