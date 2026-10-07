import { File as NodeFile } from "node:buffer";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { defaultFinancePolicy } from "../../src/config/defaultPolicy";
import { processBatch } from "../../src/core/pipeline";
import { activatePolicySet, parsePolicyFile } from "../../src/core/policies";
import { evaluateRules } from "../../src/core/rules";
import type { FinancePolicy } from "../../src/types/policies";
import type { Transaction } from "../../src/types/transaction";
import { loadState, type StorageLike } from "../../src/lib/storage";

const customPolicy: FinancePolicy = {
  ...defaultFinancePolicy,
  id: "acme-2026-1",
  companyName: "Acme Pvt Ltd",
  policyName: "Acme Expense Policy",
  version: "2026.1",
  supportedCurrencies: ["INR", "USD"],
  expenseLimits: { Meals: 3000, Taxi: 5000, Hotel: 15000, Fuel: 4000 },
  purchaseOrderRequiredAbove: 50000,
  createdAt: "2026-09-19T00:00:00.000Z",
  status: "ACTIVE",
};

const transaction: Transaction = {
  id: "TXN-1",
  batchId: "BATCH-1",
  vendorName: "Contoso",
  normalizedVendor: "contoso",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-09-18",
  amount: 2500,
  currency: "INR",
  expenseCategory: "Meals",
  sourceFile: "invoices.csv",
  sourceSheet: "CSV",
  sourceRow: 2,
  createdAt: "2026-09-19T00:00:00.000Z",
};

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function rule(policy: FinancePolicy, overrides: Partial<Transaction>, ruleId: string) {
  return evaluateRules({ ...transaction, ...overrides }, {
    referenceDate: "2026-09-19",
    policy,
  }).find((result) => result.ruleId === ruleId);
}

function file(contents: string | Uint8Array, name: string): File {
  return new NodeFile([contents], name) as unknown as File;
}

describe("company-specific policies", () => {
  it("keeps existing default behavior and applies a custom meal limit", () => {
    expect(rule(defaultFinancePolicy, {}, "LIMIT_MEALS")?.status).toBe("FAIL");
    expect(rule(customPolicy, {}, "LIMIT_MEALS")?.status).toBe("PASS");
    expect(rule(customPolicy, { expenseCategory: "Fuel", amount: 4000.01 }, "LIMIT_FUEL")?.status).toBe("FAIL");
  });

  it("uses the custom purchase-order threshold and numeric evidence", () => {
    expect(rule(defaultFinancePolicy, { amount: 30000, purchaseOrder: undefined }, "PO_REQUIRED")).toMatchObject({ status: "FAIL", expectedValue: 25000, actualValue: 30000 });
    expect(rule(customPolicy, { amount: 30000, purchaseOrder: undefined }, "PO_REQUIRED")?.status).toBe("PASS");
  });

  it("uses supported currencies from the active policy", () => {
    expect(rule(defaultFinancePolicy, { currency: "USD" }, "CURRENCY_SUPPORTED")?.status).toBe("FAIL");
    expect(rule(customPolicy, { currency: "USD" }, "CURRENCY_SUPPORTED")?.status).toBe("PASS");
  });

  it("rejects malformed uploaded policies", async () => {
    await expect(parsePolicyFile(file(JSON.stringify({ companyName: "Acme" }), "policy.json"), {
      now: "2026-09-19T00:00:00.000Z",
      id: "invalid",
    })).rejects.toThrow();
  });

  it("parses valid JSON, CSV, and XLSX policy uploads", async () => {
    const json = file(JSON.stringify({
      companyName: "Acme",
      policyName: "Expense Policy",
      version: "1",
      supportedCurrencies: ["INR", "USD"],
      expenseLimits: { Meals: 2500 },
      purchaseOrderRequiredAbove: 30000,
    }), "policy.json");
    const csv = file(
      "companyName,policyName,version,supportedCurrencies,purchaseOrderRequiredAbove,expenseLimit.Meals\nAcme,Expense Policy,1,INR|USD,30000,2500",
      "policy.csv",
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      companyName: "Acme",
      policyName: "Expense Policy",
      version: "1",
      supportedCurrencies: "INR|USD",
      purchaseOrderRequiredAbove: 30000,
      "expenseLimit.Meals": 2500,
    }]), "Policy");
    const xlsx = file(new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })), "policy.xlsx");

    for (const uploaded of [json, csv, xlsx]) {
      await expect(parsePolicyFile(uploaded, {
        now: "2026-09-19T00:00:00.000Z",
        id: `policy-${uploaded.name}`,
      })).resolves.toMatchObject({ companyName: "Acme", supportedCurrencies: ["INR", "USD"], expenseLimits: { Meals: 2500 } });
    }
  });

  it("archives the previous active version when a new policy is activated", () => {
    const previous = { ...customPolicy, id: "old", version: "2026.0", status: "ACTIVE" as const };
    const next = { ...customPolicy, id: "new", status: "DRAFT" as const };
    const policies = activatePolicySet([previous, next], next.id, "2026-09-20T00:00:00.000Z");
    expect(policies.find(({ id }) => id === "old")?.status).toBe("ARCHIVED");
    expect(policies.find(({ id }) => id === "new")).toMatchObject({ status: "ACTIVE", activatedAt: "2026-09-20T00:00:00.000Z" });
  });

  it("records the policy identity and version with an analyzed batch", async () => {
    const storage = new MemoryStorage();
    const result = await processBatch([
      file("Vendor,Invoice,Invoice Date,Amount,Currency,Category\nContoso,INV-1,2026-09-18,2500,INR,Meals", "batch.csv"),
    ], {
      referenceDate: "2026-09-19",
      now: () => new Date("2026-09-19T12:00:00.000Z"),
      policy: customPolicy,
      storage,
    });
    expect(result.policySnapshot).toMatchObject({ id: customPolicy.id, policyName: customPolicy.policyName, version: customPolicy.version });
    expect(loadState(storage).currentBatch?.policySnapshot).toEqual(result.policySnapshot);
    expect(result.decisions[result.transactions[0].id].status).toBe("AUTO_PASS");
  });
});
