import { describe, expect, it } from "vitest";

import policies from "../../src/config/policies.json";
import { evaluateRules } from "../../src/core/rules";
import { ruleResultSchema, type RuleResult } from "../../src/types/rules";
import type { Transaction } from "../../src/types/transaction";

const referenceDate = "2026-09-19";

const cleanTransaction: Transaction = {
  id: "transaction-1",
  batchId: "batch-1",
  vendorName: "Contoso Ltd",
  normalizedVendor: "contoso ltd",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-09-18",
  amount: 1000,
  currency: "INR",
  expenseCategory: "Office Supplies",
  employeeId: "EMP-1",
  department: "Finance",
  purchaseOrder: undefined,
  description: "Stationery",
  sourceFile: "transactions.csv",
  sourceSheet: "CSV",
  sourceRow: 2,
  createdAt: "2026-09-19T00:00:00.000Z",
};

function evaluate(overrides: Partial<Transaction> = {}): RuleResult[] {
  return evaluateRules(
    { ...cleanTransaction, ...overrides },
    { referenceDate },
  );
}

function rule(results: RuleResult[], ruleId: string): RuleResult {
  const result = results.find((candidate) => candidate.ruleId === ruleId);
  if (!result) throw new Error(`Missing rule ${ruleId}`);
  return result;
}

