import { z } from "zod";

export const ruleStatusSchema = z.enum(["PASS", "FAIL"]);
export const ruleSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const ruleResultSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  status: ruleStatusSchema,
  severity: ruleSeveritySchema,
  actualValue: z.unknown(),
  expectedValue: z.unknown(),
  explanation: z.string(),
});

export type RuleStatus = z.infer<typeof ruleStatusSchema>;
export type RuleSeverity = z.infer<typeof ruleSeveritySchema>;
export type RuleResult = z.infer<typeof ruleResultSchema>;
