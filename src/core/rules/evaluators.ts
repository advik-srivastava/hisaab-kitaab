import type { RuleSeverity } from "../../types/rules";
import type { FinancePolicy } from "../../types/policies";
import type { Transaction } from "../../types/transaction";
import {
  createRuleResult,
  formatRupees,
  isMissing,
  matchesCategory,
  parseDateOnly,
} from "./helpers";
import type { RuleEvaluator } from "./types";

function requiredStringRule(
  ruleId: string,
  ruleName: string,
  fieldName: string,
  expectedValue: string,
  getValue: (transaction: Transaction) => string | null | undefined,
): RuleEvaluator {
  return (transaction) => {
    const value = getValue(transaction);
    const missing = isMissing(value);
    return createRuleResult(ruleId, ruleName, "MEDIUM", missing, {
      actualValue: missing ? null : value,
      expectedValue,
      explanation: missing
        ? `${fieldName} is missing.`
        : `${fieldName} is present.`,
    });
  };
}

const vendorRequired = requiredStringRule(
  "REQ_VENDOR",
  "Vendor required",
  "Vendor information",
  "Vendor is required",
  (transaction) => transaction.vendorName,
);

const invoiceNumberRequired = requiredStringRule(
  "REQ_INVOICE_NUMBER",
  "Invoice number required",
  "Invoice number",
  "Invoice number is required",
  (transaction) => transaction.invoiceNumber,
);

const invoiceDateRequired = requiredStringRule(
  "REQ_INVOICE_DATE",
  "Invoice date required",
  "Invoice date",
  "Invoice date is required",
  (transaction) => transaction.invoiceDate,
);

const currencyRequired = requiredStringRule(
  "REQ_CURRENCY",
  "Currency required",
  "Currency",
  "Currency is required",
  (transaction) => transaction.currency,
);

const amountRequired: RuleEvaluator = (transaction) => {
  const missing = transaction.amount === null || transaction.amount === undefined;
  return createRuleResult(
    "REQ_AMOUNT",
    "Amount required",
    "HIGH",
    missing,
    {
      actualValue: missing ? null : transaction.amount,
      expectedValue: "Amount is required",
      explanation: missing ? "Transaction amount is missing." : "Transaction amount is present.",
    },
  );
};

const amountPositive: RuleEvaluator = (transaction) => {
  const applicable = transaction.amount !== null && transaction.amount !== undefined;
  const failed =
    transaction.amount !== null &&
    transaction.amount !== undefined &&
    transaction.amount <= 0;
  return createRuleResult(
    "AMOUNT_POSITIVE",
    "Amount must be positive",
    "HIGH",
    failed,
    {
      actualValue: applicable ? transaction.amount : null,
      expectedValue: "Amount must be greater than 0",
      explanation: !applicable
        ? "Amount positivity was not evaluated because the amount is missing."
        : failed
          ? `Amount ${transaction.amount} must be greater than 0.`
          : `Amount ${transaction.amount} is greater than 0.`,
    },
  );
};

const dateValid: RuleEvaluator = (transaction) => {
  const missing = isMissing(transaction.invoiceDate);
  const validDate = missing ? undefined : parseDateOnly(transaction.invoiceDate as string);
  const failed = !missing && validDate === undefined;
  return createRuleResult(
    "DATE_VALID",
    "Invoice date validity",
    "MEDIUM",
    failed,
    {
      actualValue: missing ? null : transaction.invoiceDate,
      expectedValue: "Valid invoice date",
      explanation: missing
        ? "Date validity was not evaluated because the invoice date is missing."
        : failed
          ? `Invoice date "${transaction.invoiceDate}" is invalid.`
          : `Invoice date ${validDate} is valid.`,
    },
  );
};

const dateNotFuture: RuleEvaluator = (transaction, context) => {
  const validDate = isMissing(transaction.invoiceDate)
    ? undefined
    : parseDateOnly(transaction.invoiceDate as string);
  const failed = validDate !== undefined && validDate > context.referenceDate;
  return createRuleResult(
    "DATE_NOT_FUTURE",
    "Invoice date must not be future",
    "MEDIUM",
    failed,
    {
      actualValue: validDate ?? (transaction.invoiceDate ?? null),
      expectedValue: "Invoice date must not be in the future",
      explanation: !validDate
        ? "Future-date validation was not evaluated because the invoice date is missing or invalid."
        : failed
          ? `Invoice date ${validDate} is later than reference date ${context.referenceDate}.`
          : `Invoice date ${validDate} is not later than reference date ${context.referenceDate}.`,
    },
  );
};

