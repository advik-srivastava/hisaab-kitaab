import { z } from "zod";

import { auditEventSchema } from "../../types/audit";
import { batchSummarySchema, decisionSchema } from "../../types/decisions";
import { duplicateMatchSchema } from "../../types/duplicates";
import { ruleResultSchema } from "../../types/rules";
import { transactionSchema } from "../../types/transaction";
import { policySnapshotSchema } from "../../types/policies";
import { STORAGE_VERSION } from "./types";

const reviewActionSchema = z.enum([
  "APPROVE",
  "REJECT",
  "MARK_NOT_DUPLICATE",
]);

const storedReviewActionSchema = z.object({
  action: reviewActionSchema,
  reviewer: z.string(),
  note: z.string().nullable(),
  timestamp: z.string(),
  auditEventId: z.string(),
});

const persistedBatchSchema = z.object({
  batchId: z.string(),
  createdAt: z.string(),
  batchSummary: batchSummarySchema.optional(),
  policySnapshot: policySnapshotSchema.optional(),
  transactions: z.array(transactionSchema),
  ruleResults: z.record(z.string(), z.array(ruleResultSchema)),
  duplicateMatches: z.record(z.string(), z.array(duplicateMatchSchema)),
  decisions: z.record(z.string(), decisionSchema),
  auditEvents: z.array(auditEventSchema),
  reviewActions: z.record(z.string(), z.array(storedReviewActionSchema)),
});

export const persistedStateSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  currentBatch: persistedBatchSchema.nullable(),
});
