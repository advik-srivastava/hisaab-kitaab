import policyValues from "./policies.json";
import type { FinancePolicy } from "../types/policies";

export const defaultFinancePolicy: FinancePolicy = {
  id: "default-demo-policy",
  companyName: "hisaab-kitaab Demo",
  policyName: "Default Demo Policy",
  version: "1.0",
  supportedCurrencies: [...policyValues.supportedCurrencies],
  expenseLimits: { ...policyValues.expenseLimits },
  purchaseOrderRequiredAbove: policyValues.purchaseOrderRequiredAbove,
  requiredFields: ["vendorName", "invoiceNumber", "invoiceDate", "amount", "currency"],
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "ACTIVE",
};