const currencySupported: RuleEvaluator = (transaction, context) => {
  const missing = isMissing(transaction.currency);
  const currency = missing ? undefined : transaction.currency!.trim().toUpperCase();
  const currencies = context.policy.supportedCurrencies.map((value) => value.toUpperCase());
  const failed = currency !== undefined && !currencies.includes(currency);
  return createRuleResult(
    "CURRENCY_SUPPORTED",
    "Supported currency",
    "MEDIUM",
    failed,
    {
      actualValue: currency ?? null,
      expectedValue: currencies,
      explanation: missing
        ? "Currency support was not evaluated because currency is missing."
        : failed
          ? `Currency ${currency} is not supported; configured currencies: ${currencies.join(", ")}.`
          : `Currency ${currency} is supported.`,
    },
  );
};

function expenseLimitRule(
  ruleId: string,
  category: string,
  severity: RuleSeverity,
): RuleEvaluator {
  return (transaction, context) => {
    const limit = context.policy.expenseLimits[category];
    const applies = matchesCategory(transaction.expenseCategory, category);
    const amountExists = transaction.amount !== null && transaction.amount !== undefined;
    const failed = applies && amountExists && transaction.amount! > limit;

    return createRuleResult(
      ruleId,
      `${category} expense limit`,
      severity,
      failed,
      {
        actualValue: applies && amountExists ? transaction.amount : null,
        expectedValue: limit,
        explanation: !applies
          ? `${category} policy limit does not apply to this expense category.`
          : !amountExists
            ? `${category} policy limit was not evaluated because the amount is missing.`
            : failed
              ? `${category} amount ${formatRupees(transaction.amount!, transaction.currency ?? "INR")} exceeds the configured ${formatRupees(limit, transaction.currency ?? "INR")} policy limit.`
              : `${category} amount ${formatRupees(transaction.amount!, transaction.currency ?? "INR")} is within the configured ${formatRupees(limit, transaction.currency ?? "INR")} policy limit.`,
      },
    );
  };
}

const purchaseOrderRequired: RuleEvaluator = (transaction, context) => {
  const threshold = context.policy.purchaseOrderRequiredAbove;
  const amountExists = transaction.amount !== null && transaction.amount !== undefined;
  const aboveThreshold = amountExists && transaction.amount! > threshold;
  const failed = aboveThreshold && isMissing(transaction.purchaseOrder);

  return createRuleResult(
    "PO_REQUIRED",
    "Purchase order required above threshold",
    "HIGH",
    failed,
    {
      actualValue: amountExists ? transaction.amount : null,
      expectedValue: threshold,
      explanation: !amountExists
        ? "Purchase-order requirement was not evaluated because the amount is missing."
        : failed
          ? `Purchase order is required for transactions above ${formatRupees(threshold, transaction.currency ?? "INR")}.`
          : aboveThreshold
            ? `Purchase order ${transaction.purchaseOrder!.trim()} is present for an amount above ${formatRupees(threshold, transaction.currency ?? "INR")}.`
            : `Purchase order is not required at or below ${formatRupees(threshold, transaction.currency ?? "INR")}.`,
    },
  );
};

export const ruleEvaluators: readonly RuleEvaluator[] = [
  vendorRequired,
  invoiceNumberRequired,
  invoiceDateRequired,
  amountRequired,
  currencyRequired,
  amountPositive,
  dateValid,
  dateNotFuture,
  currencySupported,
  purchaseOrderRequired,
];

function expenseRuleId(category: string): string {
  return `LIMIT_${category.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_")}`;
}

export function createExpenseLimitEvaluators(
  policy: FinancePolicy,
): RuleEvaluator[] {
  return Object.keys(policy.expenseLimits).map((category) => expenseLimitRule(
    expenseRuleId(category),
    category,
    category.toLowerCase() === "hotel" ? "HIGH" : "MEDIUM",
  ));
}
