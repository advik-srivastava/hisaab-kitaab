import { z } from "zod";

export const duplicateMatchTypeSchema = z.enum([
  "EXACT",
  "PROBABLE",
  "FUZZY",
]);

export const confidenceBandSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const duplicateMatchSchema = z.object({
  currentTransactionId: z.string(),
  matchedTransactionId: z.string(),
  matchType: duplicateMatchTypeSchema,
  vendorSimilarity: z.number().min(0).max(100).nullable(),
  amountMatch: z.boolean(),
  invoiceNumberMatch: z.boolean(),
  dateDifferenceDays: z.number().int().nonnegative().nullable(),
  confidenceBand: confidenceBandSchema,
  evidence: z.array(z.string()),
});

export type DuplicateMatchType = z.infer<typeof duplicateMatchTypeSchema>;
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type DuplicateMatch = z.infer<typeof duplicateMatchSchema>;
