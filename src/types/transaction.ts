import { z } from "zod";

const missingStringSchema = z.string().nullable().optional();
const missingNumberSchema = z.number().nullable().optional();

export const rawTransactionSchema = z.object({
  vendorName: z.unknown().optional(),
  invoiceNumber: z.unknown().optional(),
  invoiceDate: z.unknown().optional(),
  amount: z.unknown().optional(),
  currency: z.unknown().optional(),
  expenseCategory: z.unknown().optional(),
  employeeId: z.unknown().optional(),
  department: z.unknown().optional(),
  purchaseOrder: z.unknown().optional(),
  description: z.unknown().optional(),
  sourceFile: z.string(),
  sourceSheet: missingStringSchema,
  sourceRow: z.number().int().positive(),
});

export type RawTransaction = z.infer<typeof rawTransactionSchema>;

export const transactionSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  vendorName: missingStringSchema,
  normalizedVendor: missingStringSchema,
  invoiceNumber: missingStringSchema,
  invoiceDate: missingStringSchema,
  amount: missingNumberSchema,
  currency: missingStringSchema,
  expenseCategory: missingStringSchema,
  employeeId: missingStringSchema,
  department: missingStringSchema,
  purchaseOrder: missingStringSchema,
  description: missingStringSchema,
  sourceFile: z.string(),
  sourceSheet: missingStringSchema,
  sourceRow: z.number().int().positive(),
  createdAt: z.string(),
});

export type Transaction = z.infer<typeof transactionSchema>;
