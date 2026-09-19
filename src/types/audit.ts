import { z } from "zod";

import { decisionStatusSchema } from "./decisions";

export const actorTypeSchema = z.enum(["SYSTEM", "USER"]);

export const auditEventSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  batchId: z.string(),
  timestamp: z.string(),
  actorType: actorTypeSchema,
  actorId: z.string().nullable(),
  action: z.string(),
  oldStatus: decisionStatusSchema.nullable(),
  newStatus: decisionStatusSchema.nullable(),
  note: z.string().nullable(),
});

export type ActorType = z.infer<typeof actorTypeSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
