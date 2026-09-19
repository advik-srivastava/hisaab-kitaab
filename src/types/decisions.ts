import { z } from "zod";

export const decisionStatusSchema = z.enum([
  "AUTO_PASS",
  "REVIEW",
  "HIGH_RISK",
]);

export const decisionSchema = z.object({
  status: decisionStatusSchema,
  riskPriority: z.number().nonnegative(),
  headline: z.string(),
  summary: z.string(),
  recommendedAction: z.string(),
});

export const batchSummarySchema = z.object({
  totalProcessed: z.number().int().nonnegative(),
  autoPassed: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  highRisk: z.number().int().nonnegative(),
  duplicateCandidates: z.number().int().nonnegative(),
  potentialExposure: z.number().nonnegative(),
});

export type DecisionStatus = z.infer<typeof decisionStatusSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type BatchSummary = z.infer<typeof batchSummarySchema>;