describe("evaluateRules", () => {
  it("returns 13 passing contract-valid results for a clean transaction", () => {
    const results = evaluate();

    expect(results).toHaveLength(13);
    expect(results.every(({ status }) => status === "PASS")).toBe(true);
    expect(results.every((result) => ruleResultSchema.safeParse(result).success)).toBe(true);
  });

  it("fails when vendor is missing", () => {
    expect(rule(evaluate({ vendorName: "  " }), "REQ_VENDOR")).toMatchObject({
      status: "FAIL",
      severity: "MEDIUM",
      expectedValue: "Vendor is required",
    });
  });

  it("fails when invoice number is missing", () => {
    expect(rule(evaluate({ invoiceNumber: undefined }), "REQ_INVOICE_NUMBER")).toMatchObject({
      status: "FAIL",
      severity: "MEDIUM",
    });
  });

  it("fails once when invoice date is missing", () => {
    const results = evaluate({ invoiceDate: undefined });

    expect(rule(results, "REQ_INVOICE_DATE").status).toBe("FAIL");
    expect(rule(results, "DATE_VALID").status).toBe("PASS");
    expect(rule(results, "DATE_NOT_FUTURE").status).toBe("PASS");
  });

  it("fails amount-required when amount is missing", () => {
    const results = evaluate({ amount: undefined });

    expect(rule(results, "REQ_AMOUNT")).toMatchObject({ status: "FAIL", severity: "HIGH" });
    expect(rule(results, "AMOUNT_POSITIVE").status).toBe("PASS");
  });

  it("fails once when currency is missing", () => {
    const results = evaluate({ currency: " " });

    expect(rule(results, "REQ_CURRENCY").status).toBe("FAIL");
    expect(rule(results, "CURRENCY_SUPPORTED").status).toBe("PASS");
  });

  it.each([0, -0.01, -100])("fails non-positive amount %s", (amount) => {
    expect(rule(evaluate({ amount }), "AMOUNT_POSITIVE")).toMatchObject({
      status: "FAIL",
      severity: "HIGH",
      actualValue: amount,
      expectedValue: "Amount must be greater than 0",
    });
  });

  it("passes a valid invoice date", () => {
    expect(rule(evaluate({ invoiceDate: "2026-02-28" }), "DATE_VALID").status).toBe("PASS");
  });

  it.each(["not-a-date", "2026-02-30", "19/09/2026"])(
    "fails invalid normalized invoice date %s",
    (invoiceDate) => {
      const results = evaluate({ invoiceDate });
      expect(rule(results, "DATE_VALID").status).toBe("FAIL");
      expect(rule(results, "DATE_NOT_FUTURE").status).toBe("PASS");
    },
  );

  it("fails a valid future invoice date using the supplied reference date", () => {
    expect(rule(evaluate({ invoiceDate: "2026-09-20" }), "DATE_NOT_FUTURE")).toMatchObject({
      status: "FAIL",
      severity: "MEDIUM",
      expectedValue: "Invoice date must not be in the future",
    });
  });

  it("passes an invoice on the reference date", () => {
    expect(rule(evaluate({ invoiceDate: referenceDate }), "DATE_NOT_FUTURE").status).toBe("PASS");
  });

  it("passes configured INR currency", () => {
    expect(rule(evaluate({ currency: "INR" }), "CURRENCY_SUPPORTED").status).toBe("PASS");
  });

  it("fails unsupported USD currency", () => {
    expect(rule(evaluate({ currency: "USD" }), "CURRENCY_SUPPORTED")).toMatchObject({
      status: "FAIL",
      severity: "MEDIUM",
      actualValue: "USD",
    });
  });

  it.each([
    ["Meals", 2000, "LIMIT_MEALS"],
    ["Taxi", 3000, "LIMIT_TAXI"],
    ["Hotel", 10000, "LIMIT_HOTEL"],
  ])("passes %s at its exact limit", (expenseCategory, amount, ruleId) => {
    expect(rule(evaluate({ expenseCategory, amount }), ruleId).status).toBe("PASS");
  });

  it.each([
    ["Meal", 2000.01, "LIMIT_MEALS", "MEDIUM"],
    ["Taxis", 3000.01, "LIMIT_TAXI", "MEDIUM"],
    ["Hotels", 10000.01, "LIMIT_HOTEL", "HIGH"],
  ])(
    "fails %s above its configured limit",
    (expenseCategory, amount, ruleId, severity) => {
      expect(rule(evaluate({ expenseCategory, amount }), ruleId)).toMatchObject({
        status: "FAIL",
        severity,
        actualValue: amount,
      });
    },
  );

  it("passes PO rule at the exact threshold without a PO", () => {
    expect(rule(evaluate({ amount: 25000, purchaseOrder: undefined }), "PO_REQUIRED").status).toBe("PASS");
  });

  it("fails PO rule above the threshold without a PO", () => {
    expect(rule(evaluate({ amount: 25000.01, purchaseOrder: " " }), "PO_REQUIRED")).toMatchObject({
      status: "FAIL",
      severity: "HIGH",
      expectedValue: policies.purchaseOrderRequiredAbove,
      actualValue: 25000.01,
    });
  });

  it("uses the triggering transaction amount as PO-rule evidence", () => {
    expect(rule(evaluate({ amount: 28300, purchaseOrder: undefined }), "PO_REQUIRED")).toMatchObject({
      status: "FAIL",
      expectedValue: 25000,
      actualValue: 28300,
    });
  });

  it("passes PO rule above the threshold with a PO", () => {
    expect(rule(evaluate({ amount: 50000, purchaseOrder: "PO-123" }), "PO_REQUIRED").status).toBe("PASS");
  });

  it("does not create a misleading PO failure when amount is missing", () => {
    const result = rule(evaluate({ amount: undefined, purchaseOrder: undefined }), "PO_REQUIRED");
    expect(result.status).toBe("PASS");
    expect(result.explanation).toContain("amount is missing");
  });

  it("includes actual and configured limit information in failure explanations", () => {
    const hotel = rule(evaluate({ expenseCategory: "Hotel", amount: 14500 }), "LIMIT_HOTEL");
    const po = rule(evaluate({ amount: 26000, purchaseOrder: undefined }), "PO_REQUIRED");

    expect(hotel.explanation).toBe(
      "Hotel amount ₹14,500 exceeds the configured ₹10,000 policy limit.",
    );
    expect(po.explanation).toBe(
      "Purchase order is required for transactions above ₹25,000.",
    );
  });

  it("uses every configured policy value in rule results", () => {
    const results = evaluate({ expenseCategory: "Meals", amount: 2000 });

    expect(rule(results, "CURRENCY_SUPPORTED").expectedValue).toEqual(
      policies.supportedCurrencies,
    );
    expect(rule(results, "LIMIT_MEALS").expectedValue).toBe(policies.expenseLimits.Meals);
    expect(rule(results, "LIMIT_TAXI").expectedValue).toBe(policies.expenseLimits.Taxi);
    expect(rule(results, "LIMIT_HOTEL").expectedValue).toBe(policies.expenseLimits.Hotel);
    expect(rule(results, "PO_REQUIRED").expectedValue).toBe(
      policies.purchaseOrderRequiredAbove,
    );
  });

  it("does not mutate the source transaction", () => {
    const transaction = { ...cleanTransaction, currency: "inr", expenseCategory: "Meals" };
    const before = structuredClone(transaction);

    evaluateRules(transaction, { referenceDate });

    expect(transaction).toEqual(before);
  });
});
