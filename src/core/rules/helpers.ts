import type { RuleResult, RuleSeverity } from "../../types/rules";

interface ResultValues {
  actualValue: unknown;
  expectedValue: unknown;
  explanation: string;
}

export function isMissing(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export function createRuleResult(
  ruleId: string,
  ruleName: string,
  severity: RuleSeverity,
  failed: boolean,
  values: ResultValues,
): RuleResult {
  return {
    ruleId,
    ruleName,
    severity,
    status: failed ? "FAIL" : "PASS",
    ...values,
  };
}

export function parseDateOnly(value: string): string | undefined {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

export function toReferenceDate(value: Date | string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("referenceDate must be a valid date");
    }
    return value.toISOString().slice(0, 10);
  }

  const parsed = parseDateOnly(value);
  if (!parsed) {
    throw new Error("referenceDate must use YYYY-MM-DD format");
  }
  return parsed;
}

export function formatRupees(amount: number): string {
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function matchesCategory(
  value: string | null | undefined,
  category: string,
): boolean {
  if (isMissing(value)) {
    return false;
  }

  const simplify = (text: string) => {
    const normalized = text.trim().toLowerCase();
    return normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  };

  return simplify(value as string) === simplify(category);
}
