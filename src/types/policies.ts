import { z } from "zod";

export const policyStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const financePolicySchema = z.object({
  id: z.string().trim().min(1, "Policy ID is required."),
  companyName: z.string().trim().min(1, "Company name is required."),
  policyName: z.string().trim().min(1, "Policy name is required."),
  version: z.string().trim().min(1, "Policy version is required."),
  supportedCurrencies: z.array(z.string().trim().min(1))
    .min(1, "At least one supported currency is required."),
  expenseLimits: z.record(
    z.string().trim().min(1),
    z.number().finite().positive("Expense limits must be positive numbers."),
  ).refine((limits) => Object.keys(limits).length > 0, {
    message: "At least one expense limit is required.",
  }),
  purchaseOrderRequiredAbove: z.number().finite().positive(
    "The purchase-order threshold must be a positive number.",
  ),
  requiredFields: z.array(z.string().trim().min(1)).optional(),
  createdAt: z.string().datetime(),
  activatedAt: z.string().datetime().optional(),
  status: policyStatusSchema,
});

export const policySnapshotSchema = financePolicySchema.pick({
  id: true,
  companyName: true,
  policyName: true,
  version: true,
  supportedCurrencies: true,
  expenseLimits: true,
  purchaseOrderRequiredAbove: true,
  requiredFields: true,
});

export type FinancePolicy = z.infer<typeof financePolicySchema>;
export type PolicySnapshot = z.infer<typeof policySnapshotSchema>;
export type PolicyStatus = z.infer<typeof policyStatusSchema>;

export function toPolicySnapshot(policy: FinancePolicy): PolicySnapshot {
  return policySnapshotSchema.parse(policy);
}
