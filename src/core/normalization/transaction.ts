import type { RawTransaction, Transaction } from "../../types/transaction";

import {
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizeInvoiceNumber,
  normalizeText,
  normalizeVendor,
} from "./fields";

interface TransactionIdentity {
  id: string;
  batchId: string;
  createdAt: string;
}

export function normalizeTransaction(
  raw: RawTransaction,
  identity: TransactionIdentity,
): Transaction {
  const vendorName = normalizeText(raw.vendorName);

  return {
    ...identity,
    vendorName,
    normalizedVendor: normalizeVendor(vendorName),
    invoiceNumber: normalizeInvoiceNumber(raw.invoiceNumber),
    invoiceDate: normalizeDate(raw.invoiceDate),
    amount: normalizeAmount(raw.amount),
    currency: normalizeCurrency(raw.currency),
    expenseCategory: normalizeText(raw.expenseCategory),
    employeeId: normalizeText(raw.employeeId),
    department: normalizeText(raw.department),
    purchaseOrder: normalizeText(raw.purchaseOrder),
    description: normalizeText(raw.description),
    sourceFile: raw.sourceFile,
    sourceSheet: raw.sourceSheet,
    sourceRow: raw.sourceRow,
  };
}
